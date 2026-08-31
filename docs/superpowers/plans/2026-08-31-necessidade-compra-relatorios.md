# Necessidade de Compra e Relatórios — Fase 2.4

**Goal:** Fechar a Fase 2.4 do cronograma técnico: sugestão automática de compra
(RF3.2, cruzando estoque mínimo × saldo atual — sem o termo "OPs Pendentes",
que só entra na Fase 3, pois não há Ordem de Produção ainda) e exportação de
relatórios de compras/estoque em CSV.

**Architecture:** Pacote de domínio novo `necessidadecompra`, somente leitura
(sem `Dados`/`Validar` — é uma consulta cruzada, não um cadastro). Reaproveita
`estoque.Saldo`/`peca.PartePeca`/`fornecedor.Fornecedor` via JOIN direto no
repositório, sem importar esses pacotes de domínio (mesmo raciocínio já usado
em `produto_repo.Listar` com `estrutura_produto`: é só SQL, não uma
dependência de domínio). "Gerar cotação" a partir da necessidade **não** cria
uma `Cotação` direta no backend — o domínio já exige `preco_unitario > 0`
(RF3.1), e o preço é exatamente o que ainda não se sabe nesse ponto do fluxo.
Em vez disso, o frontend pré-preenche o formulário existente de Nova Cotação
(fornecedor + itens com quantidade) via `location.state`, deixando o preço
para o usuário digitar — sem inventar uma exceção na validação de domínio só
para este atalho.

Relatórios: exportação CSV (não PDF) de Estoque (saldo atual) e Pedidos de
Compra — decisão de escopo registrada abaixo.

**Tech Stack:** Go 1.25 + Echo + pgx/v5 (backend, `encoding/csv` da stdlib,
sem dependência nova), React 18 + TypeScript + Vite + TanStack Query
(frontend). TDD, testes contra Postgres real via `testsupport.BancoMigrado`.
Toda execução (build/test/lint) via Docker, nunca toolchain local no PATH do
host (decisão já registrada no ledger da Fase 2.1).

## Decisões de pré-voo

- **PDF fora de escopo**: o cronograma já marca relatórios como "pode ser
  adiada... sem prejuízo". Implementar só CSV (stdlib, sem dependência nova)
  cobre a necessidade de exportar dados sem abrir uma frente de decisão de
  biblioteca de PDF, que ninguém pediu explicitamente ainda.
- **Sem geração automática de Cotação no backend**: ver Architecture acima —
  o preço é desconhecido nesse ponto do fluxo, então "gerar cotação" é um
  atalho de UI (pré-preenchimento), não uma escrita no banco.
- **Necessidade só considera peças ativas**: uma peça inativada não deveria
  gerar sugestão de compra.
- **Sem paginação em `/necessidade-compra`**: mesmo raciocínio de
  `/estoque/criticos` — é uma lista de alerta operacional, curta por
  natureza (só peças abaixo do mínimo).
- **CSV sem paginação, dataset completo**: um relatório existe para ser
  aberto numa planilha inteira, não paginado.
- Branch: `feat/necessidade-compra-relatorios`, empilhada sobre
  `feat/estrutura-produto-bom` (PR #? ainda aberto).

---

## Backend

### Task B1: Domínio `necessidadecompra`

**Files:** `backend/internal/domain/necessidadecompra/necessidadecompra.go` (+ teste)

```go
package necessidadecompra

// Item e uma peca cujo saldo esta abaixo do estoque minimo, com a
// quantidade sugerida para repor. RN: Necessario = EstoqueMinimo - SaldoAtual
// (RF3.2, sem o termo OPs Pendentes -- Fase 3 ainda nao existe).
type Item struct {
	PartePecaID           int64   `json:"parte_peca_id"`
	Codigo                string  `json:"codigo"`
	Descricao              string `json:"descricao"`
	SaldoAtual             int    `json:"saldo_atual"`
	EstoqueMinimo          int    `json:"estoque_minimo"`
	Necessidade            int    `json:"necessidade"`
	FornecedorPadraoID     *int64  `json:"fornecedor_padrao_id,omitempty"`
	FornecedorPadraoNome   *string `json:"fornecedor_padrao_nome,omitempty"`
}
```

Sem `Dados`/`Validar`/sentinelas de erro — é leitura pura, nenhuma escrita.

- [ ] Teste: `Item` é só um DTO, não há regra para testar aqui isoladamente
  (a regra de cálculo mora na query SQL, testada via repositório na Task B2).
  Pular teste unitário de domínio nesta task — ir direto para B2.

### Task B2: `necessidadecompra.Servico` + Repositorio

**Files:** `backend/internal/domain/necessidadecompra/servico.go`,
`backend/internal/infra/repository/necessidadecompra_repo.go` (+ testes)

```go
// servico.go
package necessidadecompra

import "context"

type Repositorio interface {
	Listar(ctx context.Context) ([]Item, error)
}

type Servico struct{ repo Repositorio }

func NovoServico(repo Repositorio) *Servico { return &Servico{repo: repo} }

func (s *Servico) Listar(ctx context.Context) ([]Item, error) {
	return s.repo.Listar(ctx)
}
```

Repositório: query única, `partes_pecas pp JOIN saldo_estoque se ON se.parte_peca_id = pp.id
LEFT JOIN fornecedores f ON f.id = pp.fornecedor_padrao_id
WHERE pp.ativo AND se.quantidade_atual < pp.estoque_minimo
ORDER BY pp.codigo`, com `necessidade = pp.estoque_minimo - se.quantidade_atual`
calculado em Go (não em SQL, para não duplicar a subtração em dois lugares
se um dia precisar arredondar por lote de compra).

- [ ] Teste (`testsupport.BancoMigrado`): peça ativa abaixo do mínimo aparece
  com a necessidade certa; peça acima do mínimo não aparece; peça inativa
  abaixo do mínimo não aparece; peça sem fornecedor padrão aparece com
  `FornecedorPadraoID/Nome` nulos (não é motivo para excluir da lista — só
  impede o atalho de "gerar cotação" no frontend, que checa isso na hora).
- [ ] Commit: `feat(backend): dominio e repositorio de necessidade de compra`

### Task B3: Handler HTTP `GET /necessidade-compra`

**Files:** `backend/internal/api/handlers/necessidadecompra.go` (+ teste)

Rota simples, aberta a qualquer perfil autenticado (mesmo padrão de
`GET /estoque/criticos`) — é consulta, não escrita.

- [ ] Teste: 200 com a lista; perfil qualquer (não só Admin/Gestor) consegue
  ler.
- [ ] Commit: `feat(backend): handler HTTP de necessidade de compra`

### Task B4: Exportação CSV — Estoque e Pedidos de Compra

**Files:** modifica `backend/internal/api/handlers/estoque.go` e
`backend/internal/api/handlers/pedidos_compra.go` (+ testes)

Duas rotas novas: `GET /estoque/relatorio.csv` e
`GET /pedidos-compra/relatorio.csv`. Cada uma reaproveita o `Servico`/
`Repositorio` já existente (sem paginação — busca tudo) e escreve via
`encoding/csv`, `Content-Type: text/csv; charset=utf-8`,
`Content-Disposition: attachment; filename="..."`.

Colunas do CSV de estoque: código, descrição, saldo atual, disponível,
estoque mínimo, situação.
Colunas do CSV de pedidos de compra: número, fornecedor, status, data do
pedido, data de entrega prevista, data de entrega real, valor total.

- [ ] Teste: `Content-Type`/`Content-Disposition` corretos; corpo contém o
  cabeçalho CSV e uma linha por registro; lista vazia ainda devolve o
  cabeçalho (nunca um CSV totalmente vazio, que confundiria quem abre no
  Excel).
- [ ] Commit: `feat(backend): exportacao CSV de estoque e pedidos de compra`

### Task B5: Wiring e verificação final do backend

**Files:** `backend/internal/api/routes.go`

Registrar `necessidadecompra.Servico`/handler em `registrarCompras` (mesmo
grupo de cotações/pedidos, já recebe `estoqueServico` por parâmetro).

- [ ] `go build/vet/gofmt/test ./...` limpo (via Docker).
- [ ] Fluxo manual via curl/Playwright dentro da rede do compose: peça abaixo
  do mínimo aparece em `/necessidade-compra` com a quantidade certa; CSV de
  estoque e de pedidos de compra abrem com o cabeçalho certo.
- [ ] Commit: `feat(backend): registra necessidade de compra e wiring final`

---

## Frontend

### Task F1: Tipos e serviço

**Files:** `frontend/src/tipos/compras.ts` (campo aditivo se necessário),
`frontend/src/servicos/compras.ts` (ou novo `necessidadeCompra.ts`) + teste

`listarNecessidadeCompra(): Promise<ItemNecessidadeCompra[]>` batendo em
`GET /necessidade-compra`. Sem paginação (mesmo formato de
`listarEstoqueCriticos`).

- [ ] Commit: `feat(frontend): tipos e servico de necessidade de compra`

### Task F2: Tela "Necessidade de compra"

**Files:** `frontend/src/paginas/compras/NecessidadeCompra.tsx` + teste

Tabela simples (sem paginação/busca — lista de alerta, como
`estoque/criticos` no Painel): peça, saldo atual, mínimo, necessidade,
fornecedor padrão. Agrupada por fornecedor padrão (itens sem fornecedor
padrão ficam num grupo "Sem fornecedor padrão — cadastre um antes de gerar
cotação", sem botão de ação). Cada grupo com fornecedor tem um botão
**Gerar cotação** que navega para `/cotacoes/nova` passando
`{ fornecedorId, itens }` via `location.state`.

- [ ] Commit: `feat(frontend): tela de necessidade de compra`

### Task F3: `NovaCotacao` aceita pré-preenchimento

**Files:** modifica `frontend/src/paginas/compras/NovaCotacao.tsx` + teste

Lê `useLocation().state` (tipado, opcional) na montagem: se vier
`{ fornecedorId, itens }`, usa como `defaultValues` do formulário
(fornecedor já selecionado, itens com peça+quantidade preenchidos,
`preco_unitario` vazio para o usuário digitar). Sem o state, comportamento
igual ao de hoje.

- [ ] Commit: `feat(frontend): NovaCotacao aceita pre-preenchimento da necessidade de compra`

### Task F4: Exportar CSV nas telas de Estoque e Pedidos de compra

**Files:** modifica `frontend/src/paginas/estoque/Estoque.tsx` e
`frontend/src/paginas/compras/PedidosCompra.tsx`

Botão **Exportar CSV** que aponta para a URL da API
(`api.defaults.baseURL + '/estoque/relatorio.csv'`, com o token de auth —
usar `<a>` com `download` não funciona com header Authorization; resolver
via `fetch` + blob + link temporário, ou abrir a rota autenticada por query
param se o backend aceitar — decidir na implementação conforme o padrão de
auth já usado no `api.ts`).

- [ ] Commit: `feat(frontend): exportar CSV de estoque e pedidos de compra`

### Task F5: Navegação, Ajuda e rota

**Files:** `App.tsx`, `NavegacaoLateral.tsx` (+ teste), `Ajuda.tsx` (+ teste)

Rota `/necessidade-compra`; item na seção "Compras" da navegação lateral
(depois de Pedidos de compra); entrada de ajuda contextual.

- [ ] Commit: `feat(frontend): navegacao, ajuda e rota para necessidade de compra`

### Task F6: Verificação final do frontend

- [ ] `npm test`/`lint`/`build` limpos (via Docker).
- [ ] Roteiro Playwright real (dentro da rede do compose): peça abaixo do
  mínimo aparece em Necessidade de compra → "Gerar cotação" abre Nova
  Cotação com fornecedor e itens pré-preenchidos → preencher preço e salvar
  funciona normalmente → exportar CSV de Estoque e de Pedidos de compra
  baixa um arquivo não vazio. Checagem de escala de cinza e 800px.
- [ ] Commit (se houver ajustes): `fix(frontend): ajustes da verificacao visual da necessidade de compra`

---

## Documentação e entrega

### Task 23: Screenshots, manual e ledger

- [ ] Screenshots novos em `docs/screenshots/` (numeração sequencial a
  partir da última usada), dados de exemplo realistas.
- [ ] Nova seção no `docs/8_MANUAL_OPERACAO.md` (entre Pedidos de compra e
  Estoque, ou logo após Estoque — decidir na hora pela ordem de dependência
  real: a tela lê saldo de Estoque, então depois de Estoque faz mais
  sentido), com renumeração dos links cruzados.
- [ ] `.superpowers/sdd/progress.md`: nova seção "Ledger — Necessidade de
  Compra e Relatórios (Fase 2.4)", decisões de pré-voo, ledger tarefa por
  tarefa.
- [ ] Commit final, push, abrir PR com base em `feat/estrutura-produto-bom`
  (branch anterior, ainda não mesclada).
