# Plano — Fase 4, sub-entrega 1: Auditoria

Referência: `docs/0_SUMARIO_EXECUTIVO.md` §4.6.9, `docs/6_CRONOGRAMA_TECNICO.md` v2.1
(Fase 4, item 3). Branch: `feat/auditoria`, empilhada sobre `feat/dados-empresa` (PR
ainda aberto).

## Achado que muda o escopo desta sub-entrega

A trilha de auditoria (tabela `auditoria`, migration 007) já existe e já é alimentada
por triggers `AFTER INSERT OR UPDATE OR DELETE` nas tabelas de decisão de negócio. Os
triggers leem `usuario_id`/`endereco_ip` de variáveis de sessão do Postgres
(`current_setting('pcp.usuario_id', true)`), que **o código Go nunca definiu** —
confirmado por busca no repositório inteiro. Toda linha de auditoria gravada até hoje
tem `usuario_id` e `endereco_ip` sempre `NULL`, apesar de a doc 0 exigir "cobertura
obrigatória: usuário, data/hora, endereço IP...".

**Decisão do usuário**: corrigir isso agora, antes de construir a tela de consulta, em
vez de entregar uma tela com a coluna "usuário" sempre vazia.

## Por que a correção não é pequena

`pgxpool.Pool.Exec/Query/QueryRow` pode usar uma conexão física diferente do pool a
cada chamada. Definir a variável de sessão numa chamada e rodar o `INSERT` de negócio
(que dispara o trigger) em outra não funciona — precisa ser a **mesma conexão**.
A solução é fixar (`Acquire`) uma conexão do pool por requisição HTTP, gravar nela as
variáveis de sessão, e fazer todos os repositórios usarem essa conexão durante aquela
requisição em vez do pool compartilhado.

## Desenho da correção (sem mudar assinatura de nenhum método de repositório)

**`internal/infra/db/executor.go`** (novo):
```go
type Executor interface {
    Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
    Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
    QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
    Begin(ctx context.Context) (pgx.Tx, error)
}
```
`*pgxpool.Pool` e `*pgxpool.Conn` satisfazem esta interface com assinaturas idênticas —
é o que permite trocar um pelo outro sem tocar em nenhum método de domínio.

`ComExecutor(ctx, executor) context.Context` grava a conexão fixada no contexto;
`DoContexto(ctx, padrao) Executor` devolve a conexão do contexto se houver, senão
`padrao` (o pool compartilhado) — o mesmo caminho de hoje para testes, jobs em
background e qualquer chamada fora de uma requisição HTTP real. **Nenhum teste
existente precisa mudar**: `testsupport.BancoMigrado(t)` continua devolvendo um
`*pgxpool.Pool` puro, sem o valor no contexto, então `DoContexto` sempre cai no
fallback nesses casos.

**`internal/api/middleware/auditoria.go`** (novo): `ConexaoDeAuditoria(pool, tokens)`,
registrado **globalmente** em `routes.go` (não depende da ordem de outros
middlewares por rota — decodifica o JWT por conta própria, sem depender de
`middleware.Autenticacao` já ter rodado, já que essa é aplicada por rota/grupo, não
globalmente):
1. `pool.Acquire(ctx)` — fixa uma conexão para toda a requisição; `defer conn.Release()`.
2. Se houver um Bearer token válido, extrai `usuario_id`; senão, fica vazio (ex.:
   `POST /auth/login`, `GET /configuracoes/empresa` sem sessão).
3. `SELECT set_config('pcp.usuario_id', $1, false), set_config('pcp.endereco_ip', $2, false)`
   nessa conexão (`is_local = false`: vale para toda a sessão da conexão, sobrevive a
   múltiplas transações dentro da mesma requisição, não só a uma).
4. Grava a conexão no contexto da requisição (`db.ComExecutor`) e segue para o handler.
5. Ao final (sucesso ou erro), reseta as variáveis antes de `Release()` — sem isso, a
   próxima requisição a reaproveitar essa conexão do pool herdaria usuário/IP alheios.
6. Falha ao adquirir conexão ou gravar as variáveis não bloqueia a requisição (a
   auditoria é best-effort; os repositórios caem de volta para o pool compartilhado).

**Repositórios** (10 arquivos, ~60 pontos de chamada): troca mecânica de
`r.pool.Exec/Query/QueryRow/Begin(ctx, ...)` para
`db.DoContexto(ctx, r.pool).Exec/Query/QueryRow/Begin(ctx, ...)`. `tx.Exec(...)` dentro
de uma transação já aberta (após `Begin`) não muda — a transação já nasce ancorada na
conexão certa, porque `Begin` passou pelo `DoContexto`.

**Custo de desempenho aceito conscientemente**: cada requisição HTTP passa a segurar
uma conexão do pool durante toda a sua duração (hoje, cada chamada ao pool pega e
devolve uma conexão isoladamente). Com `DB_MAX_CONNS=20` (padrão) e o perfil de uso do
projeto (~20 operadores + 1 gestor, doc 0 §3), a concorrência esperada fica bem abaixo
do limite do pool — não é um ajuste de capacidade necessário agora, só uma
característica a monitorar se o número de usuários crescer.

- [ ] Teste: `db.DoContexto` sem valor no contexto devolve o `padrao`; com valor,
  devolve o executor gravado.
- [ ] Teste de integração (via `apiProtegida`, HTTP real): criar um fornecedor
  autenticado como Gestor e conferir que a linha correspondente em `auditoria` tem
  `usuario_id` e `endereco_ip` preenchidos (hoje sempre `NULL`).
- [ ] Suite completa do backend roda sem nenhuma mudança nos testes de repositório
  existentes (a mudança é só de onde a conexão vem, não do que cada método faz).
- [ ] Commit: `fix(backend): fixa conexao por requisicao para a trilha de auditoria`

## Domínio e API de consulta (depois da correção acima)

### Task B1: domínio `auditoria`

**Files:** `backend/internal/domain/auditoria/auditoria.go`, `servico.go` (+ testes)

Só leitura — sem `Dados`/`Validar`, mesmo molde de `necessidadecompra`. `Registro`
(id, tabela, operação, registro_id, dados_antigos/novos como `json.RawMessage`,
usuario_id + nome do usuário resolvido via join, data_hora, endereco_ip). `Filtros`
(DataInicio/DataFim *time.Time, UsuarioID *int64, Tabela, Operacao string, mais
`consulta.Parametros` para paginação).

### Task B2: repositório

**Files:** `backend/internal/infra/repository/auditoria_repo.go` (+ teste)

`Listar(ctx, filtros) ([]Registro, int, error)` — `LEFT JOIN usuarios` (usuario_id pode
ser `NULL` para ações do sistema/pré-correção) e filtros opcionais compostos
dinamicamente (mesmo padrão de `WHERE` condicional já usado em `estoque_repo.go`/
`pedido_compra_repo.go`). `ListarParaExportar(ctx, filtros) ([]Registro, error)` sem
paginação, para o CSV — mesmo padrão de `ListarParaRelatorio` da Fase 2.4.

### Task B3: handler + rotas

```
GET /api/v1/auditoria          -- paginado, filtros: data_inicio, data_fim,
                                   usuario_id, tabela, operacao
GET /api/v1/auditoria/exportar -- CSV, mesmos filtros, sem paginação
```

Restrito a perfil Administrador (`middleware.ExigirPerfil(usuario.PerfilAdmin)`) — é o
mesmo nível de acesso de Dados da Empresa, e a doc 0 já classifica "acessar módulo de
configurações" como permissão sensível.

- [ ] Teste: filtros combinados, paginação, 403 para não-admin, export CSV com BOM/`;`
  (mesmo padrão de `responderCSV` da Fase 2.4).
- [ ] Commit: `feat(backend): consulta e exportacao da trilha de auditoria`

---

## Frontend

### Task F1: tipos e serviço

**Files:** `frontend/src/tipos/auditoria.ts`, `frontend/src/servicos/auditoria.ts`

### Task F2: tela de consulta

**Files:** `frontend/src/paginas/configuracoes/Auditoria.tsx` (+ teste)

Tabela paginada (reaproveita o componente `Tabela`) com filtros: período (dois
`Campo` de data), usuário (dropdown — reaproveita a listagem de usuários se existir,
senão um campo de id livre por enquanto, já que não há tela de gestão de usuários
ainda), tabela/módulo (dropdown com as tabelas auditadas) e tipo de ação
(Incluído/Alterado/Excluído — nomes de exibição, não os valores crus do banco).
Cada linha expande (ou abre um modal) mostrando o diff entre `dados_antigos` e
`dados_novos` campo a campo — não o JSON cru, que é ilegível para quem não é
desenvolvedor. Botão "Exportar CSV" no mesmo molde de Estoque/Pedidos de Compra.
Restrita a `perfil === 'ADMIN'`, mesmo padrão de acesso de `DadosEmpresa.tsx`.

- [ ] Teste: filtros combinados enviam os parâmetros certos; diff mostra campo a campo;
  acesso restrito para não-admin.
- [ ] Commit: `feat(frontend): tela de consulta de auditoria`

### Task F3: navegação e ajuda

**Files:** `App.tsx`, `NavegacaoLateral.tsx` (+ teste), `Ajuda.tsx`

Rota `/configuracoes/auditoria`, no mesmo grupo "Configurações" de Dados da Empresa,
visível só para Admin.

### Task F4: verificação final

- [ ] `npm test`/`lint`/`tsc`/`build` e suíte de backend completos, via Docker.
- [ ] `code-reviewer` (background) sobre o diff completo do branch — atenção especial
  ao pinning de conexão (é a parte de maior risco desta sub-entrega, toca todo
  repositório do sistema).
- [ ] Roteiro Playwright: criar/editar um fornecedor autenticado, abrir Auditoria,
  confirmar que a linha aparece com o usuário certo e o diff correto; exportar CSV;
  trocar para perfil não-admin e confirmar acesso restrito.
- [ ] Screenshots, atualizar manual e ledger, commit final, push, link de PR.
