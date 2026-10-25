// Package pedidovenda contem o pedido de venda -- o que o cliente comprou e
// quando foi prometido (RF4). Cada item vira uma Ordem de Producao (Fase 3).
package pedidovenda

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

// Status do pedido (CHECK chk_pv_status da migration 017).
const (
	StatusAberto          = "Aberto"
	StatusEmProducao      = "Em Producao"
	StatusProntoParaEnvio = "Pronto para Envio"
	StatusEntregue        = "Entregue"
	StatusCancelado       = "Cancelado"
)

// StatusPermitidos e o conjunto fechado do filtro `status`.
var StatusPermitidos = []string{StatusAberto, StatusEmProducao, StatusProntoParaEnvio, StatusEntregue, StatusCancelado}

// ColunasOrdenaveis restringe o `ordenar_por` da listagem.
var ColunasOrdenaveis = []string{"numero_pedido", "data_pedido", "data_entrega_prometida", "valor_total", "status", "cliente"}

var (
	ErrNumeroObrigatorio      = errors.New("informe o numero do pedido (ate 50 caracteres)")
	ErrNumeroDuplicado        = errors.New("ja existe um pedido de venda com este numero")
	ErrClienteObrigatorio     = errors.New("informe o cliente")
	ErrClienteInvalido        = errors.New("o cliente informado nao existe ou esta inativo")
	ErrDatasInvalidas         = errors.New("informe a data do pedido e uma data de entrega prometida posterior a ela")
	ErrSemItens               = errors.New("o pedido precisa de ao menos um item")
	ErrItemInvalido           = errors.New("cada item precisa de produto, quantidade maior que zero e preco maior que zero")
	ErrProdutoRepetido        = errors.New("o mesmo produto aparece em mais de um item -- some as quantidades")
	ErrProdutoInvalido        = errors.New("um dos produtos nao existe ou esta inativo")
	ErrObservacoesLongas      = errors.New("as observacoes vao ate 1000 caracteres")
	ErrNaoEncontrado          = errors.New("pedido de venda nao encontrado")
	ErrStatusInvalidoParaAcao = errors.New("esta acao nao e permitida na situacao atual do pedido")
	ErrPossuiOPEmAndamento    = errors.New("o pedido tem OP liberada ou concluida -- cancele as OPs antes")
	ErrSaldoPAInsuficiente    = errors.New("nao ha produto acabado em estoque suficiente para esta entrega")
	// ErrItensComHistorico: um item teve OP liberada (com series e reserva no
	// historico) -- os itens nao podem mais ser regravados.
	ErrItensComHistorico = errors.New("um item deste pedido ja teve OP liberada (mesmo que cancelada) -- os itens nao podem mais ser alterados; cancele o pedido e crie outro")
)

// Item e uma linha do pedido.
type Item struct {
	ID               int64             `json:"id"`
	ProdutoAcabadoID int64             `json:"produto_acabado_id"`
	ProdutoCodigo    string            `json:"produto_codigo"`
	ProdutoDescricao string            `json:"produto_descricao"`
	Quantidade       int               `json:"quantidade"`
	PrecoUnitario    dinheiro.Dinheiro `json:"preco_unitario"`
	Total            dinheiro.Dinheiro `json:"total"`
	// OP gerada para o item (nil enquanto nao gerada).
	OrdemProducaoID *int64  `json:"ordem_producao_id,omitempty"`
	NumeroOP        *string `json:"numero_op,omitempty"`
	StatusOP        *string `json:"status_op,omitempty"`
	EtapaOP         *string `json:"etapa_op,omitempty"`
}

// PedidoVenda e o pedido do cliente.
type PedidoVenda struct {
	ID                   int64             `json:"id"`
	NumeroPedido         string            `json:"numero_pedido"`
	ClienteID            int64             `json:"cliente_id"`
	ClienteNome          string            `json:"cliente_nome"`
	DataPedido           tempo.Data        `json:"data_pedido"`
	DataEntregaPrometida tempo.Data        `json:"data_entrega_prometida"`
	DataEntregaReal      tempo.Data        `json:"data_entrega_real,omitzero"`
	ValorTotal           dinheiro.Dinheiro `json:"valor_total"`
	Status               string            `json:"status"`
	Observacoes          string            `json:"observacoes"`
	Itens                []Item            `json:"itens,omitempty"`
	CreatedAt            time.Time         `json:"created_at"`
	UpdatedAt            time.Time         `json:"updated_at"`
}

// ItemDados e um item informado na criacao/edicao.
type ItemDados struct {
	ProdutoAcabadoID int64
	Quantidade       int
	PrecoUnitario    dinheiro.Dinheiro
}

// Dados sao os campos informados.
type Dados struct {
	NumeroPedido         string
	ClienteID            int64
	DataPedido           tempo.Data
	DataEntregaPrometida tempo.Data
	Observacoes          string
	Itens                []ItemDados
}

// Normalizar limpa espacos.
func (d *Dados) Normalizar() {
	d.NumeroPedido = strings.TrimSpace(d.NumeroPedido)
	d.Observacoes = strings.TrimSpace(d.Observacoes)
}

// Validar confere a forma (existencia de cliente/produto fica no repositorio).
func (d Dados) Validar() error {
	switch {
	case d.NumeroPedido == "" || utf8.RuneCountInString(d.NumeroPedido) > 50:
		return ErrNumeroObrigatorio
	case d.ClienteID <= 0:
		return ErrClienteObrigatorio
	case d.DataPedido.IsZero() || d.DataEntregaPrometida.IsZero() || !d.DataEntregaPrometida.After(d.DataPedido):
		return ErrDatasInvalidas
	case utf8.RuneCountInString(d.Observacoes) > 1000:
		return ErrObservacoesLongas
	case len(d.Itens) == 0:
		return ErrSemItens
	}
	vistos := map[int64]bool{}
	for _, i := range d.Itens {
		if i.ProdutoAcabadoID <= 0 || i.Quantidade <= 0 || !i.PrecoUnitario.Positivo() {
			return ErrItemInvalido
		}
		if vistos[i.ProdutoAcabadoID] {
			return ErrProdutoRepetido
		}
		vistos[i.ProdutoAcabadoID] = true
	}
	return nil
}

// Repositorio e a porta de persistencia.
type Repositorio interface {
	Criar(ctx context.Context, d Dados, autor string) (int64, error)
	// Atualizar regrava cabecalho e itens -- so de pedido Aberto e sem OP.
	Atualizar(ctx context.Context, id int64, d Dados, autor string) error
	BuscarPorID(ctx context.Context, id int64) (*PedidoVenda, error)
	Listar(ctx context.Context, params consulta.Parametros) ([]PedidoVenda, int, error)
	// Cancelar cancela o pedido e as OPs Abertas dele; recusa com
	// ErrPossuiOPEmAndamento se houver OP liberada ou concluida.
	Cancelar(ctx context.Context, id int64, autor string) error
	// RegistrarEntrega baixa o produto acabado do estoque, marca as series
	// como expedidas e o pedido como Entregue.
	RegistrarEntrega(ctx context.Context, id int64, autor string) error
}

// Servico reune os casos de uso do pedido de venda.
type Servico struct {
	repo Repositorio
}

// NovoServico monta o servico.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo}
}

// Criar cadastra um pedido (status Aberto).
func (s *Servico) Criar(ctx context.Context, d Dados, autor string) (*PedidoVenda, error) {
	d.Normalizar()
	if err := d.Validar(); err != nil {
		return nil, err
	}
	id, err := s.repo.Criar(ctx, d, autor)
	if err != nil {
		return nil, err
	}
	return s.repo.BuscarPorID(ctx, id)
}

// Atualizar altera um pedido Aberto que ainda nao gerou OP.
func (s *Servico) Atualizar(ctx context.Context, id int64, d Dados, autor string) (*PedidoVenda, error) {
	d.Normalizar()
	if err := d.Validar(); err != nil {
		return nil, err
	}
	atual, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if atual.Status != StatusAberto {
		return nil, ErrStatusInvalidoParaAcao
	}
	for _, i := range atual.Itens {
		if i.OrdemProducaoID != nil && i.StatusOP != nil && *i.StatusOP != "Cancelada" {
			return nil, ErrStatusInvalidoParaAcao
		}
	}
	if err := s.repo.Atualizar(ctx, id, d, autor); err != nil {
		return nil, err
	}
	return s.repo.BuscarPorID(ctx, id)
}

// BuscarPorID devolve um pedido com os itens.
func (s *Servico) BuscarPorID(ctx context.Context, id int64) (*PedidoVenda, error) {
	return s.repo.BuscarPorID(ctx, id)
}

// Listar devolve uma pagina (sem itens).
func (s *Servico) Listar(ctx context.Context, params consulta.Parametros) ([]PedidoVenda, int, error) {
	return s.repo.Listar(ctx, params)
}

// Cancelar cancela o pedido (nao Entregue nem ja Cancelado).
func (s *Servico) Cancelar(ctx context.Context, id int64, autor string) error {
	atual, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if atual.Status == StatusEntregue || atual.Status == StatusCancelado {
		return ErrStatusInvalidoParaAcao
	}
	return s.repo.Cancelar(ctx, id, autor)
}

// RegistrarEntrega fecha um pedido Pronto para Envio.
func (s *Servico) RegistrarEntrega(ctx context.Context, id int64, autor string) error {
	atual, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if atual.Status != StatusProntoParaEnvio {
		return ErrStatusInvalidoParaAcao
	}
	return s.repo.RegistrarEntrega(ctx, id, autor)
}
