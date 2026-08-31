# Relatório: correção dos achados da revisão de código (Task F4, sub-entrega Auditoria)

Branch: `chore/auditoria-verificacao-final` (worktree `D:\PCP-Lev\.claude\worktrees\auditoria-verificacao-final`).
Todos os 10 itens do brief `task-f4-fix-brief.md` foram implementados. Nenhum item
fora de escopo foi tocado.

---

## 1. CRÍTICO — Pool de conexões esgota com qualquer tráfego

**O que foi feito.** `ConexaoDeAuditoria` passa a sair antes de qualquer `Acquire`
quando o método é `GET`, `HEAD` ou `OPTIONS` — os triggers da migration 007 só
disparam em `INSERT`/`UPDATE`/`DELETE`, então nenhuma requisição de leitura precisa
de conexão fixada. Isso remove também o vetor de 404 sem autenticação (o Echo aplica
middlewares globais ao `NotFoundHandler`). O `pool.Acquire` restante usa um contexto
derivado do da requisição com timeout de 3s (`tempoLimiteFixarConexao`), caindo no
fallback já existente (`slog.Error` + `return proximo(c)`) em vez de enfileirar
indefinidamente quando o pool está saturado.

**Arquivos.** `backend/internal/api/middleware/auditoria.go`.

**Testes.** Novos, em `backend/internal/api/middleware/auditoria_test.go`:
- `TestGETNaoFixaConexaoDoPool` — o handler de um GET vê o pool compartilhado em
  `db.DoContexto`, provando que nada foi fixado no contexto.
- `TestRotaInexistenteNaoFixaConexaoDoPool` — 30 GETs para rota inexistente não
  incrementam `pool.Stat().AcquireCount()`.
- `TestSaudeRespondeSemToken` (`internal/api/routes_test.go`, pré-existente) continua
  passando; `/saude` não precisou de alteração.

## 2. ALTO — Fallback pode gravar auditoria com o usuário errado; panic pula o RESET

**O que foi feito.** Os dois `RESET` deixaram de rodar depois de `proximo(c)` e passaram
para um `defer` registrado logo após o `Acquire` bem-sucedido, **depois** do
`defer conexao.Release()` — por LIFO, ele executa primeiro e a conexão só volta ao pool
já limpa. Cobre as três saídas: retorno normal, o early-return de erro do `set_config`
e o unwind de um `panic` (o `echomw.Recover()` está antes deste middleware na cadeia).
Com isso, mesmo no pior caso (Acquire falhou e o repositório caiu para o pool
compartilhado) a conexão nunca carrega usuário/IP de uma requisição anterior: na pior
hipótese o registro fica NULL, nunca atribuído a outro usuário.

**Arquivos.** `backend/internal/api/middleware/auditoria.go`.

**Testes.** Novos, em `backend/internal/api/middleware/auditoria_test.go`, montando um
Echo com a mesma cadeia da aplicação real (`Recover` antes de `ConexaoDeAuditoria`) sobre
`testsupport.BancoMigrado` — banco e triggers reais, sem mock:
- `TestPanicNoHandlerNaoDeixaUsuarioNaConexao` — POST autenticado que escreve e entra em
  panic; em seguida uma escrita que roda no **pool compartilhado** (um GET, que agora não
  fixa conexão) e que, pelo reuso LIFO do pgxpool, pega a mesma conexão física. A linha de
  auditoria dessa segunda escrita tem que ficar NULL.
  **Verificado que o teste discrimina**: desativando temporariamente o corpo do `defer`,
  ele falha com `Expected nil, but got: (*int64)` — ou seja, sem a correção a trilha
  registrava o usuário da requisição que quebrou.
- `TestRequisicaoSemTokenNaoHerdaUsuarioDaAnterior` — caminho feliz (POST autenticado,
  depois POST sem token na mesma conexão) grava NULL.
- `TestUsuariosDiferentesEmSequenciaNaoSeMisturam` — três requisições com usuários
  diferentes em sequência; cada linha da trilha fica com o usuário da própria requisição.

## 3. ALTO — IP da auditoria é forjável (`X-Forwarded-For` sem proxies confiáveis)

**O que foi feito.** `e.IPExtractor = echo.ExtractIPFromXFFHeader(TrustLoopback(true),
TrustLinkLocal(true), TrustPrivateNet(true))` em `NovoRoteador`, logo após criar o Echo e
antes do primeiro `e.Use`. O XFF passa a ser aceito só quando o hop imediato é
loopback/link-local/RFC1918 (o nginx do `docker-compose.yml`, na rede Docker), e é ignorado
quando a requisição chega direto da internet. Corrige de graça o mesmo problema em
`middleware.Log()`, que também usa `c.RealIP()`.

**Arquivos.** `backend/internal/api/routes.go`.

**Testes.** `TestRequisicaoAutenticadaGravaUsuarioEIPNaAuditoria` (`routes_test.go`, sem
alteração) continua passando: sem cabeçalho XFF e com `RemoteAddr` público
(`203.0.113.7:54321`), o extrator cai no RemoteAddr e a auditoria grava `203.0.113.7`.

## 4. ALTO — `senha_hash` vaza pela API/tela de auditoria

**O que foi feito.** Introduzido `camposSensiveisPorTabela map[string][]string`
(`{"usuarios": {"senha_hash"}}`) e a função `semCamposSensiveis`, aplicadas em
`normalizarRegistro`, por onde passam **as duas** consultas (`Listar` e
`ListarParaExportar`). Implementação com `encoding/json`: unmarshal para
`map[string]json.RawMessage`, `delete` das chaves, remarshal só se algo foi removido
(payload nulo — INSERT sem `dados_antigos`, DELETE sem `dados_novos` — ou sem a chave
passa intacto, sem custo). Se o payload não for um objeto JSON (não deve acontecer com
`to_jsonb`), o retorno é `nil`: falha fechada, para não haver chance de o hash escapar.

**Arquivos.** `backend/internal/infra/repository/auditoria_repo.go`.

**Testes.** `TestListarOmiteSenhaHashDosDadosDeUsuario`
(`auditoria_repo_test.go`): faz `UPDATE usuarios SET nome = ...`, lê pelo `Listar` e
confirma que `senha_hash` não aparece em `DadosAntigos` nem em `DadosNovos`, enquanto
`nome` continua presente e com o valor novo.

## 5. ALTO — Exportação CSV busca colunas pesadas que não usa

**O que foi feito.** Nova constante `colunasAuditoriaExportacao` (igual a
`colunasAuditoria`, sem `a.dados_antigos, a.dados_novos`) e `lerRegistrosParaExportar`
com o scan correspondente. `Registro.DadosAntigos`/`DadosNovos` ficam no zero-value nos
itens devolvidos por `ListarParaExportar` — confirmado antes da mudança que o handler de
CSV (`handlers/auditoria.go`, montagem das linhas) não lê nenhum dos dois. Para não
duplicar o laço, `lerRegistros` e `lerRegistrosParaExportar` compartilham
`lerLinhasDeAuditoria`, que recebe o scan de cada consulta e aplica o pós-processamento
comum (fuso + campos sensíveis) — assim listagem e exportação não podem divergir nesses
dois pontos.

O `LIMIT` continua ausente de propósito: é o padrão já estabelecido das outras exportações
CSV do sistema (estoque, pedidos de compra), como o brief registra.

**Arquivos.** `backend/internal/infra/repository/auditoria_repo.go`.

**Testes.** `TestListarParaExportarNaoPaginaEDevolveTodosOsRegistros` ganhou a asserção de
que `DadosNovos`/`DadosAntigos` vêm vazios na exportação;
`TestExportarAuditoriaCSVComoAdminRespondeArquivo` (handlers) continua passando, com BOM e
conteúdo esperados.

## 6. ALTO — Data/hora aparece 3 horas errada na tela (diverge do CSV)

**O que foi feito.** Em `normalizarRegistro`, o `reg.DataHora` é reconstruído com
`time.Date(...)` mantendo **os mesmos dígitos de wall-clock** e trocando apenas o
`Location` para `fusoDeGravacao = time.FixedZone("America/Sao_Paulo", -3*60*60)`. É
reetiquetagem, não conversão: o JSON passa a sair `...T10:00:00-03:00` (instante absoluto
correto) e o `Format("2006-01-02 15:04:05")` do CSV imprime exatamente os mesmos dígitos
de antes. O comentário no código registra a premissa (Postgres com `TZ=America/Sao_Paulo`
no `docker-compose.yml`; offset fixo porque o Brasil não observa horário de verão desde
2019) e aponta o ponto a revisitar se isso mudar.

Os filtros `DataInicio`/`DataFim` (`condicoesDeAuditoria`) **não** foram tocados,
conforme o brief. O `Auditoria.tsx` também não precisou de mudança de lógica — só
atualizei o comentário do `formatarDataHora`, que ainda dizia "a API guarda em UTC".

**Arquivos.** `backend/internal/infra/repository/auditoria_repo.go`,
`frontend/src/paginas/configuracoes/Auditoria.tsx` (comentário).

**Testes.** `TestListarDevolveDataHoraNoFusoDeGravacao` (`auditoria_repo_test.go`): grava
um evento, lê o `data_hora` cru direto da tabela, lê o mesmo registro pelo `Listar` e
confirma (a) sufixo `-03:00` no `Format(time.RFC3339)`, (b) dígitos de hora idênticos aos
gravados — o que também prova que a saída do CSV não mudou —, (c) offset de `-10800s`.

## 7. `enabled: perfil === 'ADMIN'` na query do frontend

**O que foi feito.** Adicionado `enabled: perfil === 'ADMIN'` às opções do `useQuery`
(chave `['auditoria', filtros]`), com comentário. Um não-admin que abra a URL direto não
dispara mais o `GET /auditoria` que o backend rejeitaria com 403.

**Arquivos.** `frontend/src/paginas/configuracoes/Auditoria.tsx`.

**Testes.** Suíte do frontend (`Auditoria.test.tsx` inclusive) — o caso
"acesso restrito a administradores" não fazia asserção sobre requisições, então continua
válido.

## 8. Testes de 403 faltando

**O que foi feito.** Três testes novos em `backend/internal/api/handlers/auditoria_test.go`,
no mesmo padrão do `TestListarAuditoriaComoGestorResponde403` existente:
- `TestExportarAuditoriaCSVComoGestorResponde403`
- `TestExportarAuditoriaCSVComoOperadorResponde403`
- `TestListarAuditoriaComoOperadorResponde403`

O perfil `OPERADOR`, que nunca aparecia nos testes deste módulo, agora é exercitado nas
duas rotas.

## 9. Comentário desatualizado na migration 007

**O que foi feito.** O cabeçalho do bloco da trilha dizia que o usuário chega por
`pcp.usuario_id` "definida pelo middleware de autenticacao a cada transacao" — nunca foi
verdade e continua impreciso depois da correção. Reescrito: quem define
`pcp.usuario_id`/`pcp.endereco_ip` é `middleware.ConexaoDeAuditoria`, uma vez **por
requisição HTTP**, numa conexão fixada do pool que os repositórios daquela requisição
reaproveitam; leituras, jobs e migrations não definem as variáveis e geram linhas com
usuário/IP NULL, que é o comportamento esperado.

**Arquivos.** `backend/internal/infra/db/migrations/007_criar_triggers_auditoria.sql`
(somente comentário — o projeto não usa checksum de migração, e o arquivo já aplicado não
muda de efeito).

## 10. Invariante de composição do `Executor`

**O que foi feito.** Adicionado ao comentário de `DoContexto` o contrato implícito criado
pelo pinning: como todos os repositórios de uma requisição recebem a mesma conexão, um
repositório que chame outro de dentro de uma transação aberta com `Begin(ctx)` faz a
chamada interna rodar **dentro** dessa transação — antes ela pegaria uma conexão separada
do pool. Consequência prática documentada: com o `tx` externo abortado, a chamada interna
falha com "current transaction is aborted", e o que ela gravar entra no mesmo
commit/rollback. Nenhuma mudança de código (hoje nenhum repositório faz essa composição).

**Arquivos.** `backend/internal/infra/db/executor.go`.

---

## Resultado dos testes

### Backend — build, vet, gofmt e suíte completa

```
MSYS_NO_PATHCONV=1 docker run --rm --network pcp-lev_default \
  -e PCP_TEST_DSN="postgres://pcp_user:senha_segura@postgres:5432/pcp_db_test?sslmode=disable" \
  -e CGO_ENABLED=0 \
  -v "<worktree>\backend:/app" -w /app golang:1.25-alpine \
  sh -c "go build ./... && go vet ./... && gofmt -l . && go test ./..."
```

`go build` e `go vet` sem saída; `gofmt -l .` sem saída (nenhum arquivo mal formatado).
Suíte completa: **todos os 24 pacotes `ok`**, nenhum `FAIL`.

```
ok  internal/api                        5.6s
ok  internal/api/handlers             195.9s
ok  internal/api/middleware            12.0s
ok  internal/domain/auditoria           0.0s
ok  internal/domain/auth               37.5s
ok  internal/domain/cotacao            27.4s
ok  internal/domain/empresa            14.7s
ok  internal/domain/estoque             4.2s
ok  internal/domain/estrutura          21.7s
ok  internal/domain/fornecedor         27.9s
ok  internal/domain/necessidadecompra  12.4s
ok  internal/domain/peca               21.9s
ok  internal/domain/pedidocompra       32.9s
ok  internal/domain/produto            27.9s
ok  internal/domain/usuario             1.8s
ok  internal/infra/db                  17.4s
ok  internal/infra/repository          74.9s
ok  internal/config, internal/platform/* (consulta, dinheiro, documento, httpx, tempo)
?   cmd/api, internal/testsupport      [no test files]
```

### Frontend — lint, tsc, build e testes

```
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "<worktree>\frontend:/app" -w /app node:22-alpine \
  sh -c "npm ci --no-audit --no-fund && npm run lint && npx tsc -b && npm run build && npm test -- --run"
```

Comando único, exit code **0**. `eslint` sem achados; `tsc -b` sem erros; `vite build`
concluído em 54.56s (só o aviso pré-existente de chunk > 500 kB). Testes:

```
Test Files  61 passed (61)
Tests      393 passed (393)
Duration   1044.07s
```

Nenhum teste falhou nem foi pulado; `Auditoria.test.tsx` e `servicos/auditoria.test.ts`
passam sem alteração (o caso "acesso restrito a administradores" não fazia asserção sobre
requisições, então o `enabled` não o afeta).

---

## Commits criados (branch `chore/auditoria-verificacao-final`)

| Commit | Mensagem | Itens |
| --- | --- | --- |
| `403973c` | `fix(backend): protege o pool e a atribuicao de usuario na auditoria` | 1, 2, 3, 9, 10 |
| `d64a265` | `fix(backend): remove senha_hash, corrige o fuso e alivia a exportacao da auditoria` | 4, 5, 6 |
| `60b1d79` | `test(backend): cobre 403 da auditoria para gestor na exportacao e para operador` | 8 |
| `2433c44` | `fix(frontend): nao consulta a auditoria quando o perfil nao e ADMIN` | 7, comentário do item 6 |

Nenhum `git push` e nenhum PR, conforme o brief.

---

## Decisões e observações que valem revisão

1. **Premissa do fuso (item 6).** A reetiquetagem para `-03:00` está correta enquanto o
   Postgres rodar com `TZ=America/Sao_Paulo` (é o que o `docker-compose.yml` define). Num
   ambiente onde o servidor de banco rode em UTC, a mesma reetiquetagem passaria a produzir
   um instante absoluto 3h errado. A correção definitiva seria migrar a coluna para
   `TIMESTAMPTZ`, o que está fora do escopo desta rodada; deixei a premissa comentada no
   código, no ponto exato a revisitar.
2. **`TestRotaInexistenteNaoFixaConexaoDoPool`** compara `pool.Stat().AcquireCount()` antes
   e depois de 30 GETs. É determinístico no uso sequencial do teste, mas depende de o
   health-check em segundo plano do pgxpool (período padrão de 1 minuto) não tocar o
   contador no meio — o teste roda em milissegundos, então a janela é desprezível. Se
   algum dia der flake, a saída é comparar apenas a diferença contra um limite pequeno.
3. **Rota de teste que escreve num GET.** O `ambienteDeAuditoria` do teste de middleware
   expõe um `GET /escreve` e um `POST /panico` que não existem em produção. São o único
   jeito de exercitar, respectivamente, uma escrita que roda no pool compartilhado e um
   handler que quebra no meio — o teste monta seu próprio Echo justamente para isso, com a
   mesma ordem de middlewares de `api.NovoRoteador`.
4. **Fail-closed em `semCamposSensiveis`.** Se o JSONB não desserializar como objeto, o
   payload inteiro é descartado (`nil`) em vez de devolvido cru. Com `to_jsonb(OLD/NEW)`
   isso não deve acontecer; a escolha é deliberada porque não dá para garantir que o hash
   não está lá dentro.
5. **Arquivos não commitados nesta rodada.** O worktree já tinha alterações pendentes
   alheias a este trabalho (`.superpowers/sdd/progress.md`, `docs/8_MANUAL_OPERACAO.md`,
   `docs/screenshots/40-auditoria-lista.png`, `docs/screenshots/41-auditoria-detalhe-diff.png`)
   — não foram tocadas nem incluídas nos commits.
