package pedidocompra

import (
	"context"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

// ColunasOrdenaveis restringe o `ordenar_por` da listagem.
var ColunasOrdenaveis = []string{
	"numero_pc", "data_pedido", "data_entrega_prevista", "valor_total", "status", "created_at",
}

// StatusPermitidos restringe o `status` da listagem (consulta.AnalisarComStatus).
var StatusPermitidos = []string{
	StatusRascunho, StatusEmitido, StatusAceito, StatusAguardandoEntrega,
	StatusRecebidoParcial, StatusConcluido, StatusCancelado,
}

// statusTerminais nao aparecem em "em atraso": um pedido concluido ou
// cancelado nao gera mais cobranca de prazo.
var statusTerminais = []string{StatusConcluido, StatusCancelado}

// Repositorio e a porta de persistencia dos pedidos de compra.
type Repositorio interface {
	Criar(ctx context.Context, p *PedidoCompra, autor string) error
	Atualizar(ctx context.Context, p *PedidoCompra, autor string) error
	BuscarPorID(ctx context.Context, id int64) (*PedidoCompra, error)
	Listar(ctx context.Context, params consulta.Parametros) ([]PedidoCompra, int, error)
	AtualizarStatus(ctx context.Context, id int64, status string, autor string) error
	EmAtraso(ctx context.Context, statusTerminais []string) ([]PedidoCompra, error)
}

// Servico reune os casos de uso de pedidos de compra.
type Servico struct {
	repo Repositorio
}

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo}
}

func calcularItens(itens []ItemDados) ([]ItemPedido, dinheiro.Dinheiro) {
	calculados := make([]ItemPedido, len(itens))
	var total dinheiro.Dinheiro
	for i, item := range itens {
		subtotal := item.PrecoUnitario.Vezes(item.QuantidadeSolicitada)
		calculados[i] = ItemPedido{
			PartePecaID: item.PartePecaID, QuantidadeSolicitada: item.QuantidadeSolicitada,
			PrecoUnitario: item.PrecoUnitario, Total: subtotal,
		}
		total = total.Mais(subtotal)
	}
	return calculados, total
}

// Criar cadastra um novo pedido de compra em Rascunho.
func (s *Servico) Criar(ctx context.Context, dados Dados, autor string) (*PedidoCompra, error) {
	dados.Normalizar()
	if dados.DataPedido.IsZero() {
		dados.DataPedido = tempo.Hoje()
	}
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	itens, total := calcularItens(dados.Itens)
	p := &PedidoCompra{
		NumeroPC:            dados.NumeroPC,
		CotacaoID:           dados.CotacaoID,
		FornecedorID:        dados.FornecedorID,
		DataPedido:          dados.DataPedido,
		DataEntregaPrevista: dados.DataEntregaPrevista,
		CondicaoPagamento:   dados.CondicaoPagamento,
		Observacoes:         dados.Observacoes,
		Status:              StatusRascunho,
		ValorTotal:          total,
		Itens:               itens,
	}

	if err := s.repo.Criar(ctx, p, autor); err != nil {
		return nil, err
	}
	return p, nil
}

// Atualizar altera um pedido de compra existente — so permitido em Rascunho.
func (s *Servico) Atualizar(ctx context.Context, id int64, dados Dados, autor string) (*PedidoCompra, error) {
	dados.Normalizar()
	if dados.DataPedido.IsZero() {
		dados.DataPedido = tempo.Hoje()
	}
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	atual, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if atual.Status != StatusRascunho {
		return nil, ErrStatusInvalidoParaAcao
	}

	itens, total := calcularItens(dados.Itens)
	atual.NumeroPC = dados.NumeroPC
	atual.FornecedorID = dados.FornecedorID
	atual.DataPedido = dados.DataPedido
	atual.DataEntregaPrevista = dados.DataEntregaPrevista
	atual.CondicaoPagamento = dados.CondicaoPagamento
	atual.Observacoes = dados.Observacoes
	atual.ValorTotal = total
	atual.Itens = itens

	if err := s.repo.Atualizar(ctx, atual, autor); err != nil {
		return nil, err
	}
	return atual, nil
}

// BuscarPorID devolve um pedido de compra especifico, com os itens.
func (s *Servico) BuscarPorID(ctx context.Context, id int64) (*PedidoCompra, error) {
	return s.repo.BuscarPorID(ctx, id)
}

// Listar devolve a pagina de pedidos de compra e o total filtrado.
func (s *Servico) Listar(ctx context.Context, params consulta.Parametros) ([]PedidoCompra, int, error) {
	return s.repo.Listar(ctx, params)
}

// Emitir marca o pedido de compra como emitido ao fornecedor.
func (s *Servico) Emitir(ctx context.Context, id int64, autor string) (*PedidoCompra, error) {
	p, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.Status != StatusRascunho {
		return nil, ErrStatusInvalidoParaAcao
	}
	if err := s.repo.AtualizarStatus(ctx, id, StatusEmitido, autor); err != nil {
		return nil, err
	}
	p.Status = StatusEmitido
	return p, nil
}

// Cancelar marca o pedido de compra como cancelado. Um pedido ja concluido
// ou ja cancelado nao pode ser cancelado de novo — RF3.3 nao preve reabrir
// um ciclo de compra encerrado.
func (s *Servico) Cancelar(ctx context.Context, id int64, autor string) error {
	p, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if p.Status == StatusCancelado || p.Status == StatusConcluido {
		return ErrStatusInvalidoParaAcao
	}
	return s.repo.AtualizarStatus(ctx, id, StatusCancelado, autor)
}

// EmAtraso devolve os pedidos com entrega vencida e ainda nao encerrados.
func (s *Servico) EmAtraso(ctx context.Context) ([]PedidoCompra, error) {
	return s.repo.EmAtraso(ctx, statusTerminais)
}
