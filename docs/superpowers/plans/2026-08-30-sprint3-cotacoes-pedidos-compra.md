# Sprint 3 — Cotações e Pedidos de Compra (RF3.1, RF3.3, RF3.4 parcial)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans. TDD sem exceção, como no Sprint 2.

**Goal:** Entregar o backend e o frontend de Cotações e Pedidos de Compra (RF3.1 e RF3.3),
mais o acompanhamento de status (RF3.4 parcial — sem o dashboard agregado, que é RF6 e já
existe como placeholder no Painel).

**Não escopo desta sprint** (dependem de módulos que ainda não existem):
- `POST /pedidos-compra/{id}/registrar-recebimento` e a tela de recebimento — dependem do
  módulo de Estoque (Sprint 4, `saldo_estoque`/`movimentacao_estoque`).
- `POST /necessidade-compra/gerar` — depende de Ordens de Produção e BOM cruzados com
  estoque (Sprint 5/6).
- `GET /pedidos-compra/em-atraso` **entra** nesta sprint: só depende de data e status, que já
  existem.

**Branch:** `feat/sprint3-cotacoes-pedidos-compra`, empilhada sobre `feat/telas-de-cadastro`
(PR #1 ainda aberto — é de lá que vêm `Tabela`, `Modal`, `Badge`, `BarraDeFiltros` etc. que
esta sprint reaproveita). Ao abrir o PR desta sprint, apontar a base para
`feat/telas-de-cadastro`, não para `main`, até o #1 ser mesclado.

**Spec:** `docs/1_ESPECIFICACAO_REQUISITOS.md` (RF3.1, RF3.3, RF3.4), `docs/2_ARQUITETURA_BANCO_DADOS.md`
(tabelas `cotacoes`, `itens_cotacao`, `pedidos_compra`, `itens_pedido_compra` — **já
migradas**, ver `backend/internal/infra/db/migrations/003_criar_tabelas_compras.sql`),
`docs/3_ESPECIFICACAO_APIS.md` (`## APIs - Compras`), `.claude/skills/pcp-design-system/SKILL.md`
§5 (trilha de etapas — é o padrão exigido para os status de Cotação e PC).

## Descoberta importante

As tabelas `cotacoes`, `itens_cotacao`, `pedidos_compra`, `itens_pedido_compra` **já existem**
no banco (migration 003, aplicada). Esta sprint não escreve nenhuma migration nova para o
CRUD básico — só código Go em cima do schema existente. Os enums de status, autoritativos
porque são um `CHECK` constraint na migration (a doc 2 tem uma versão levemente diferente,
não confiável):

- `cotacoes.status`: `Rascunho`, `Enviada`, `Respondida`, `Cancelada`.
- `pedidos_compra.status`: `Rascunho`, `Emitido`, `Aceito`, `Aguardando Entrega`,
  `Recebido Parcial`, `Concluido`, `Cancelado` (sem acento em "Concluido" — é o valor
  gravado no banco, confirmado em `repository/fornecedor_repo.go:28`).

## Padrão arquitetural (idêntico ao módulo `fornecedor`)

`Pool -> Repositorio -> Servico -> Handler -> Registrar(grupo, middleware)`, tudo construído
inline em `routes.go`, sem framework de DI. Camada de domínio é Go puro (sem pgx/echo).
Detalhes exatos (localização de arquivo, assinatura, convenção de erro) estão documentados
inline em cada tarefa abaixo — foram extraídos ao pé da letra do módulo `fornecedor` existente
(`backend/internal/domain/fornecedor/`, `backend/internal/infra/repository/fornecedor_repo.go`,
`backend/internal/api/handlers/fornecedores.go`) e do módulo `peca` (para o padrão de
transação pai+filhos, `backend/internal/infra/repository/peca_repo.go`).

**Diferença chave**: fornecedor/peca/produto soft-deletam via `ativo bool`; Cotação e PC não
têm essa coluna — "excluir" é uma transição de `status` para `Cancelada`/`Cancelado`, com o
mesmo espírito (histórico preservado, nunca `DELETE FROM`). A doc 3 nem lista `DELETE
/cotacoes/{id}`; a ação é `cancelar`, exposta como rota própria.

**Erros de negócio**: mapeados em `mapaDeErros` no handler, igual a `errosFornecedor`. Reusar
os códigos existentes de `httpx` (`CodigoNaoEncontrado`, `CodigoConflito`,
`CodigoErroValidacao` etc.) — não inventar códigos novos.

---

## Tarefas — Backend

### Tarefa B1: Domínio `cotacao` — modelo e validação

**Arquivos:**
- Create: `backend/internal/domain/cotacao/cotacao.go`
- Create: `backend/internal/domain/cotacao/cotacao_test.go`

**Conteúdo** (mirror de `fornecedor.go`):

```go
package cotacao

const (
	StatusRascunho   = "Rascunho"
	StatusEnviada    = "Enviada"
	StatusRespondida = "Respondida"
	StatusCancelada  = "Cancelada"
)

var (
	ErrFornecedorObrigatorio     = errors.New("informe o fornecedor")
	ErrDataValidadeObrigatoria   = errors.New("informe a data de validade")
	ErrDataValidadeInvalida      = errors.New("a data de validade deve ser posterior a data de emissao")
	ErrItensObrigatorios         = errors.New("informe ao menos um item")
	ErrQuantidadeInvalida        = errors.New("a quantidade de cada item deve ser maior que zero")
	ErrPrecoInvalido             = errors.New("o preco unitario de cada item deve ser maior que zero")
	ErrNumeroCotacaoObrigatorio  = errors.New("informe o numero da cotacao")
	ErrNumeroCotacaoDuplicado    = errors.New("ja existe uma cotacao com este numero")
	ErrFornecedorOuPecaInexistente = errors.New("o fornecedor ou uma das pecas informadas nao existe")
	ErrNaoEncontrado             = errors.New("cotacao nao encontrada")
	ErrStatusInvalidoParaAcao    = errors.New("a cotacao nao esta em um status que permite esta acao")
)

type ItemCotacao struct {
	ID            int64   `json:"id"`
	PartePecaID   int64   `json:"parte_peca_id"`
	Quantidade    int     `json:"quantidade"`
	PrecoUnitario float64 `json:"preco_unitario"`
	Total         float64 `json:"total"`
}

type Cotacao struct {
	ID            int64         `json:"id"`
	NumeroCotacao string        `json:"numero_cotacao"`
	FornecedorID  int64         `json:"fornecedor_id"`
	DataEmissao   time.Time     `json:"data_emissao"`
	DataValidade  time.Time     `json:"data_validade"`
	DataResposta  *time.Time    `json:"data_resposta,omitempty"`
	ValorTotal    *float64      `json:"valor_total,omitempty"`
	Status        string        `json:"status"`
	Observacoes   string        `json:"observacoes,omitempty"`
	Itens         []ItemCotacao `json:"itens,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
	CreatedBy     *string       `json:"created_by,omitempty"`
	UpdatedBy     *string       `json:"updated_by,omitempty"`
}

type ItemDados struct {
	PartePecaID   int64
	Quantidade    int
	PrecoUnitario float64
}

// Dados sao os campos informados na criacao. NumeroCotacao e DataEmissao tem
// default no Servico quando vazios (auto-gerado / hoje) — ver Tarefa B2.
type Dados struct {
	NumeroCotacao string
	FornecedorID  int64
	DataEmissao   time.Time
	DataValidade  time.Time
	Observacoes   string
	Itens         []ItemDados
}

func (d *Dados) Normalizar() {
	d.NumeroCotacao = strings.ToUpper(strings.TrimSpace(d.NumeroCotacao))
	d.Observacoes = strings.TrimSpace(d.Observacoes)
}

func (d Dados) Validar() error {
	if d.FornecedorID <= 0 {
		return ErrFornecedorObrigatorio
	}
	if d.DataValidade.IsZero() {
		return ErrDataValidadeObrigatoria
	}
	if !d.DataValidade.After(d.DataEmissao) {
		return ErrDataValidadeInvalida
	}
	if len(d.Itens) == 0 {
		return ErrItensObrigatorios
	}
	for _, item := range d.Itens {
		if item.Quantidade <= 0 {
			return ErrQuantidadeInvalida
		}
		if item.PrecoUnitario <= 0 {
			return ErrPrecoInvalido
		}
	}
	return nil
}
```

`cotacao_test.go`: testes puros de `Validar`/`Normalizar` (sem banco), um por regra —
seguir o estilo de `fornecedor_test.go` (não lido nesta sprint, mas o padrão já está claro
em `cotacao.go` acima: uma função por erro esperado, `require.ErrorIs`).

- [ ] Escrever `cotacao_test.go` primeiro, ver falhar (`go test ./internal/domain/cotacao/...`
  — pacote não existe ainda).
- [ ] Implementar `cotacao.go`, ver passar.
- [ ] Commit: `feat(backend): dominio de cotacoes`

### Tarefa B2: Domínio `cotacao` — serviço (casos de uso)

**Arquivos:**
- Create: `backend/internal/domain/cotacao/servico.go`
- Create: `backend/internal/domain/cotacao/servico_test.go`

```go
var ColunasOrdenaveis = []string{
	"numero_cotacao", "data_emissao", "data_validade", "valor_total", "status", "created_at",
}

// StatusPermitidos e passado a consulta.AnalisarComStatus (Tarefa B3).
var StatusPermitidos = []string{StatusRascunho, StatusEnviada, StatusRespondida, StatusCancelada}

type RespostaDados struct {
	DataResposta time.Time
	Itens        []ItemDados // apenas PartePecaID + PrecoUnitario usados
}

type Repositorio interface {
	Criar(ctx context.Context, c *Cotacao, autor string) error
	Atualizar(ctx context.Context, c *Cotacao, autor string) error
	BuscarPorID(ctx context.Context, id int64) (*Cotacao, error)
	Listar(ctx context.Context, params consulta.Parametros) ([]Cotacao, int, error)
	AtualizarStatus(ctx context.Context, id int64, status string, autor string) error
	// RegistrarResposta atualiza preco_unitario/total de cada item e recalcula
	// valor_total, tudo numa transacao (Tarefa B4).
	RegistrarResposta(ctx context.Context, id int64, resposta RespostaDados, autor string) (*Cotacao, error)
}

type Servico struct{ repo Repositorio }

func NovoServico(repo Repositorio) *Servico { return &Servico{repo: repo} }

func (s *Servico) Criar(ctx context.Context, dados Dados, autor string) (*Cotacao, error) {
	dados.Normalizar()
	if strings.TrimSpace(dados.NumeroCotacao) == "" {
		return nil, ErrNumeroCotacaoObrigatorio
	}
	if dados.DataEmissao.IsZero() {
		dados.DataEmissao = time.Now()
	}
	if err := dados.Validar(); err != nil {
		return nil, err
	}
	// valor_total e a soma de quantidade*preco de cada item — calculado aqui,
	// nao confiado ao cliente.
	itens := make([]ItemCotacao, len(dados.Itens))
	var total float64
	for i, id := range dados.Itens {
		subtotal := float64(id.Quantidade) * id.PrecoUnitario
		itens[i] = ItemCotacao{PartePecaID: id.PartePecaID, Quantidade: id.Quantidade, PrecoUnitario: id.PrecoUnitario, Total: subtotal}
		total += subtotal
	}
	c := &Cotacao{
		NumeroCotacao: dados.NumeroCotacao, FornecedorID: dados.FornecedorID,
		DataEmissao: dados.DataEmissao, DataValidade: dados.DataValidade,
		Observacoes: dados.Observacoes, Status: StatusRascunho, ValorTotal: &total, Itens: itens,
	}
	if err := s.repo.Criar(ctx, c, autor); err != nil {
		return nil, err
	}
	return c, nil
}

// Atualizar so e permitido em Rascunho (RF3.1: nao existe "editar cotacao
// enviada" no requisito — a resposta do fornecedor entra por
// RegistrarResposta, nao por edicao livre).
func (s *Servico) Atualizar(ctx context.Context, id int64, dados Dados, autor string) (*Cotacao, error) { /* busca, guarda status==Rascunho senao ErrStatusInvalidoParaAcao, recalcula itens/total, repo.Atualizar */ }

func (s *Servico) BuscarPorID(ctx context.Context, id int64) (*Cotacao, error) { return s.repo.BuscarPorID(ctx, id) }
func (s *Servico) Listar(ctx context.Context, params consulta.Parametros) ([]Cotacao, int, error) { return s.repo.Listar(ctx, params) }

func (s *Servico) Enviar(ctx context.Context, id int64, autor string) (*Cotacao, error) {
	c, err := s.repo.BuscarPorID(ctx, id)
	if err != nil { return nil, err }
	if c.Status != StatusRascunho { return nil, ErrStatusInvalidoParaAcao }
	if err := s.repo.AtualizarStatus(ctx, id, StatusEnviada, autor); err != nil { return nil, err }
	c.Status = StatusEnviada
	return c, nil
}

func (s *Servico) RegistrarResposta(ctx context.Context, id int64, resposta RespostaDados, autor string) (*Cotacao, error) {
	c, err := s.repo.BuscarPorID(ctx, id)
	if err != nil { return nil, err }
	if c.Status != StatusEnviada { return nil, ErrStatusInvalidoParaAcao }
	for _, item := range resposta.Itens {
		if item.PrecoUnitario <= 0 { return nil, ErrPrecoInvalido }
	}
	return s.repo.RegistrarResposta(ctx, id, resposta, autor)
}

func (s *Servico) Cancelar(ctx context.Context, id int64, autor string) error {
	c, err := s.repo.BuscarPorID(ctx, id)
	if err != nil { return err }
	if c.Status == StatusCancelada { return ErrStatusInvalidoParaAcao }
	return s.repo.AtualizarStatus(ctx, id, StatusCancelada, autor)
}
```

- [ ] `servico_test.go` primeiro (contra banco real via `testsupport.BancoMigrado`, mirror de
  `fornecedor/servico_test.go`): criar calcula valor_total; criar sem itens falha; criar com
  fornecedor inexistente vira `ErrFornecedorOuPecaInexistente`; enviar fora de Rascunho falha;
  registrar-resposta fora de Enviada falha; registrar-resposta recalcula valor_total; cancelar
  idempotente falha na segunda vez; listar filtra por status; listar filtra por busca
  (numero_cotacao).
- [ ] Implementar, ver passar.
- [ ] Commit: `feat(backend): casos de uso de cotacoes`

### Tarefa B3: `consulta` — filtro por status (aditivo, sem quebrar `fornecedor`/`peca`/`produto`)

**Arquivos:**
- Modify: `backend/internal/platform/consulta/consulta.go`
- Modify: `backend/internal/platform/consulta/consulta_test.go`

Cotação e PC não têm `ativo` — usam `status`. Em vez de mudar a assinatura de `Analisar`
(quebraria as 3 chamadas existentes), acrescentar:

```go
// FiltroStatus, alem de FiltroAtivo, no struct Parametros. nil = sem filtro.
FiltroStatus *string

// AnalisarComStatus e como Analisar, mas para listagens que filtram por
// status (Cotacao, PedidoCompra) em vez de por ativo/inativo.
func AnalisarComStatus(valores url.Values, colunasPermitidas []string, colunaPadrao string, statusPermitidos []string) (Parametros, error) {
	p, err := Analisar(valores, colunasPermitidas, colunaPadrao)
	if err != nil { return p, err }
	if bruto := valores.Get("status"); bruto != "" {
		if !slices.Contains(statusPermitidos, bruto) {
			return p, fmt.Errorf("status aceita apenas: %s", strings.Join(statusPermitidos, ", "))
		}
		p.FiltroStatus = &bruto
	}
	return p, nil
}
```

- [ ] Testes primeiro em `consulta_test.go` (novo `describe`-equivalente, funções
  `TestAnalisarComStatus...`): sem status = nil; status válido é aceito; status fora da lista
  rejeitado com mensagem contendo "status"; `filtro_ativo` continua funcionando junto
  (embora cotação/PC não usem os dois ao mesmo tempo, o parser não deve impedir).
- [ ] Implementar, ver passar. Rodar `go test ./internal/platform/consulta/...` E
  `go test ./internal/api/handlers/... ./internal/domain/...` para confirmar que nada em
  fornecedor/peca/produto quebrou (mudança é puramente aditiva).
- [ ] Commit: `feat(backend): consulta.AnalisarComStatus para listagens por status`

### Tarefa B4: Repositório `cotacao` (Postgres)

**Arquivos:**
- Create: `backend/internal/infra/repository/cotacao_repo.go`
- Create: `backend/internal/infra/repository/cotacao_repo_test.go`
- Modify: `backend/internal/infra/repository/filtros.go` (nova função `filtrosDeCompras`)

```go
// filtrosDeCompras monta o WHERE por status (nao por ativo) e busca textual —
// usado por cotacao_repo.go e pedido_compra_repo.go.
func filtrosDeCompras(params consulta.Parametros, colunaBusca string) (string, []any) {
	condicoes := make([]string, 0, 2)
	argumentos := make([]any, 0, 2)
	if params.FiltroStatus != nil {
		argumentos = append(argumentos, *params.FiltroStatus)
		condicoes = append(condicoes, fmt.Sprintf("status = $%d", len(argumentos)))
	}
	if params.Busca != "" {
		argumentos = append(argumentos, "%"+strings.ToLower(params.Busca)+"%")
		condicoes = append(condicoes, fmt.Sprintf("lower(%s) LIKE $%d", colunaBusca, len(argumentos)))
	}
	if len(condicoes) == 0 { return "", argumentos }
	return "WHERE " + strings.Join(condicoes, " AND "), argumentos
}
```

`cotacao_repo.go` — `Criar` é transacional (mirror de `peca_repo.go` §`Criar`): insere em
`cotacoes` (`RETURNING id, created_at, updated_at`), depois um `INSERT` por item em
`itens_cotacao` dentro da mesma tx (ou um `INSERT ... SELECT unnest($1::bigint[], ...)` se
preferir um único round-trip — usar o padrão mais simples, um `INSERT` por item, como
`peca_repo.go` faz para o saldo de estoque). Mapear:
- `violouIndiceUnico(err)` → `cotacao.ErrNumeroCotacaoDuplicado`
- `violouChaveEstrangeira(err)` → `cotacao.ErrFornecedorOuPecaInexistente`

`BuscarPorID` faz `SELECT` da cotação + `SELECT` separado de `itens_cotacao WHERE
cotacao_id = $1 ORDER BY id` (dois round-trips, mais simples que `JOIN` + agrupamento manual
em Go — aceitável no volume desta tabela).

`Listar` só traz o header (sem itens — a lista não precisa, evita N+1); `filtrosDeCompras(params,
"numero_cotacao")`.

`AtualizarStatus` — `UPDATE cotacoes SET status = $2, updated_by = $3 WHERE id = $1`.

`RegistrarResposta` — transação: `UPDATE itens_cotacao SET preco_unitario = $1, total =
quantidade * $1 WHERE cotacao_id = $2 AND parte_peca_id = $3` por item, depois recalcula
`valor_total` com `SELECT sum(total) FROM itens_cotacao WHERE cotacao_id = $1` e faz `UPDATE
cotacoes SET valor_total = $1, data_resposta = $2, status = 'Respondida', updated_by = $3
WHERE id = $4`. Devolve a cotação recarregada (`BuscarPorID`).

- [ ] `cotacao_repo_test.go` primeiro (contra `testsupport.BancoMigrado`): criar persiste
  itens corretamente com total calculado; buscar-por-id traz os itens; numero duplicado vira
  erro mapeado; fornecedor inexistente vira erro mapeado; listar filtra por status; listar
  filtra por busca (numero_cotacao case-insensitive); registrar-resposta atualiza preco e
  recalcula valor_total.
- [ ] Implementar, ver passar.
- [ ] Commit: `feat(backend): repositorio de cotacoes`

### Tarefa B5: Handler `cotacao` (HTTP)

**Arquivos:**
- Create: `backend/internal/api/handlers/cotacoes.go`
- Create: `backend/internal/api/handlers/cotacoes_test.go`

Rotas (mirror de `fornecedores.go`, mesma gate de perfil — `GET` aberto a qualquer
autenticado, mutações exigem Admin/Gestor):

```go
rotas := grupo.Group("/cotacoes", autenticacao)
gestao := middleware.ExigirPerfil(usuario.PerfilAdmin, usuario.PerfilGestor)
rotas.GET("", h.Listar)
rotas.GET("/:id", h.Obter)
rotas.POST("", h.Criar, gestao)
rotas.PUT("/:id", h.Atualizar, gestao)
rotas.POST("/:id/enviar", h.Enviar, gestao)
rotas.POST("/:id/registrar-resposta", h.RegistrarResposta, gestao)
rotas.POST("/:id/cancelar", h.Cancelar, gestao)
rotas.POST("/:id/converter-pc", h.ConverterEmPedido, gestao)
```

`errosCotacao` mapaDeErros com todas as sentinelas de `cotacao.Err*` (ver Tarefa B1/B2) —
`ErrNaoEncontrado`→404, `ErrNumeroCotacaoDuplicado`→409, `ErrStatusInvalidoParaAcao`→409
(é um conflito de estado, não um erro de forma), os `Err*Obrigatorio`/`ErrDataValidadeInvalida`/
`ErrQuantidadeInvalida`/`ErrPrecoInvalido`/`ErrFornecedorOuPecaInexistente`→400.

`cotacaoRequest` (POST/PUT) e `itemRequest` (usar `validate:"required,dive"` no slice de
itens — go-playground/validator aplica as tags de cada campo do elemento durante o `dive`):

```go
type itemRequest struct {
	PartePecaID   int64   `json:"parte_peca_id" validate:"required"`
	Quantidade    int     `json:"quantidade" validate:"required,gt=0"`
	PrecoUnitario float64 `json:"preco_unitario" validate:"required,gt=0"`
}
type cotacaoRequest struct {
	NumeroCotacao string        `json:"numero_cotacao" validate:"required,max=50"`
	FornecedorID  int64         `json:"fornecedor_id" validate:"required"`
	DataValidade  string        `json:"data_validade" validate:"required"` // "2026-09-25", parse com time.DateOnly
	Observacoes   string        `json:"observacoes" validate:"max=1000"`
	Itens         []itemRequest `json:"itens" validate:"required,min=1,dive"`
}
```

`ConverterEmPedido` — este handler precisa também de `*pedidocompra.Servico` (construtor do
`CotacaoHandler` recebe os dois serviços). Corpo da requisição:
`{"data_entrega_prevista": "...", "condicao_pagamento": "..."}`. Fluxo: busca cotação (guarda
`Status == Respondida`, senão `ErrStatusInvalidoParaAcao`), monta
`pedidocompra.Dados{CotacaoID: &id, FornecedorID: c.FornecedorID, DataEntregaPrevista: ...,
CondicaoPagamento: ..., Itens: [itens da cotacao com preco negociado]}`, chama
`h.pedidoServico.Criar(ctx, dados, autor)`, responde 201 com o PC criado. Erros do lado do
PC (ex. `pedidocompra.ErrDataEntregaInvalida`) devem ser mapeados também — usar
`errosPedidoCompra.responder` (Tarefa B8) para esse branch específico, já que o erro é do
domínio de PC, não de Cotação.

- [ ] `cotacoes_test.go` primeiro (mirror de `fornecedores_test.go` +
  `testapi_test.go`/`apiCotacoes(t)` — precisa registrar tanto o handler de cotação quanto o
  de PC, já que `converter-pc` depende dos dois): criar 201; criar sem itens 400; numero
  duplicado 409; obter 404; listar com filtro `status=Enviada`; enviar muda status; enviar
  fora de Rascunho 409; registrar-resposta muda status e recalcula valor_total;
  registrar-resposta fora de Enviada 409; cancelar; operador recebe 403 em mutações mas 200
  em GET; converter-pc cria um PC com `cotacao_id` preenchido e itens copiados;
  converter-pc fora de Respondida 409.
- [ ] Implementar, ver passar.
- [ ] Commit: `feat(backend): handler HTTP de cotacoes`

### Tarefa B6: Domínio `pedidocompra` — modelo e validação

**Arquivos:**
- Create: `backend/internal/domain/pedidocompra/pedidocompra.go`
- Create: `backend/internal/domain/pedidocompra/pedidocompra_test.go`

Mesmo formato da Tarefa B1, adaptado:

```go
const (
	StatusRascunho          = "Rascunho"
	StatusEmitido           = "Emitido"
	StatusAceito            = "Aceito"
	StatusAguardandoEntrega = "Aguardando Entrega"
	StatusRecebidoParcial   = "Recebido Parcial"
	StatusConcluido         = "Concluido"
	StatusCancelado         = "Cancelado"
)

var (
	ErrFornecedorObrigatorio        = errors.New("informe o fornecedor")
	ErrDataEntregaObrigatoria       = errors.New("informe a data de entrega prevista")
	ErrDataEntregaInvalida          = errors.New("a data de entrega prevista deve ser posterior a data do pedido")
	ErrItensObrigatorios            = errors.New("informe ao menos um item")
	ErrQuantidadeInvalida           = errors.New("a quantidade solicitada de cada item deve ser maior que zero")
	ErrPrecoInvalido                = errors.New("o preco unitario de cada item deve ser maior que zero")
	ErrNumeroPCObrigatorio          = errors.New("informe o numero do pedido de compra")
	ErrNumeroPCDuplicado            = errors.New("ja existe um pedido de compra com este numero")
	ErrFornecedorOuPecaInexistente  = errors.New("o fornecedor ou uma das pecas informadas nao existe")
	ErrCotacaoInexistente           = errors.New("a cotacao informada nao existe")
	ErrNaoEncontrado                = errors.New("pedido de compra nao encontrado")
	ErrStatusInvalidoParaAcao       = errors.New("o pedido de compra nao esta em um status que permite esta acao")
)

type ItemPedido struct {
	ID                  int64   `json:"id"`
	PartePecaID         int64   `json:"parte_peca_id"`
	QuantidadeSolicitada int    `json:"quantidade_solicitada"`
	QuantidadeRecebida  int     `json:"quantidade_recebida"`
	PrecoUnitario       float64 `json:"preco_unitario"`
	Total               float64 `json:"total"`
}

type PedidoCompra struct {
	ID                  int64        `json:"id"`
	NumeroPC            string       `json:"numero_pc"`
	CotacaoID           *int64       `json:"cotacao_id,omitempty"`
	FornecedorID        int64        `json:"fornecedor_id"`
	DataPedido          time.Time    `json:"data_pedido"`
	DataEntregaPrevista time.Time    `json:"data_entrega_prevista"`
	DataEntregaReal     *time.Time   `json:"data_entrega_real,omitempty"`
	ValorTotal          float64      `json:"valor_total"`
	CondicaoPagamento   string       `json:"condicao_pagamento,omitempty"`
	Status              string       `json:"status"`
	Observacoes         string       `json:"observacoes,omitempty"`
	Itens               []ItemPedido `json:"itens,omitempty"`
	CreatedAt           time.Time    `json:"created_at"`
	UpdatedAt           time.Time    `json:"updated_at"`
	CreatedBy           *string      `json:"created_by,omitempty"`
	UpdatedBy           *string      `json:"updated_by,omitempty"`
}

type ItemDados struct {
	PartePecaID         int64
	QuantidadeSolicitada int
	PrecoUnitario       float64
}

type Dados struct {
	NumeroPC            string
	CotacaoID           *int64
	FornecedorID        int64
	DataPedido          time.Time
	DataEntregaPrevista time.Time
	CondicaoPagamento   string
	Observacoes         string
	Itens               []ItemDados
}

func (d *Dados) Normalizar() {
	d.NumeroPC = strings.ToUpper(strings.TrimSpace(d.NumeroPC))
	d.CondicaoPagamento = strings.TrimSpace(d.CondicaoPagamento)
	d.Observacoes = strings.TrimSpace(d.Observacoes)
}

func (d Dados) Validar() error {
	if d.FornecedorID <= 0 { return ErrFornecedorObrigatorio }
	if d.DataEntregaPrevista.IsZero() { return ErrDataEntregaObrigatoria }
	if !d.DataEntregaPrevista.After(d.DataPedido) { return ErrDataEntregaInvalida }
	if len(d.Itens) == 0 { return ErrItensObrigatorios }
	for _, item := range d.Itens {
		if item.QuantidadeSolicitada <= 0 { return ErrQuantidadeInvalida }
		if item.PrecoUnitario <= 0 { return ErrPrecoInvalido }
	}
	return nil
}
```

- [ ] Testes puros primeiro, depois implementar.
- [ ] Commit: `feat(backend): dominio de pedidos de compra`

### Tarefa B7: Domínio `pedidocompra` — serviço

**Arquivos:**
- Create: `backend/internal/domain/pedidocompra/servico.go`
- Create: `backend/internal/domain/pedidocompra/servico_test.go`

```go
var ColunasOrdenaveis = []string{
	"numero_pc", "data_pedido", "data_entrega_prevista", "valor_total", "status", "created_at",
}
var StatusPermitidos = []string{StatusRascunho, StatusEmitido, StatusAceito,
	StatusAguardandoEntrega, StatusRecebidoParcial, StatusConcluido, StatusCancelado}

type Repositorio interface {
	Criar(ctx context.Context, p *PedidoCompra, autor string) error
	Atualizar(ctx context.Context, p *PedidoCompra, autor string) error
	BuscarPorID(ctx context.Context, id int64) (*PedidoCompra, error)
	Listar(ctx context.Context, params consulta.Parametros) ([]PedidoCompra, int, error)
	AtualizarStatus(ctx context.Context, id int64, status string, autor string) error
	EmAtraso(ctx context.Context) ([]PedidoCompra, error)
}

type Servico struct{ repo Repositorio }
func NovoServico(repo Repositorio) *Servico { return &Servico{repo: repo} }

func (s *Servico) Criar(ctx context.Context, dados Dados, autor string) (*PedidoCompra, error) {
	dados.Normalizar()
	if strings.TrimSpace(dados.NumeroPC) == "" { return nil, ErrNumeroPCObrigatorio }
	if dados.DataPedido.IsZero() { dados.DataPedido = time.Now() }
	if err := dados.Validar(); err != nil { return nil, err }
	itens := make([]ItemPedido, len(dados.Itens))
	var total float64
	for i, id := range dados.Itens {
		subtotal := float64(id.QuantidadeSolicitada) * id.PrecoUnitario
		itens[i] = ItemPedido{PartePecaID: id.PartePecaID, QuantidadeSolicitada: id.QuantidadeSolicitada, PrecoUnitario: id.PrecoUnitario, Total: subtotal}
		total += subtotal
	}
	p := &PedidoCompra{
		NumeroPC: dados.NumeroPC, CotacaoID: dados.CotacaoID, FornecedorID: dados.FornecedorID,
		DataPedido: dados.DataPedido, DataEntregaPrevista: dados.DataEntregaPrevista,
		CondicaoPagamento: dados.CondicaoPagamento, Observacoes: dados.Observacoes,
		Status: StatusRascunho, ValorTotal: total, Itens: itens,
	}
	if err := s.repo.Criar(ctx, p, autor); err != nil { return nil, err }
	return p, nil
}

func (s *Servico) Atualizar(ctx, id, dados, autor) (*PedidoCompra, error) { /* guarda Status==Rascunho, como cotacao.Atualizar */ }
func (s *Servico) BuscarPorID(ctx, id) (*PedidoCompra, error) { return s.repo.BuscarPorID(ctx, id) }
func (s *Servico) Listar(ctx, params) ([]PedidoCompra, int, error) { return s.repo.Listar(ctx, params) }

func (s *Servico) Emitir(ctx context.Context, id int64, autor string) (*PedidoCompra, error) {
	p, err := s.repo.BuscarPorID(ctx, id)
	if err != nil { return nil, err }
	if p.Status != StatusRascunho { return nil, ErrStatusInvalidoParaAcao }
	if err := s.repo.AtualizarStatus(ctx, id, StatusEmitido, autor); err != nil { return nil, err }
	p.Status = StatusEmitido
	return p, nil
}

func (s *Servico) Cancelar(ctx context.Context, id int64, autor string) error {
	p, err := s.repo.BuscarPorID(ctx, id)
	if err != nil { return err }
	if p.Status == StatusCancelado || p.Status == StatusConcluido { return ErrStatusInvalidoParaAcao }
	return s.repo.AtualizarStatus(ctx, id, StatusCancelado, autor)
}

func (s *Servico) EmAtraso(ctx context.Context) ([]PedidoCompra, error) { return s.repo.EmAtraso(ctx) }
```

- [ ] `servico_test.go`: criar calcula valor_total; emitir fora de Rascunho falha; cancelar
  bloqueado se Concluido/Cancelado; em-atraso traz só os com `data_entrega_prevista <
  CURRENT_DATE` e status não terminal (inserir fixtures via `pool.Exec` direto, como
  `inserirPedido` em `fornecedor/servico_test.go`).
- [ ] Commit: `feat(backend): casos de uso de pedidos de compra`

### Tarefa B8: Repositório e handler `pedidocompra`

**Arquivos:**
- Create: `backend/internal/infra/repository/pedido_compra_repo.go` + `_test.go`
- Create: `backend/internal/api/handlers/pedidos_compra.go` + `_test.go`

Mesmo padrão de B4/B5, adaptado para `pedidos_compra`/`itens_pedido_compra`. Rotas:

```go
rotas := grupo.Group("/pedidos-compra", autenticacao)
rotas.GET("", h.Listar)
rotas.GET("/em-atraso", h.EmAtraso)   // registrar ANTES de "/:id" — Echo casa por ordem
rotas.GET("/:id", h.Obter)
rotas.POST("", h.Criar, gestao)
rotas.PUT("/:id", h.Atualizar, gestao)
rotas.POST("/:id/emitir", h.Emitir, gestao)
rotas.POST("/:id/cancelar", h.Cancelar, gestao)
```

`EmAtraso` não pagina (é um alerta operacional, lista curta por natureza) — responde
`httpx.OK(c, itens)`, não `httpx.Lista`.

`errosPedidoCompra` — mesma estrutura de `errosCotacao`, com as sentinelas de
`pedidocompra.Err*`. Exportar (`var ErrosPedidoCompra = ...` ou uma função) para que o
handler de Cotação (Tarefa B5, `ConverterEmPedido`) consiga reusar o mapeamento de erro do
lado do PC sem duplicar a tabela.

- [ ] Testes de repositório e de handler primeiro (mesma cobertura de B4/B5, adaptada:
  incluir teste de `/em-atraso` com um PC vencido e um dentro do prazo, confirmando que só o
  vencido aparece; e que um PC `Concluido` vencido NÃO aparece).
- [ ] Implementar, ver passar.
- [ ] Commit: `feat(backend): repositorio e handler de pedidos de compra`

### Tarefa B9: Wiring e verificação final do backend

**Arquivos:**
- Modify: `backend/internal/api/routes.go`

```go
func registrarCompras(v1 *echo.Group, dep Dependencias, autenticacao echo.MiddlewareFunc) {
	pedidoServico := pedidocompra.NovoServico(repository.NovoPedidoCompraRepositorio(dep.Pool))
	cotacaoServico := cotacao.NovoServico(repository.NovoCotacaoRepositorio(dep.Pool))

	handlers.NovoCotacaoHandler(cotacaoServico, pedidoServico).Registrar(v1, autenticacao)
	handlers.NovoPedidoCompraHandler(pedidoServico).Registrar(v1, autenticacao)
}
```
Chamar `registrarCompras(v1, dep, autenticacao)` em `NovoRoteador`, logo após
`registrarCadastros`.

- [ ] `go build ./...`, `go vet ./...`, `gofmt -l .` (sem saída), `go test ./...` — suíte
  inteira verde, incluindo os 255 testes que já existiam.
- [ ] Testar manualmente com `curl` os fluxos ponta a ponta: criar cotação → enviar →
  registrar-resposta → converter-pc → emitir PC → cancelar PC. Confirmar os envelopes de
  sucesso/erro batem com a doc 3.
- [ ] Commit: `feat(backend): registra as rotas de compras no roteador`

---

## Tarefas — Frontend

### Tarefa F1: Tipos e serviço de compras

**Arquivos:**
- Create: `frontend/src/tipos/compras.ts`
- Create: `frontend/src/servicos/compras.ts` + `.test.ts`

```ts
export type StatusCotacao = 'Rascunho' | 'Enviada' | 'Respondida' | 'Cancelada';
export type StatusPedidoCompra =
  | 'Rascunho' | 'Emitido' | 'Aceito' | 'Aguardando Entrega'
  | 'Recebido Parcial' | 'Concluido' | 'Cancelado';

export interface ItemCotacao {
  id: number;
  parte_peca_id: number;
  quantidade: number;
  preco_unitario: number;
  total: number;
}

export interface Cotacao {
  id: number;
  numero_cotacao: string;
  fornecedor_id: number;
  data_emissao: string;
  data_validade: string;
  data_resposta?: string | null;
  valor_total: number | null;
  status: StatusCotacao;
  observacoes?: string;
  itens?: ItemCotacao[];
  created_at: string;
  updated_at: string;
}

export interface ItemPedidoCompra {
  id: number;
  parte_peca_id: number;
  quantidade_solicitada: number;
  quantidade_recebida: number;
  preco_unitario: number;
  total: number;
}

export interface PedidoCompra {
  id: number;
  numero_pc: string;
  cotacao_id?: number | null;
  fornecedor_id: number;
  data_pedido: string;
  data_entrega_prevista: string;
  data_entrega_real?: string | null;
  valor_total: number;
  condicao_pagamento?: string;
  status: StatusPedidoCompra;
  observacoes?: string;
  itens?: ItemPedidoCompra[];
  created_at: string;
  updated_at: string;
}

/** Espelha o que `consulta.AnalisarComStatus` aceita — igual a ParametrosListagem,
 * mas com `status` no lugar de `filtro_ativo`. */
export interface ParametrosListagemCompras {
  pagina: number;
  limite: number;
  ordenar_por: string;
  ordem: Ordem;
  busca: string;
  status: string | null;
}
```

`servicos/compras.ts` — mirror de `servicos/cadastros.ts` (`listar`/`obter`/`criar`/`atualizar`
genéricos, com `paramsDeConsultaCompras` omitindo `busca`/`status` vazios), mais as ações:

```ts
export async function enviarCotacao(id: number): Promise<Cotacao> { ... POST /cotacoes/${id}/enviar }
export async function registrarRespostaCotacao(id: number, corpo: {...}): Promise<Cotacao> { ... }
export async function cancelarCotacao(id: number): Promise<Cotacao> { ... POST .../cancelar }
export async function converterCotacaoEmPedido(id: number, corpo: {...}): Promise<PedidoCompra> { ... }
export async function emitirPedidoCompra(id: number): Promise<PedidoCompra> { ... }
export async function cancelarPedidoCompra(id: number): Promise<PedidoCompra> { ... }
export async function listarPedidosEmAtraso(): Promise<PedidoCompra[]> { ... GET /pedidos-compra/em-atraso, sem envelope de paginacao }
```

- [ ] Testes primeiro (`compras.test.ts`, usando `instalarServidorFalso` — mesmo padrão de
  `cadastros.test.ts`): listar desembrulha; listar omite busca/status vazios; cada ação bate
  na rota certa com o método certo.
- [ ] Implementar, ver passar.
- [ ] Commit: `feat(frontend): tipos e servico de compras`

### Tarefa F2: `TrilhaEtapas` — componente novo (design system §5)

**Arquivos:**
- Create: `frontend/src/componentes/ui/TrilhaEtapas.tsx` + `.test.tsx`

Este é o único componente verdadeiramente novo desta sprint (nenhuma tela anterior precisou
dele) — é a "assinatura visual" do sistema, então merece teste próprio e vai ser reusado
pelas telas de Cotação e PC (e depois por OPs/Kanban, Sprint 6-7).

```ts
export type EstadoEtapa = 'concluida' | 'pendente-acionavel' | 'pendente-futura' | 'bloqueada';

export interface Etapa {
  chave: string;
  nome: string;
  estado: EstadoEtapa;
  /** "HH:MM" ou data — só para etapas concluidas. */
  timestamp?: string;
  /** Nome de quem executou — só para etapas concluidas. */
  executante?: string;
  /** Chamado ao clicar numa etapa 'pendente-acionavel'. Ignorado nos demais estados. */
  aoAcionar?: () => void;
}

export interface TrilhaEtapasProps {
  rotulo: string; // aria-label da trilha inteira
  etapas: Etapa[];
}
```

Anatomia exata e mapa de ícone/cor por `docs/... SKILL.md §5`:

| Estado | Classe de cor | Ícone | Rótulo | Interação |
|---|---|---|---|---|
| `concluida` | `text-estado-done` sobre `bg-estado-done-bg` | `check-circle-2` | "Concluída · {timestamp}" | `<button>` — abre em consulta (via `aoAcionar` se informado, senão inerte) |
| `pendente-acionavel` | `text-estado-pending` sobre `bg-estado-pending-bg`, borda 2px | `circle-dot` | "Pendente · iniciar" | `<button>`, chama `aoAcionar` |
| `pendente-futura` | `text-estado-pending` a 45% opacidade (`opacity-45`) | `circle` | "Aguardando etapa anterior" | inerte — `aria-disabled`, clique não faz nada (sem alert; o rótulo já explica) |
| `bloqueada` | `text-estado-blocked` sobre `bg-estado-blocked-bg` | `shield-alert` | "Bloqueada · aguardando aprovação" | `<button>` se `aoAcionar` informado, senão inerte |

Acessibilidade (obrigatório, testar): `role="list"` na trilha, `role="listitem"` por etapa,
`aria-current="step"` na etapa `pendente-acionavel`, `aria-disabled` nas `pendente-futura`,
foco visível 2px (classe já usada em `Botao`/`Campo`), navegação por Tab só nas etapas
interativas (usar `<button disabled>` — sai do fluxo de Tab nativamente — para as inertes,
em vez de `tabindex=-1` num `<div>`, que é mais frágil).

Em telas estreitas vira vertical (`flex-col md:flex-row` no container).

Ícones novos a acrescentar em `icones.ts` se ainda não existirem: `check-circle-2` (já existe),
`circle-dot` (já existe), `circle` (já existe), `shield-alert` (já existe) — **conferir antes
de importar**, o registro já tem esses quatro do trabalho anterior.

- [ ] Testes primeiro: renderiza `role="list"`/`role="listitem"`; cada estado mostra o
  ícone+rótulo certo; `aria-current="step"` só na acionável; clique em `pendente-acionavel`
  chama `aoAcionar`; clique em `pendente-futura` não chama nada (é inerte); clique em
  `concluida` sem `aoAcionar` não quebra; `aria-disabled` nas futuras.
- [ ] Implementar, ver passar.
- [ ] Commit: `feat(frontend): trilha de etapas (padrao do design system)`

### Tarefa F3: Hook de listagem por status

**Arquivos:**
- Create: `frontend/src/hooks/useListagemCompras.ts` + `.test.tsx`

Mirror de `useListagem.ts`, mas parametrizado por status em vez de ativo (ambos os módulos —
Cotação e PC — têm a mesma forma de parâmetros, então um hook genérico serve aos dois sem
repetição; ao contrário do Sprint 2, aqui a duplicação já é visível de antemão, então a
extração acontece direto, sem esperar um "Task 15b").

```ts
export function useListagemCompras<T>(
  recurso: 'cotacoes' | 'pedidos-compra',
  colunaPadrao: string,
): ListagemCompras<T> { /* estado: busca, pagina, ordenarPor, ordem, status (string|null,
  comeca null = "todos"), mais useQuery com servicos/compras.listar */ }
```

- [ ] Testes primeiro (mirror de `useListagem.test.tsx`): debounce da busca; reset de página
  ao mudar busca/status; alternar ordenação.
- [ ] Implementar, ver passar.
- [ ] Commit: `feat(frontend): hook de listagem por status`

### Tarefa F4: Tela de Cotações — lista

**Arquivos:**
- Create: `frontend/src/paginas/compras/Cotacoes.tsx` + `.test.tsx`
- Modify: `frontend/src/App.tsx` (rota `/cotacoes`)

Lista com `Tabela` (colunas: número, fornecedor — nome resolvido via `useQuery` de
`fornecedores` para popular um mapa id→razão social, já que a API só devolve `fornecedor_id`;
data de validade; valor total formatado com `formatarMoeda`; status como `Badge` usando o
mapa de tom descrito abaixo). Filtro de status via `Selecao` (opções: Todos, Rascunho,
Enviada, Respondida, Cancelada) no lugar do filtro Ativo/Inativo da `BarraDeFiltros` — como a
`BarraDeFiltros` existente é hard-coded para ativo/inativo, criar aqui uma variante local
inline (não vale a pena generalizar o componente pra um único caso de uso a mais neste
momento; se a tela de Pedidos de Compra dtambém precisar do mesmo filtro literal, considerar
extrair depois, mesmo espírito do Task 15b).

Mapa de tom por status (comentar o raciocínio no código, é uma decisão de design):

```ts
const TOM_STATUS_COTACAO: Record<StatusCotacao, { tom: TomBadge; icone: NomeIcone }> = {
  Rascunho: { tom: 'neutral', icone: 'circle' },
  Enviada: { tom: 'blocked', icone: 'shield-alert' }, // aguardando resposta do fornecedor
  Respondida: { tom: 'done', icone: 'check-circle-2' },
  Cancelada: { tom: 'neutral', icone: 'circle' },
};
```

"Nova cotação" navega para `/cotacoes/nova` (página cheia, não modal — o formulário tem uma
sublista de itens que não cabe confortavelmente num modal de 560px). Clicar numa linha
navega para `/cotacoes/:id`.

- [ ] Testes primeiro: mostra as colunas certas; badge de status pelo tom certo; filtro de
  status muda a query; "Nova cotação" navega para `/cotacoes/nova`; clique na linha navega
  para o detalhe.
- [ ] Implementar, ver passar.
- [ ] Commit: `feat(frontend): lista de cotacoes`

### Tarefa F5: Formulário de nova cotação (página cheia)

**Arquivos:**
- Create: `frontend/src/paginas/compras/NovaCotacao.tsx` + `.test.tsx`
- Modify: `frontend/src/App.tsx` (rota `/cotacoes/nova`)

`react-hook-form` com `useFieldArray` para a lista de itens (fornecedor via `Selecao`
populada por `useQuery` de fornecedores ativos; data de validade via `Campo type="date"`;
itens: cada linha tem `Selecao` de parte/peça — populada por `useQuery` de partes/peças
ativas —, campo de quantidade e campo de preço unitário, com um subtotal calculado ao vivo
(`quantidade * preco`, exibido em `data` mono, não enviado ao servidor — o backend recalcula);
botão "Adicionar item" e um "Remover" por linha; total geral exibido no rodapé). Número da
cotação é digitado à mão pelo usuário (não há geração automática no backend — ver nota da
Tarefa B2) — `Campo tipoDado="codigo"` com `ajuda="Ex.: COT-2026-001"`.

- [ ] Testes primeiro: envia o corpo certo; erro 409 (número duplicado) mostra alerta;
  adicionar/remover item funciona; não permite salvar com zero itens (validação client-side
  espelhando `ErrItensObrigatorios`); toast "Cotação cadastrada" e navega para `/cotacoes/:id`.
- [ ] Implementar, ver passar.
- [ ] Commit: `feat(frontend): formulario de nova cotacao`

### Tarefa F6: Detalhe da cotação (trilha de etapas + ações)

**Arquivos:**
- Create: `frontend/src/paginas/compras/DetalheCotacao.tsx` + `.test.tsx`
- Modify: `frontend/src/App.tsx` (rota `/cotacoes/:id`)

Cabeçalho com número, fornecedor, datas; `TrilhaEtapas` com as etapas Rascunho → Enviada →
Respondida, mais Cancelada tratada à parte (uma cotação cancelada substitui a trilha por um
aviso simples "Cotação cancelada em {data}", já que cancelamento não é uma "próxima etapa" da
sequência feliz — é a saída lateral, como o design system já resolve pra qualquer fluxo com
saída de exceção). Etapa acionável conforme o status atual chama a ação por
`aoAcionar`: em Rascunho, "Enviar" abre uma `Confirmacao`; em Enviada, "Registrar resposta"
abre um `Modal` com os itens e um campo de preço por item (reaproveitando a mesma ideia de
`useFieldArray`, mas só editando preço, não adicionando/removendo linhas); em Respondida,
"Converter em pedido de compra" abre um `Modal` pedindo `data_entrega_prevista` e
`condicao_pagamento`, e ao salvar navega para `/pedidos-compra/:id` do PC recém-criado.
Tabela de itens abaixo da trilha (`Tabela`, sem paginação — lista curta). Botão "Cancelar
cotação" (fantasma, ícone `trash-2`) visível enquanto não `Cancelada`, com `Confirmacao`.

- [ ] Testes primeiro: mostra a trilha com a etapa certa marcada; em Rascunho, "Enviar" muda
  o status e a trilha; em Enviada, registrar resposta muda status e mostra os preços
  atualizados; em Respondida, converter navega para o PC criado; cancelar mostra confirmação
  antes de agir; cotação cancelada mostra o aviso em vez da trilha.
- [ ] Implementar, ver passar.
- [ ] Commit: `feat(frontend): detalhe da cotacao com trilha de etapas`

### Tarefa F7: Tela de Pedidos de Compra — lista

**Arquivos:**
- Create: `frontend/src/paginas/compras/PedidosCompra.tsx` + `.test.tsx`
- Modify: `frontend/src/App.tsx` (rota `/pedidos-compra`)

Mesmo padrão de F4, adaptado (colunas: número, fornecedor, data de entrega prevista, valor
total, status). Mapa de tom:

```ts
const TOM_STATUS_PC: Record<StatusPedidoCompra, { tom: TomBadge; icone: NomeIcone }> = {
  Rascunho: { tom: 'neutral', icone: 'circle' },
  Emitido: { tom: 'blocked', icone: 'shield-alert' },
  Aceito: { tom: 'blocked', icone: 'shield-alert' },
  'Aguardando Entrega': { tom: 'blocked', icone: 'shield-alert' },
  'Recebido Parcial': { tom: 'warning', icone: 'alert-triangle' },
  Concluido: { tom: 'done', icone: 'check-circle-2' },
  Cancelado: { tom: 'neutral', icone: 'circle' },
};
```

Além da lista paginada, um bloco no topo "Pedidos em atraso" (via `listarPedidosEmAtraso`,
sem paginação) — visível só quando não vazio, cada linha com um badge de tom `warning` e um
link para o detalhe. "Novo pedido de compra" navega para `/pedidos-compra/novo` (aceita
`?cotacao_id=` opcional para pré-selecionar, embora o fluxo principal de criar-a-partir-de-
cotação seja o botão "Converter" na Tarefa F6 — a criação manual continua disponível para PC
sem cotação prévia).

- [ ] Testes primeiro (mirror de F4, mais o bloco de atraso).
- [ ] Implementar, ver passar.
- [ ] Commit: `feat(frontend): lista de pedidos de compra`

### Tarefa F8: Formulário de novo pedido de compra

**Arquivos:**
- Create: `frontend/src/paginas/compras/NovoPedidoCompra.tsx` + `.test.tsx`
- Modify: `frontend/src/App.tsx` (rota `/pedidos-compra/novo`)

Mesmo padrão de F5 (itens via `useFieldArray`), campos: fornecedor, data de entrega prevista,
condição de pagamento, itens (parte/peça, quantidade solicitada, preço unitário). Número do
PC digitado à mão, como a cotação.

- [ ] Testes primeiro, implementar, ver passar.
- [ ] Commit: `feat(frontend): formulario de novo pedido de compra`

### Tarefa F9: Detalhe do pedido de compra

**Arquivos:**
- Create: `frontend/src/paginas/compras/DetalhePedidoCompra.tsx` + `.test.tsx`
- Modify: `frontend/src/App.tsx` (rota `/pedidos-compra/:id`)

`TrilhaEtapas` com Rascunho → Emitido → (Aceito/Aguardando Entrega/Recebido Parcial,
colapsadas visualmente numa etapa "Em andamento" já que não há ação do usuário que as
diferencie nesta sprint — a transição entre elas pertence ao recebimento, Sprint 4) →
Concluído; Cancelado como aviso lateral, igual à cotação. Ação disponível: em Rascunho,
"Emitir" (`Confirmacao`); em qualquer status não-terminal, "Cancelar" (`Confirmacao`). Se
`cotacao_id` estiver presente, um link "Ver cotação de origem" para `/cotacoes/:cotacao_id`.
Tabela de itens com quantidade solicitada/recebida (recebida sempre 0 nesta sprint — a coluna
já existe no schema para quando o recebimento chegar na Sprint 4, mas não expor ainda ação de
editá-la).

- [ ] Testes primeiro, implementar, ver passar.
- [ ] Commit: `feat(frontend): detalhe do pedido de compra`

### Tarefa F10: Navegação, Ajuda e Painel

**Arquivos:**
- Modify: `frontend/src/componentes/layout/NavegacaoLateral.tsx`
- Modify: `frontend/src/componentes/layout/NavegacaoLateral.test.tsx`
- Modify: `frontend/src/componentes/layout/Ajuda.tsx`
- Modify: `frontend/src/componentes/layout/Ajuda.test.tsx`
- Modify: `frontend/src/paginas/Painel.tsx` + `.test.tsx`

`NavegacaoLateral`: trocar o item cinza "Compras / Próxima sprint" por uma seção "Compras"
com dois links reais — "Cotações" (`/cotacoes`) e "Pedidos de compra" (`/pedidos-compra`) —
seguindo a mesma estrutura visual da seção "Cadastros" já existente.

`Ajuda`: o lookup atual é por `pathname` exato (`CONTEUDO_POR_ROTA[pathname]`), o que não
cobre `/cotacoes/123` nem `/pedidos-compra/nova`. Trocar a resolução por um `find` que testa
prefixos, mantendo a semântica: raízes exatas (`/`, `/login`) continuam por igualdade; as
novas entradas (`/fornecedores`, `/partes-pecas`, `/produtos-acabados` também, para
consistência) usam `pathname.startsWith(rota + '/') || pathname === rota`. Acrescentar
conteúdo para `/cotacoes` e `/pedidos-compra` explicando o fluxo de status (enviar → registrar
resposta → converter em pedido; emitir → cancelar).

`Painel`: o widget "Pedidos de compra a receber" hoje mostra sempre a mensagem "ainda não
existe, entra na Sprint 3" — que fica **errada** assim que este módulo for ao ar. Trocar por
uma consulta real a `listarPedidosEmAtraso()`: vazio → "Nenhum pedido de compra em atraso.";
com itens → contagem + lista dos números de PC, mesmo padrão dos outros cartões do painel
(sem número inventado, só o que a API realmente devolve).

- [ ] Testes primeiro para cada um dos três arquivos (novos casos, sem quebrar os existentes).
- [ ] Implementar, ver passar.
- [ ] Commit: `feat(frontend): navegacao, ajuda e painel para compras`

### Tarefa F11: Verificação final do frontend

- [ ] `npm test` (suíte inteira), `npm run lint`, `npm run build` — todos verdes.
- [ ] Rodar o mesmo roteiro de verificação de navegador do Task 18 anterior (Playwright real,
  não API direta) nas 4 telas novas: criar cotação, enviar, registrar resposta, converter em
  PC, emitir PC, cancelar (cotação e PC), filtro de status, ordenação, busca. Confirmar
  grayscale (badges de `blocked`/`warning` também precisam sobreviver — ícone distinto por
  tom já garante isso, mas conferir visualmente), só teclado (a trilha de etapas em especial —
  é a peça mais nova e mais arriscada de acessibilidade), e 800px sem rolagem horizontal.
- [ ] Corrigir qualquer achado, com o mesmo rigor da rodada anterior (Task 18/19 do Sprint 2
  encontraram 3 bugs reais assim — não pular esta etapa).

---

## Tarefa final: documentação e entrega

### Tarefa 20: Screenshots, manual e ledger

- [ ] Capturar telas novas em `docs/screenshots/` (mesmo processo da Task 19 anterior —
  Playwright contra o app real, dados de exemplo realistas): lista de cotações, nova cotação,
  detalhe de cotação em cada etapa relevante (ao menos Rascunho e Respondida, para mostrar a
  trilha em dois estados), lista de PCs (com o bloco de atraso visível), novo PC, detalhe de
  PC, painel atualizado com o widget real.
- [ ] Atualizar `docs/8_MANUAL_OPERACAO.md`: nova seção "Cotações e Pedidos de Compra" com o
  fluxo completo (criar cotação → enviar → registrar resposta → converter em PC → emitir →
  cancelar), screenshots incluídas, e uma entrada na tabela de perguntas frequentes para "o
  que significa cada status".
- [ ] Atualizar `.superpowers/sdd/progress.md`: nova seção "## Sprint 3 — Cotações e Pedidos
  de Compra", plano referenciado, decisões de pré-voo (branch empilhada, escopo excluído),
  ledger tarefa por tarefa no mesmo formato `Task N: complete (commits X..Y, review ...)` das
  demais — **não repetir o erro da Task 18 anterior**.
- [ ] Commit final, push, abrir PR com base em `feat/telas-de-cadastro` (não `main`).

---

## Notas de revisão do plano

**Ordem de execução seguro**: B1→B2→B3 podem rodar em paralelo com F1→F2→F3 (frontend usa
servidor falso, não depende do backend real). B4→B5 dependem de B1-B3. B6→B7→B8 dependem de
B3 (mesma extensão de `consulta`) mas não de B4/B5 — podem rodar em paralelo com eles, exceto
que B5's `ConverterEmPedido` precisa de `pedidocompra.Servico` (B7) já existir. F4-F6 (Cotação)
dependem de F1-F3; F7-F9 (PC) idem; F10 depende de F4-F9 existirem (rotas). Screenshots e
manual são sempre a última etapa, depois de tudo verde.

**`numero_cotacao`/`numero_pc` são digitados pelo usuário, não gerados**: a doc 3 mostra
exemplos como "COT-2026-001", mas não existe (nem nesta sprint se propõe a criar) um gerador
de sequência no backend — nenhum outro módulo tem isso (código de peça/produto também é
digitado). Se o usuário achar isso um problema no dia a dia, é uma melhoria pra considerar
numa sprint futura (sequência por ano, à parte); não inventar aqui silenciosamente.

**"Tirar um acessório" (§8 do design system)**: aplicar o mesmo passo final de revisão do
Task 18 anterior nas 4 telas novas antes de fechar a Tarefa F11 — cada tela deve perder o
elemento que menos serve à decisão de quem opera.
