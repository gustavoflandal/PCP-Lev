# Brief: corrigir achados da revisão de código (Task F4, sub-entrega Auditoria)

## Onde isto se encaixa

A sub-entrega "Auditoria" (Fase 4, item 1) já foi implementada e mesclada na `main`
(backend + frontend, 393/393 testes de frontend e 100% dos pacotes de backend passando).
A Task F4 do plano (`docs/superpowers/plans/2026-08-31-auditoria.md`) é a verificação
final — rodei o agente `code-reviewer` sobre o diff completo (`.superpowers/sdd/reviews/
auditoria-f4-diff.txt`) com atenção especial ao pinning de conexão por requisição
(a mudança de maior risco, introduzida para corrigir usuário/IP sempre NULL na trilha
de auditoria). A revisão encontrou 1 achado Crítico e 6 Altos reais, todos exigindo
correção antes de dar a Task F4 por concluída — não são nitpicks, são bugs de
disponibilidade, segurança e correção. Você vai implementá-los.

Você está no worktree `D:\PCP-Lev\.claude\worktrees\auditoria-verificacao-final`,
branch `chore/auditoria-verificacao-final`. Ambiente Docker já está rodando (containers
`pcp_postgres`/`pcp_backend`/`pcp_frontend`, rede `pcp-lev_default`, projeto `pcp-lev`,
banco de teste `pcp_db_test` já existe). Você NÃO precisa subir esse ambiente — só usá-lo
para rodar os testes. Comandos de teste no final deste brief.

## Achados a corrigir (todos obrigatórios)

### 1. CRÍTICO — Pool de conexões esgota com qualquer tráfego, inclusive não autenticado

`backend/internal/api/middleware/auditoria.go`, registrado globalmente em
`backend/internal/api/routes.go:62` (`e.Use(...)`, antes do grupo de rotas).

O middleware fixa (`pool.Acquire`) uma conexão do pool para TODA requisição HTTP,
inclusive `GET`/`HEAD`/`OPTIONS` e 404s, porque o Echo aplica middlewares globais também
ao `NotFoundHandler`. Os triggers de auditoria (migration 007) só disparam em
`INSERT`/`UPDATE`/`DELETE` — uma requisição que só lê nunca precisa de conexão fixada.
Com `DB_MAX_CONNS=20` (padrão), isso vira um teto de 20 requisições HTTP simultâneas na
API inteira, e um `GET /qualquer-coisa-inexistente` sem autenticação, repetido ~20 vezes,
esgota o pool e trava a aplicação inteira. `Acquire` também não tem timeout próprio hoje.

**Corrigir:**
- No início do middleware, se `c.Request().Method` for `GET`, `HEAD` ou `OPTIONS`,
  pule o pinning inteiro (`return proximo(c)` direto, sem `Acquire`).
- No `pool.Acquire`, use um contexto com timeout curto (2-3s) derivado do contexto da
  requisição, para falhar rápido em vez de enfileirar indefinidamente quando o pool
  estiver saturado (o fallback já existente — `slog.Error` + `return proximo(c)` — cobre
  esse caso).

Como consequência direta desta mudança, `v1.GET("/saude", ...)` (`routes.go:66-72`) deixa
de competir por uma segunda conexão enquanto já seguraria uma da própria requisição —
não precisa de nenhuma alteração própria, só confirme que o teste `TestSaudeRespondeSemToken`
continua passando.

### 2. ALTO — Fallback do middleware pode gravar auditoria com o USUÁRIO ERRADO, e panic pula o RESET das variáveis de sessão

Mesmo arquivo, `middleware.go`. Dois achados que têm a mesma causa raiz e a mesma
correção:

- Os dois `RESET` (linhas ~62-67, depois de `proximo(c)`) só rodam se o handler retornar
  normalmente. Um `panic` no handler (capturado por `echomw.Recover()`, que roda ANTES
  deste middleware na cadeia) desenrola a pilha através dele: o `defer conexao.Release()`
  roda, mas os `RESET` não — a conexão volta ao pool com `pcp.usuario_id`/
  `pcp.endereco_ip` da requisição que quebrou.
- Nos dois caminhos de erro (`Acquire` falhou, `set_config` falhou), o código faz
  `return proximo(c)` sem colocar o executor no contexto — o repositório cai para
  `r.pool` (conexão arbitrária do pool), que pode estar suja pelo problema acima.
  Resultado: em vez de `usuario_id` NULL (aceitável — "sem sessão associada", já
  documentado no domínio), a linha de auditoria pode ficar atribuída a OUTRO usuário.
  Para uma trilha de auditoria, isso é pior que NULL — é evidência falsa.

**Corrigir com uma única mudança estrutural:** troque os dois `conexao.Exec(...RESET...)`
depois de `proximo(c)` por um `defer` registrado logo após o `Acquire` bem-sucedido,
ANTES de qualquer outro `return` no meio da função. Como `defer` roda em LIFO, registre-o
depois do `defer conexao.Release()` (assim ele executa PRIMEiro, antes do Release):

```go
conexao, err := pool.Acquire(ctxComTimeout)
if err != nil {
    slog.Error("falha ao fixar conexao para auditoria", "erro", err)
    return proximo(c)
}
defer conexao.Release()
defer func() {
    // roda ANTES do Release (LIFO) -- cobre retorno normal, os dois early-return
    // de erro, e panic (Recover roda fora deste middleware, entao o unwind passa
    // por aqui e os defers rodam do mesmo jeito).
    if _, err := conexao.Exec(context.Background(), `RESET pcp.usuario_id`); err != nil {
        slog.Error("falha ao limpar pcp.usuario_id apos a requisicao", "erro", err)
    }
    if _, err := conexao.Exec(context.Background(), `RESET pcp.endereco_ip`); err != nil {
        slog.Error("falha ao limpar pcp.endereco_ip apos a requisicao", "erro", err)
    }
}()

// resto da funcao (set_config, SetRequest, proximo(c)) sem os RESET manuais no fim --
// so "return proximo(c)" / "return erroHandler".
```

Isso resolve os dois achados de uma vez: toda saída da função (sucesso, erro de
set_config, panic) sempre limpa a conexão antes de devolvê-la ao pool, então mesmo no
pior caso (Acquire falhou e caiu para o pool compartilhado) a conexão que o próximo
request pegar do pool nunca carrega usuário/IP de uma requisição anterior — na pior
hipótese fica NULL, nunca errada.

**Teste de regressão obrigatório** (novo arquivo
`backend/internal/api/middleware/auditoria_test.go`, mesmo padrão de
`routes_test.go` — suba um roteador real com `testsupport.PoolLimpo`/migrado, não mock):
prove que uma segunda requisição (sem token, reusando a mesma conexão do pool que a
primeira usou) grava `usuario_id` NULL mesmo depois de uma primeira requisição
autenticada ter passado pela mesma conexão. Se conseguir forçar a reutilização da mesma
conexão física de forma determinística é ideal; se não for prático isolar isso do pool
de 20 conexões, um teste que rode N requisições autenticadas com usuários DIFERENTES em
sequência rápida e confirme que cada linha de auditoria tem o `usuario_id` certo (nunca
o de uma requisição anterior) também cobre o risco. Use seu julgamento sobre qual desenho
prova a propriedade de forma mais direta.

### 3. ALTO — IP da auditoria é forjável pelo cliente (`X-Forwarded-For` sem lista de proxies confiáveis)

`backend/internal/api/routes.go`, dentro de `NovoRoteador`, antes do primeiro
`e.Use(...)` (ou logo depois de criar `e := echo.New()`).

`c.RealIP()` (usado em `middleware.go`) usa o extrator padrão do Echo v4, que lê
`X-Forwarded-For`/`X-Real-IP` sem nenhuma noção de proxy confiável — qualquer cliente
pode forjar o cabeçalho e a auditoria grava um IP falso.

**Corrigir:** configure `e.IPExtractor` explicitamente, confiando em `X-Forwarded-For`
só quando o hop imediato (RemoteAddr) for loopback ou rede privada — cobre o cenário
atual (nginx do `docker-compose.yml` fica na mesma rede Docker, tipicamente
`172.x.x.x`/RFC1918):

```go
e.IPExtractor = echo.ExtractIPFromXFFHeader(
    echo.TrustLoopback(true),
    echo.TrustLinkLocal(true),
    echo.TrustPrivateNet(true),
)
```

Isso também corrige de graça o mesmo problema em `middleware.Log()` (log estruturado),
que já usava `c.RealIP()`.

**Não quebre o teste existente**: `TestRequisicaoAutenticadaGravaUsuarioEIPNaAuditoria`
(`routes_test.go`) seta `reqCriar.RemoteAddr = "203.0.113.7:54321"` sem cabeçalho
`X-Forwarded-For` e espera `enderecoIP == "203.0.113.7"`. Como não há XFF e o RemoteAddr
não é privado/loopback, o extrator cai no RemoteAddr direto — o teste deve continuar
passando sem alteração. Rode-o para confirmar.

### 4. ALTO — `senha_hash` de qualquer usuário vaza pela API/tela de auditoria

`backend/internal/infra/repository/auditoria_repo.go` (`lerRegistros`), consumido por
`backend/internal/api/handlers/auditoria.go` e renderizado em
`frontend/src/paginas/configuracoes/Auditoria.tsx`.

A tabela `usuarios` é auditada (migration 007) e o trigger grava a linha inteira em
`dados_antigos`/`dados_novos`, incluindo `senha_hash`. Todo login atualiza `ultimo_login`
(dispara o trigger) e toda troca de senha grava hash antigo E novo. `GET /auditoria`
devolve esses JSONB crus, e a modal de diff no frontend os exibe campo a campo — um
Administrador consegue ver o hash bcrypt de senha de qualquer usuário do sistema pela
tela de auditoria. É dado sensível (LGPD) e material de cracking offline.

**Corrigir no backend, em `lerRegistros`** (`auditoria_repo.go`): depois de escanear
`reg.DadosAntigos`/`reg.DadosNovos`, para linhas onde `reg.Tabela == "usuarios"`, remova
a chave `senha_hash` de ambos os JSONs antes de devolver o registro. Desenhe isso para
ser extensível (um `map[string][]string` de tabela -> campos sensíveis, mesmo que hoje
só tenha uma entrada), não hardcoded inline, porque outras tabelas podem ganhar campos
sensíveis no futuro. Implemente com `encoding/json`: unmarshal para
`map[string]json.RawMessage` (ou `map[string]any`), `delete` da chave, remarshal — se o
campo já não existir (ex.: linha de outra tabela, ou `DadosAntigos` nulo num INSERT),
não faça nada (sem erro). Aplique tanto em `Listar` quanto em `ListarParaExportar` (os
dois passam por `lerRegistros`, então a correção em um lugar já cobre os dois).

**Teste de regressão**: em `auditoria_repo_test.go`, grave uma alteração numa linha de
`usuarios` (ex.: um UPDATE de `nome`) e confirme que `senha_hash` não aparece em nenhuma
chave de `DadosAntigos`/`DadosNovos` do registro devolvido, mas que outros campos (ex.
`nome`) continuam presentes.

### 5. ALTO — Exportação CSV sem limite, e busca colunas pesadas que não usa

`backend/internal/infra/repository/auditoria_repo.go` (`ListarParaExportar`,
`colunasAuditoria`), consumido em `backend/internal/api/handlers/auditoria.go`.

`ListarParaExportar` não tem `LIMIT` (aceitável — outras exportações CSV do sistema,
como estoque e pedidos de compra, também não limitam, é o padrão já estabelecido do
projeto). O problema real e evitável: a query de exportação seleciona
`a.dados_antigos, a.dados_novos` (via `colunasAuditoria`, compartilhada com `Listar`),
mas o CSV montado no handler não usa nenhum dos dois campos — são as duas colunas mais
pesadas da tabela, transferidas e desserializadas à toa, agravando o custo de memória de
uma exportação sem limite.

**Corrigir:** crie uma lista de colunas dedicada para exportação (mesmo padrão de
`colunasAuditoria`, mas sem `a.dados_antigos, a.dados_novos`) e um scan correspondente
que não leia esses dois campos (deixe `Registro.DadosAntigos`/`DadosNovos` como
zero-value nos itens devolvidos por `ListarParaExportar` — o handler de CSV não os lê
hoje, confirme isso antes de mudar). Não precisa duplicar toda a função `lerRegistros`;
extraia o que fizer sentido para reaproveitar entre as duas queries.

### 6. ALTO — Data/hora da auditoria aparece 3 horas errada na tela (diverge do CSV)

`backend/internal/infra/repository/auditoria_repo.go` (`lerRegistros`, campo
`reg.DataHora`), consumido por `frontend/src/paginas/configuracoes/Auditoria.tsx`
(`formatarDataHora`).

Cadeia do bug: a coluna `auditoria.data_hora` é `TIMESTAMP` sem timezone (migration 007,
`DEFAULT CURRENT_TIMESTAMP`); o container Postgres roda com `TZ: America/Sao_Paulo`
(`docker-compose.yml`), então o valor gravado é hora de parede de São Paulo (ex.: um
evento às 13:00 UTC grava `10:00`). O driver pgx lê `timestamp` sem tz como `time.Time`
com `Location` **UTC** (rotulagem, não conversão) — o Go passa a achar que são
`10:00 UTC`. O JSON sai `"...T10:00:00Z"`, e `new Date(iso)` no navegador interpreta como
UTC de verdade, convertendo para o fuso do navegador ao exibir — no fuso de São Paulo,
vira `07:00`. Já o CSV (`handlers/auditoria.go`, `reg.DataHora.Format("2006-01-02
15:04:05")`) imprime os dígitos de hora tal como estão no `time.Time` (sem conversão de
timezone nesse layout), então mostra `10:00` — o valor **correto**. Tela e CSV do mesmo
registro discordam, e é a tela que está errada.

**Não mude os filtros de período** (`DataInicio`/`DataFim` em `condicoesDeAuditoria`) —
eles usam o mesmo referencial de gravação e já estão corretos; mudar a interpretação de
`DataHora` sem tocar neles é o objetivo.

**Corrigir em `lerRegistros`** (ou num ponto único que os dois métodos passem por): depois
de escanear `reg.DataHora`, reconstrua o `time.Time` com os MESMOS dígitos de wall-clock
(ano/mês/dia/hora/minuto/segundo/nanossegundo — não converta, só reetiquete) numa
localização fixa `America/Sao_Paulo` (`time.FixedZone("America/Sao_Paulo", -3*3600)` —
o Brasil não observa horário de verão desde 2019, um offset fixo de -03:00 é correto
hoje; deixe um comentário explicando essa premissa para quem ler depois). Isso faz o
JSON sair como `"...T10:00:00-03:00"` (instante absoluto correto), e o navegador exibe a
hora certa no fuso do usuário sem precisar mudar nada no `Auditoria.tsx` (o
`formatarDataHora` atual já faz a coisa certa uma vez que o backend mande o offset
correto). Confirme que `reg.DataHora.Format("2006-01-02 15:04:05")` no CSV continua
imprimindo os mesmos dígitos de antes (a reconstrução não muda os dígitos de wall-clock,
só o `Location` associado, então o `Format` com esse layout não deve mudar de saída).

**Teste de regressão**: em `auditoria_repo_test.go`, grave um evento, leia de volta via
`Listar`, e confirme que `reg.DataHora.Format(time.RFC3339)` tem o sufixo `-03:00` (não
`Z`), e que as horas/minutos batem com o que foi gravado.

## Achados adicionais a corrigir (Médio/Baixo, mais baratos)

### 7. `enabled: perfil === 'ADMIN'` faltando na query do frontend

`frontend/src/paginas/configuracoes/Auditoria.tsx`, o `useQuery` (chave `['auditoria',
filtros]`). Hoje ele dispara mesmo antes do `if (perfil !== 'ADMIN') return <mensagem>`
mais abaixo no componente — um não-admin que acesse a URL direto gera um `GET /auditoria`
que o backend corretamente rejeita com 403, mas é uma requisição desnecessária. Adicione
`enabled: perfil === 'ADMIN'` nas opções do `useQuery`.

### 8. Teste de 403 faltando para `/auditoria/exportar`, e perfil OPERADOR nunca testado

`backend/internal/api/handlers/auditoria_test.go` já tem
`TestListarAuditoriaComoGestorResponde403` para `GET /auditoria`, mas nada equivalente
para `GET /auditoria/exportar`, e nenhum teste com perfil `OPERADOR` (só `GESTOR` e
`ADMIN`/sem token aparecem). Adicione um teste de 403 para `/auditoria/exportar` com
perfil `GESTOR` (mesmo padrão do teste existente), e um teste com perfil `OPERADOR`
contra `GET /auditoria` confirmando 403 também.

### 9. Comentário desatualizado na migration 007 (não é uma nova migration, é uma correção de comentário no arquivo já aplicado — sem checksum de migração neste projeto, seguro editar)

`backend/internal/infra/db/migrations/007_criar_triggers_auditoria.sql`, no cabeçalho do
bloco da trilha, tem um comentário dizendo que "o usuario responsavel chega pela
variavel de sessao `pcp.usuario_id`, definida pelo middleware de autenticacao a cada
transacao" — isso nunca foi verdade (é o bug que esta sub-entrega corrigiu) e continua
impreciso mesmo depois da correção: quem define a variável é
`middleware.ConexaoDeAuditoria`, por REQUISIÇÃO (não por transação, e não é o middleware
de autenticação). Corrija o comentário para refletir a realidade atual.

### 10. Comentário sobre a invariante de composição do `Executor`

`backend/internal/infra/db/executor.go`. Hoje o comentário só descreve o caso feliz.
Adicione uma frase explicando a invariante que passou a existir com o pinning: se um
repositório chamar outro de dentro de uma transação aberta (`Begin(ctx)`), a chamada
interna agora roda DENTRO dessa transação (porque `DoContexto` devolve a mesma conexão
fixada), em vez de pegar uma conexão separada do pool como antes — então um `tx`
abortado faz a chamada interna falhar com "current transaction is aborted" em vez de
rodar isolada. Não precisa mudar código, só o comentário (confirmado pelo revisor: hoje
nenhum repositório faz essa composição, então não há bug a corrigir, só um contrato
implícito a documentar).

## Não corrigir agora (fora de escopo desta rodada, decisão já tomada)

Não implemente estes — foram avaliados e conscientemente adiados. Se concordar que
fazem sentido fora de escopo, apenas não toque neles:

- Filtro por usuário na tela de Auditoria (o backend já aceita `usuario_id`, mas não há
  nenhuma tela/endpoint de listagem de usuários no sistema ainda para popular um seletor
  — bloqueado pela mesma pendência de RBAC/Fase 2.2 já registrada no projeto).
- Redução de round-trips do middleware (hooks `AfterRelease`/`BeforeAcquire` do pgxpool)
  — otimização, não correção.
- Índice composto `(tabela, operacao, data_hora DESC)` — otimização de escala, não
  correção; a tabela ainda é pequena.
- Extrair um helper `db.DoContexto(ctx, r.pool)` repetido nos ~15 repositórios — só
  redução de duplicação, sem risco associado.
- O teste de exportação CSV que valida uma mensagem de erro que na prática nunca ocorre
  (`baixarArquivo` usa `responseType: 'blob'`, então a normalização de erro do axios não
  funciona como o teste assume) — é pré-existente e comum a TODAS as exportações CSV do
  sistema (estoque, pedidos de compra, auditoria), não algo introduzido por esta
  sub-entrega; corrigir isolado aqui deixaria as outras divergentes.
- Teste comparando `auditoria.TabelasAuditadas` contra os triggers reais do Postgres
  (`pg_trigger`) —ação de robustez, não bug.
- Props de ordenação inertes na tabela do frontend (`ordenarPor`/`ordem`/`aoOrdenar`) —
  cosmético, sem efeito funcional.

## Rodando os testes (via Docker, rede `pcp-lev_default`, já disponível)

Backend (build, vet, gofmt, suíte completa):

```bash
MSYS_NO_PATHCONV=1 docker run --rm --network pcp-lev_default \
  -e PCP_TEST_DSN="postgres://pcp_user:senha_segura@postgres:5432/pcp_db_test?sslmode=disable" \
  -e CGO_ENABLED=0 \
  -v "D:\PCP-Lev\.claude\worktrees\auditoria-verificacao-final\backend:/app" \
  -w /app golang:1.25-alpine \
  sh -c "go build ./... && go vet ./... && gofmt -l . && go test ./..."
```

Um `gofmt -l .` com saída não-vazia significa arquivos mal formatados — rode
`gofmt -w .` dentro do mesmo container antes de reexecutar.

Frontend (só se você tocar em `Auditoria.tsx` — lint, tsc, build, testes):

```bash
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "D:\PCP-Lev\.claude\worktrees\auditoria-verificacao-final\frontend:/app" \
  -w /app node:22-alpine \
  sh -c "npm ci --no-audit --no-fund && npm run lint && npx tsc -b && npm run build && npm test -- --run"
```

(`npm ci` reinstala `node_modules` do zero -- e normal levar alguns minutos.)

## Commits

Pode ser um commit único (ex.: `fix: corrige achados da revisao de codigo da Task F4
(Auditoria)`) ou um por área (backend/frontend/migration), como preferir — siga o estilo
dos commits já existentes no repositório (`git log --oneline -20` para referência). Não
faça `git push` nem abra PR — isso fica comigo depois que a revisão confirmar que os
achados foram endereçados.

## Relatório

Ao final, escreva um relatório em
`.superpowers/sdd/reviews/task-f4-fix-report.md` cobrindo, para cada um dos 10 itens
acima: o que foi feito, quais arquivos mudaram, e o resultado dos testes relevantes
(comando + resumo da saída). Depois responda com um dos quatro status (DONE /
DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED), a lista de commits criados, um resumo de
uma linha dos testes, e quaisquer dúvidas/decisões que você tomou e valeria eu revisar.
