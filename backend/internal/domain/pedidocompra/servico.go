package pedidocompra

import (
	"context"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
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
	RegistrarRecebimento(ctx context.Context, id int64, itens []ItemRecebimentoDados, autor string) (*PedidoCompra, error)
}

// Servico reune os casos de uso de pedidos de compra. A dependencia direta
// de *estoque.Servico (tipo concreto, nao uma interface nova) e o mesmo
// padrao de acoplamento que CotacaoHandler ja usa sobre *pedidocompra.Servico
// -- o recebimento precisa dar entrada em estoque.
type Servico struct {
	repo    Repositorio
	estoque *estoque.Servico
}

// NovoServico monta o servico sobre o repositorio e o servico de estoque
// informados -- recebimento precisa dar entrada em estoque.
func NovoServico(repo Repositorio, estoqueServico *estoque.Servico) *Servico {
	return &Servico{repo: repo, estoque: estoqueServico}
}

// ItemRecebimentoDados e um item recebido nesta chamada -- a quantidade e a
// desta chamada, nao o acumulado (o acumulado vive em
// ItemPedido.QuantidadeRecebida e e somado pelo repositorio).
type ItemRecebimentoDados struct {
	PartePecaID        int64
	QuantidadeRecebida int
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

// Emitir marca o pedido de compra como emitido e ja aguardando a entrega --
// nao existe, em nenhum requisito, um passo separado de "o fornecedor
// confirmou o aceite" (Emitido/Aceito ficam no enum por fidelidade ao CHECK
// do banco, mas inalcancaveis).
func (s *Servico) Emitir(ctx context.Context, id int64, autor string) (*PedidoCompra, error) {
	p, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.Status != StatusRascunho {
		return nil, ErrStatusInvalidoParaAcao
	}
	if err := s.repo.AtualizarStatus(ctx, id, StatusAguardandoEntrega, autor); err != nil {
		return nil, err
	}
	p.Status = StatusAguardandoEntrega
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

// RegistrarRecebimento soma quantidade_recebida por item (cumulativo -- uma
// segunda chamada parcial soma sobre a primeira), da entrada no estoque para
// cada item recebido nesta chamada, e recalcula o status do pedido: todos os
// itens completos -> Concluido (grava data_entrega_real); ao menos um item
// com recebimento parcial -> Recebido Parcial.
//
// Ordem deliberada: o repositorio grava a atualizacao do PC (itens + status)
// primeiro, numa unica transacao; so depois, ja fora dela, a entrada em
// estoque e aplicada item a item. Se a etapa de estoque falhar no meio, o PC
// ja registrou o recebimento (nao gera dupla contagem numa nova tentativa) e
// a discrepancia de saldo fica visivel e corrigivel por um ajuste manual --
// o inverso (estoque primeiro) arriscaria aplicar a entrada duas vezes se o
// passo do PC falhasse depois e o operador tentasse de novo.
func (s *Servico) RegistrarRecebimento(ctx context.Context, id int64, itens []ItemRecebimentoDados, autor string) (*PedidoCompra, error) {
	p, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.Status != StatusAguardandoEntrega && p.Status != StatusRecebidoParcial {
		return nil, ErrStatusInvalidoParaAcao
	}

	atualizado, err := s.repo.RegistrarRecebimento(ctx, id, itens, autor)
	if err != nil {
		return nil, err
	}

	for _, item := range itens {
		if item.QuantidadeRecebida <= 0 {
			continue
		}
		if _, err := s.estoque.AplicarMovimento(
			ctx, item.PartePecaID, item.QuantidadeRecebida, estoque.TipoEntrada, estoque.MotivoCompra,
			&atualizado.NumeroPC, "", autor,
		); err != nil {
			return nil, fmt.Errorf("dar entrada em estoque apos recebimento: %w", err)
		}
	}

	return atualizado, nil
}
