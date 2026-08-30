# Estrutura de Produto (BOM) — desenho

Referências: `docs/1_ESPECIFICACAO_REQUISITOS.md` (RF1.3, RN4), `docs/3_ESPECIFICACAO_APIS.md`
(§ESTRUTURA_PRODUTO), migration `001_criar_tabelas_base.sql` (`estrutura_produto` +
`itens_estrutura_produto`, já existente desde o Sprint 1 — sem migration nova nesta
tarefa).

## 1. Problema

O cadastro de BOM (Bill of Materials) estava previsto no Sprint 2 (Cadastros Base, Semana
4 do cronograma), mas nunca foi implementado — só Fornecedores, Partes/Peças e Produtos
Acabados foram entregues. O schema já existe e já impõe as regras de negócio (RN4: só uma
versão ativa por produto, `versao` único por produto), mas não há domínio, repositório,
handler nem tela para isso. Isso bloqueia o Sprint 6 (Produção): a migration
`005_criar_tabelas_producao.sql` exige `estrutura_produto_id` como chave estrangeira
obrigatória em toda Ordem de Produção — sem BOM, nenhuma OP pode ser criada.

## 2. Escopo

**Dentro:**
- CRUD de BOM de um nível (Produto Acabado → lista de Partes/Peças com quantidade),
  exatamente como o schema já modela.
- Versionamento: criar a primeira versão de um produto; criar uma nova versão que
  substitui (inativa) a anterior; consultar o histórico de versões.
- Nova seção "Estrutura de produtos" no menu lateral, com tela de listagem (escolher o
  produto, ver o status da BOM) e tela de detalhe/versionamento.

**Fora, com o motivo:**
- BOM multinível (produto acabado usando outro produto acabado como componente) — o
  RF1.3 sugere isso ("mapeamento multinível"), mas o schema já existente só referencia
  Partes/Peças em `itens_estrutura_produto`, não outros Produtos Acabados. Mudar isso
  exigiria alterar schema, fora do escopo de uma tarefa de cadastro — decisão validada
  com o usuário. Se o domínio real precisar de submontagens no futuro, é uma migration
  e um desenho à parte.
- Edição de uma BOM existente in-place — não existe na API (doc 3 só define criar e
  versionar, nunca `PUT`), e contraria a regra "BOM não pode ser deletada, apenas
  inativada" (RF1.3): mudar o conteúdo de uma versão já usada por OPs passadas
  corromperia a rastreabilidade histórica.
- Geração automática de necessidade de compra a partir da BOM (RF3.2) — depende de OPs
  (Sprint 5/6), fora de escopo aqui.

## 3. Decisões tomadas

1. **Navegação em seção própria**, não aninhada em Produtos Acabados — decisão do
   usuário, mesmo optando por duplicar o passo "escolher um produto" que a tela de
   Produtos Acabados já resolve.
2. **`GET /produtos-acabados` ganha um campo aditivo `estrutura_ativa`** (`{ versao,
   data_vigencia_inicio } | null`, `omitempty`) em vez de um endpoint novo e paralelo só
   para "produtos com status de BOM" — reaproveita a listagem já paginada/filtrada do
   Sprint 2, e é uma mudança compatível com quem já consome esse endpoint (a tela
   `ProdutosAcabados.tsx` não muda, só ignora o campo novo).
3. **Ao versionar, a versão anterior ganha `data_vigencia_fim` automaticamente** (um dia
   antes do início de vigência da nova) — não é exigido literalmente pela RN4, mas
   melhora a rastreabilidade do histórico (cada versão passa a ter um intervalo de
   vigência fechado, não só uma data de início solta). Confirmado com o usuário.
4. **Sem validação de "produto deve estar ativo" para criar/versionar BOM** — o RF1.3
   só exige "PA deve existir", não "PA deve estar ativo"; nenhuma sprint anterior valida
   essa combinação para os módulos análogos (cotação/PC contra fornecedor inativo, por
   exemplo), então não introduzir aqui uma regra nova sem lastro explícito.
5. **Peças no seletor de itens são só as ativas** (reaproveita `usePartesPecasAtivas`,
   já existente do Sprint 3) — mesmo padrão de Cotação/Pedido de Compra.

## 4. Arquitetura

### 4.1 Domínio `estrutura` (backend)

Pacote novo `backend/internal/domain/estrutura`, mirror de `cotacao`:

```go
type Item struct {
    ID          int64
    PartePecaID int64
    Quantidade  int
}

type Estrutura struct {
    ID                 int64
    ProdutoAcabadoID   int64
    Versao             int
    DataVigenciaInicio tempo.Data
    DataVigenciaFim    tempo.Data // omitzero — nulo enquanto ativa
    Ativo              bool
    Itens              []Item
    CreatedAt, UpdatedAt time.Time
    CreatedBy, UpdatedBy *string
}

type ItemDados struct {
    PartePecaID int64
    Quantidade  int
}

// Dados serve tanto Criar quanto Versionar. ProdutoAcabadoID é lido do corpo
// da requisição em Criar (POST /boms, onde a doc 3 já inclui o campo no
// mesmo JSON de itens/vigência); em Versionar ele é ignorado pelo Servico —
// o produto é derivado da estrutura ativa em idAtual, nunca do corpo.
type Dados struct {
    ProdutoAcabadoID   int64
    DataVigenciaInicio tempo.Data
    DataVigenciaFim    tempo.Data
    Itens              []ItemDados
}
```

Erros: `ErrProdutoAcabadoObrigatorio`, `ErrProdutoAcabadoInexistente`,
`ErrItensObrigatorios`, `ErrQuantidadeInvalida`, `ErrPartePecaInexistente`,
`ErrDataVigenciaObrigatoria`, `ErrDataVigenciaFimInvalida` (fim < início),
`ErrVigenciaAnteriorAAtual` (em `Versionar`, quando a nova `data_vigencia_inicio` não é
posterior à vigência de início da estrutura sendo substituída — evita gravar um
intervalo de datas invertido no histórico),
`ErrJaPossuiEstruturaAtiva` (mapeia a violação do índice único parcial
`uk_estrutura_ativa_por_pa` — sinaliza para usar `Versionar`, não `Criar`, de novo),
`ErrStatusInvalidoParaAcao` (tentar versionar uma estrutura que não é mais a ativa),
`ErrNaoEncontrado`.

`Servico`:
- `Criar(ctx, dados, autor) (*Estrutura, error)` — usa `dados.ProdutoAcabadoID`;
  `versao=1`, `ativo=true`.
- `Versionar(ctx, idAtual, dados, autor) (*Estrutura, error)` — busca a estrutura em
  `idAtual`; se `Ativo == false`, `ErrStatusInvalidoParaAcao` (só a versão corrente pode
  ser substituída); cria a nova com `versao = max(versao do mesmo produto)+1` e
  `ativo=true`; marca a antiga `ativo=false` e grava `data_vigencia_fim` (um dia antes do
  início da nova); tudo numa transação.
- `BuscarPorID(ctx, id) (*Estrutura, error)`.
- `ListarPorProduto(ctx, produtoAcabadoID) ([]Estrutura, error)` — histórico completo,
  ordenado por `versao DESC`, sem paginação (lista curta por natureza).

### 4.2 Repositório (Postgres)

`backend/internal/infra/repository/estrutura_repo.go` — mesmo padrão transacional de
`cotacao_repo.go` (`Criar`/`Versionar` gravam header+itens numa tx só).
`violouIndiceUnico(err, "uk_estrutura_ativa_por_pa")` → `ErrJaPossuiEstruturaAtiva`;
`violouChaveEstrangeira` → `ErrProdutoAcabadoInexistente`/`ErrPartePecaInexistente`
conforme a constraint que disparou.

### 4.3 `ProdutoRepositorio.Listar` ganha o campo aditivo

`backend/internal/infra/repository/produto_repo.go` (já existente) — `Listar` passa a
fazer um `LEFT JOIN estrutura_produto ep ON ep.produto_acabado_id = p.id AND ep.ativo`
para preencher `EstruturaAtiva *EstruturaResumo` (`{Versao int; DataVigenciaInicio
tempo.Data}`, `nil` quando não há BOM ativa) no struct `produto.ProdutoAcabado`. Campo
novo, `json:"estrutura_ativa,omitempty"` — não quebra nenhum consumidor existente.

### 4.4 Endpoints (HTTP)

| Rota | Handler | Perfil |
|---|---|---|
| `POST /api/v1/boms` | criar 1ª versão (`{produto_acabado_id, data_vigencia_inicio, data_vigencia_fim?, itens}`) | Admin/Gestor |
| `GET /api/v1/produtos-acabados/{id}/boms` | histórico completo do produto | qualquer autenticado |
| `GET /api/v1/boms/{id}` | detalhe de uma versão (com itens) | qualquer autenticado |
| `POST /api/v1/boms/{id}/versionar` | nova versão (`{data_vigencia_inicio, data_vigencia_fim?, itens}`), inativa a de `{id}` | Admin/Gestor |

Erros mapeados: `ErrNaoEncontrado`→404, `ErrJaPossuiEstruturaAtiva`/
`ErrStatusInvalidoParaAcao`→409 (conflito de estado), os demais `Err*`→400.

### 4.5 Frontend

- `frontend/src/tipos/estrutura.ts`, `servicos/estrutura.ts` — mirror de `compras.ts`:
  `criarEstrutura`, `versionarEstrutura`, `listarEstruturasPorProduto`,
  `obterEstrutura`.
- **`/estrutura-produtos`** (nova, lista): reaproveita `GET /produtos-acabados` (já
  existente) via um hook próprio ou o `useListagem` genérico já usado por
  `ProdutosAcabados.tsx`; coluna nova "Estrutura" mostrando "v.N desde DD/MM/AAAA" (via
  `formatarData`) ou "Sem estrutura ativa". Clicar na linha navega para o detalhe.
- **`/estrutura-produtos/:produtoId`** (detalhe + histórico): cabeçalho do produto
  (código, descrição), a versão ativa (tabela de itens: peça, quantidade), botão "Criar
  estrutura" (sem BOM ainda) ou "Nova versão" (já existe uma ativa), seção "Histórico"
  com as versões anteriores (somente leitura: versão, vigência de-até).
- **`/estrutura-produtos/:produtoId/nova`** (formulário, página cheia — mesmo padrão de
  `NovaCotacao.tsx`): `useFieldArray` para os itens, seletor de peça via
  `usePartesPecasAtivas` (já existente), campo de quantidade por item, data de vigência
  início/fim. O mesmo formulário atende os dois casos (criar 1ª versão ou nova versão) —
  só o endpoint de destino muda (`POST /boms` vs `POST /boms/{idAtual}/versionar`),
  resolvido por uma prop/estado que sabe se já existe uma estrutura ativa.
- `NavegacaoLateral`: nova seção "Estrutura de produtos". `Ajuda`: conteúdo novo,
  cobrindo o fluxo criar → nova versão → histórico.

### 4.6 Erros e validação

Mesma convenção das sprints anteriores: sentinelas de domínio mapeadas por
`mapaDeErros`, `validator` com `dive` nos itens, `noValidate` no formulário desde o
início.

## 5. Testes

TDD, sem mocks (`testsupport.BancoMigrado`), mesmo rigor das sprints anteriores.
Casos-chave:

- Criar a 1ª estrutura de um produto (versão 1, ativa).
- Criar uma 2ª estrutura direto (via `Criar`, não `Versionar`) para um produto que já
  tem uma ativa falha com `ErrJaPossuiEstruturaAtiva`.
- `Versionar` troca a ativa corretamente: a antiga vira histórica (`ativo=false`,
  `data_vigencia_fim` preenchida), a nova fica ativa com `versao` incrementada.
- `Versionar` uma estrutura que não é mais a ativa (já superada por uma versão
  posterior) falha com `ErrStatusInvalidoParaAcao`.
- Item com `parte_peca_id` inexistente falha (`ErrPartePecaInexistente`); quantidade
  ≤ 0 falha (`ErrQuantidadeInvalida`); zero itens falha (`ErrItensObrigatorios`).
- `GET /produtos-acabados` continua funcionando exatamente como antes para quem não lê
  o campo novo — suíte inteira do Sprint 2 (`produto`) permanece verde.
- Frontend: lista de "Estrutura de produtos" mostra "Sem estrutura ativa" vs "v.N desde
  X" corretamente; formulário de criar/nova versão envia o corpo certo para o endpoint
  certo conforme o estado do produto; histórico lista as versões antigas.
- Verificação final (mesmo roteiro das sprints anteriores): suíte + lint + build,
  Playwright real cobrindo criar BOM → versionar → conferir histórico, checagem de
  grayscale/teclado/800px, passo "tirar um acessório".

## 6. Verificação antes de entregar

- `go build/vet/test ./...` e `npm test`/`lint`/`build` — todos verdes, incluindo a
  suíte inteira já existente (backend e frontend não devem regredir).
- Fluxo manual ponta a ponta contra Postgres real: criar produto → `/estrutura-produtos`
  mostra "Sem estrutura ativa" → criar BOM com 2-3 itens → detalhe mostra a versão 1
  ativa → criar nova versão com itens diferentes → detalhe mostra v.2 ativa, histórico
  mostra v.1 com `data_vigencia_fim` preenchida.
- Screenshots em `docs/screenshots/` (numeração sequencial), `docs/8_MANUAL_OPERACAO.md`
  ganha a seção de Estrutura de produtos, `.superpowers/sdd/progress.md` e os
  `task-N-brief.md`/`task-N-report.md` atualizados incrementalmente por tarefa — mesma
  disciplina já corrigida nas Sprints 2-4.

## 7. Riscos

- **Campo aditivo em `ProdutoRepositorio.Listar` muda uma query já em produção.** Risco
  mitigado por ser um `LEFT JOIN` (nunca reduz linhas retornadas) e um campo de resposta
  novo com `omitempty` (nunca quebra um consumidor que ignora campos desconhecidos) — a
  suíte existente do pacote `produto`/`handlers` precisa continuar verde sem nenhuma
  alteração nos testes já existentes, só a adição de casos novos.
- **`data_vigencia_fim` automática ao versionar pode confundir se a nova vigência
  começar no passado ou em uma data igual à de início da antiga** (ex.: correção
  retroativa). Não há um requisito explícito para esse caso extremo — se a nova
  `data_vigencia_inicio` não for posterior ao `data_vigencia_inicio` da antiga, o
  `Servico.Versionar` deve recusar com `ErrVigenciaAnteriorAAtual`, em vez de gravar um
  intervalo de datas invertido silenciosamente.
