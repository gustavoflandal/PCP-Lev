// Package rastreio reune as consultas de rastreabilidade do recebimento
// fiscal (doc 0, 4.3.7) e o kardex por item (4.4): do lote ao campo, do saldo
// a origem e o extrato com documento de origem.
package rastreio

import (
	"context"
	"errors"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

var ErrLoteNaoEncontrado = errors.New("lote nao encontrado")

// Lote e um lote de fornecedor com o saldo segregado.
type Lote struct {
	ID                  int64      `json:"id"`
	PartePecaID         int64      `json:"parte_peca_id"`
	PecaCodigo          string     `json:"peca_codigo"`
	PecaDescricao       string     `json:"peca_descricao"`
	NumeroLote          string     `json:"numero_lote"`
	FornecedorID        *int64     `json:"fornecedor_id,omitempty"`
	FornecedorNome      string     `json:"fornecedor_nome"`
	DataFabricacao      tempo.Data `json:"data_fabricacao,omitzero"`
	Validade            tempo.Data `json:"validade,omitzero"`
	QuantidadeAtual     int        `json:"quantidade_atual"`
	QuantidadeReservada int        `json:"quantidade_reservada"`
	Vencido             bool       `json:"vencido"`
}

// EntradaNF e uma entrada por nota fiscal.
type EntradaNF struct {
	NotaID         int64      `json:"nota_id"`
	Numero         string     `json:"numero"`
	Serie          string     `json:"serie"`
	DataEntrada    tempo.Data `json:"data_entrada"`
	FornecedorNome string     `json:"fornecedor_nome"`
	Quantidade     int        `json:"quantidade"`
	CustoUnitario  *float64   `json:"custo_unitario,omitempty"`
	NumeroLote     string     `json:"numero_lote,omitempty"`
}

// ConsumoOP e o consumo de um lote por uma OP.
type ConsumoOP struct {
	OrdemProducaoID int64  `json:"ordem_producao_id"`
	NumeroOP        string `json:"numero_op"`
	Quantidade      int    `json:"quantidade"`
	ProdutoCodigo   string `json:"produto_codigo"`
}

// UnidadeAfetada e uma unidade produzida que recebeu (ou pode ter recebido)
// material do lote. Direta = a serie do componente esta instalada nela.
type UnidadeAfetada struct {
	SerieID       int64  `json:"serie_id"`
	Numero        string `json:"numero"`
	Status        string `json:"status"`
	ProdutoCodigo string `json:"produto_codigo"`
	NumeroOP      string `json:"numero_op"`
	PedidoVendaID int64  `json:"pedido_venda_id"`
	NumeroPedido  string `json:"numero_pedido"`
	ClienteNome   string `json:"cliente_nome"`
	Direta        bool   `json:"direta"`
}

// RastreioLote: do lote defeituoso ao campo.
type RastreioLote struct {
	Lote     Lote             `json:"lote"`
	Entradas []EntradaNF      `json:"entradas"`
	Consumos []ConsumoOP      `json:"consumos"`
	Unidades []UnidadeAfetada `json:"unidades"`
}

// Movimento e uma linha do kardex, com o saldo apos ela e o documento.
type Movimento struct {
	ID            int64     `json:"id"`
	DataHora      time.Time `json:"data_hora"`
	Tipo          string    `json:"tipo"`
	Motivo        string    `json:"motivo"`
	Quantidade    int       `json:"quantidade"`
	Saldo         int       `json:"saldo"`
	DocumentoTipo *string   `json:"documento_tipo,omitempty"`
	DocumentoID   *int64    `json:"documento_id,omitempty"`
	Referencia    *string   `json:"referencia,omitempty"`
	NumeroLote    *string   `json:"numero_lote,omitempty"`
	Usuario       *string   `json:"usuario,omitempty"`
	CustoUnitario *float64  `json:"custo_unitario,omitempty"`
	Observacoes   string    `json:"observacoes"`
}

// Origens: do saldo atual as notas que o originaram (cobertura FIFO).
type Origens struct {
	PartePecaID int64       `json:"parte_peca_id"`
	Saldo       int         `json:"saldo"`
	Lotes       []Lote      `json:"lotes"`
	Entradas    []EntradaNF `json:"entradas"`
	// SemOrigem: parte do saldo que nao vem de nota (inventario de abertura,
	// ajuste ou saldo anterior a v1.2).
	SemOrigem int `json:"sem_origem"`
}

// FiltroLotes filtra a listagem de lotes.
type FiltroLotes struct {
	PartePecaID  int64
	Busca        string
	VencendoDias int
	SoComSaldo   bool
}

// Repositorio e a porta de leitura.
type Repositorio interface {
	ListarLotes(ctx context.Context, f FiltroLotes) ([]Lote, error)
	RastrearLote(ctx context.Context, id int64) (*RastreioLote, error)
	Kardex(ctx context.Context, partePecaID int64, limite int) ([]Movimento, error)
	Origens(ctx context.Context, partePecaID int64) (*Origens, error)
}

// Servico reune as consultas.
type Servico struct{ repo Repositorio }

// NovoServico monta o servico.
func NovoServico(repo Repositorio) *Servico { return &Servico{repo: repo} }

// ListarLotes devolve lotes (por peca, busca ou vencimento).
func (s *Servico) ListarLotes(ctx context.Context, f FiltroLotes) ([]Lote, error) {
	if f.VencendoDias < 0 || f.VencendoDias > 3650 {
		f.VencendoDias = 0
	}
	return s.repo.ListarLotes(ctx, f)
}

// RastrearLote devolve entradas, consumos e unidades afetadas.
func (s *Servico) RastrearLote(ctx context.Context, id int64) (*RastreioLote, error) {
	return s.repo.RastrearLote(ctx, id)
}

// Kardex devolve o extrato do item (mais recente primeiro).
func (s *Servico) Kardex(ctx context.Context, partePecaID int64, limite int) ([]Movimento, error) {
	if limite <= 0 || limite > 1000 {
		limite = 200
	}
	return s.repo.Kardex(ctx, partePecaID, limite)
}

// Origens devolve de onde veio o saldo atual.
func (s *Servico) Origens(ctx context.Context, partePecaID int64) (*Origens, error) {
	return s.repo.Origens(ctx, partePecaID)
}
