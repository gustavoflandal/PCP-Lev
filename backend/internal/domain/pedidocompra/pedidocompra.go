// Package pedidocompra contem a emissao de pedidos de compra (RF3.3).
package pedidocompra

import (
	"errors"
	"strings"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

// Status possiveis (CHECK constraint da migration 003 — autoritativo, sem
// acento em "Concluido").
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
	ErrFornecedorObrigatorio              = errors.New("informe o fornecedor")
	ErrDataEntregaObrigatoria             = errors.New("informe a data de entrega prevista")
	ErrDataEntregaInvalida                = errors.New("a data de entrega prevista deve ser posterior a data do pedido")
	ErrItensObrigatorios                  = errors.New("informe ao menos um item")
	ErrQuantidadeInvalida                 = errors.New("a quantidade solicitada de cada item deve ser maior que zero")
	ErrPrecoInvalido                      = errors.New("o preco unitario de cada item deve ser maior que zero")
	ErrNumeroPCObrigatorio                = errors.New("informe o numero do pedido de compra")
	ErrNumeroPCDuplicado                  = errors.New("ja existe um pedido de compra com este numero")
	ErrFornecedorOuPecaInexistente        = errors.New("o fornecedor ou uma das pecas informadas nao existe")
	ErrCotacaoInexistente                 = errors.New("a cotacao informada nao existe")
	ErrNaoEncontrado                      = errors.New("pedido de compra nao encontrado")
	ErrStatusInvalidoParaAcao             = errors.New("o pedido de compra nao esta em um status que permite esta acao")
	ErrQuantidadeRecebidaExcedeSolicitada = errors.New("a quantidade recebida nao pode exceder a quantidade solicitada")
)

// ItemPedido e um item do pedido de compra.
type ItemPedido struct {
	ID                   int64             `json:"id"`
	PartePecaID          int64             `json:"parte_peca_id"`
	QuantidadeSolicitada int               `json:"quantidade_solicitada"`
	QuantidadeRecebida   int               `json:"quantidade_recebida"`
	PrecoUnitario        dinheiro.Dinheiro `json:"preco_unitario"`
	Total                dinheiro.Dinheiro `json:"total"`
}

// PedidoCompra e o pedido oficial de compra emitido a um fornecedor.
type PedidoCompra struct {
	ID                  int64             `json:"id"`
	NumeroPC            string            `json:"numero_pc"`
	CotacaoID           *int64            `json:"cotacao_id,omitempty"`
	FornecedorID        int64             `json:"fornecedor_id"`
	DataPedido          tempo.Data        `json:"data_pedido"`
	DataEntregaPrevista tempo.Data        `json:"data_entrega_prevista"`
	DataEntregaReal     tempo.Data        `json:"data_entrega_real,omitzero"`
	ValorTotal          dinheiro.Dinheiro `json:"valor_total"`
	CondicaoPagamento   string            `json:"condicao_pagamento,omitempty"`
	Status              string            `json:"status"`
	Observacoes         string            `json:"observacoes,omitempty"`
	Itens               []ItemPedido      `json:"itens,omitempty"`
	CreatedAt           time.Time         `json:"created_at"`
	UpdatedAt           time.Time         `json:"updated_at"`
	CreatedBy           *string           `json:"created_by,omitempty"`
	UpdatedBy           *string           `json:"updated_by,omitempty"`
}

// ItemDados sao os dados de um item informados na criacao/edicao.
type ItemDados struct {
	PartePecaID          int64
	QuantidadeSolicitada int
	PrecoUnitario        dinheiro.Dinheiro
}

// Dados sao os campos informados na criacao e na edicao.
type Dados struct {
	NumeroPC            string
	CotacaoID           *int64
	FornecedorID        int64
	DataPedido          tempo.Data
	DataEntregaPrevista tempo.Data
	CondicaoPagamento   string
	Observacoes         string
	Itens               []ItemDados
}

// Normalizar deixa os dados na forma em que sao persistidos.
func (d *Dados) Normalizar() {
	d.NumeroPC = strings.ToUpper(strings.TrimSpace(d.NumeroPC))
	d.CondicaoPagamento = strings.TrimSpace(d.CondicaoPagamento)
	d.Observacoes = strings.TrimSpace(d.Observacoes)
}

// Validar aplica as regras do RF3.3.
func (d Dados) Validar() error {
	if strings.TrimSpace(d.NumeroPC) == "" {
		return ErrNumeroPCObrigatorio
	}
	if d.FornecedorID <= 0 {
		return ErrFornecedorObrigatorio
	}
	if d.DataEntregaPrevista.IsZero() {
		return ErrDataEntregaObrigatoria
	}
	if !d.DataEntregaPrevista.After(d.DataPedido) {
		return ErrDataEntregaInvalida
	}
	if len(d.Itens) == 0 {
		return ErrItensObrigatorios
	}
	for _, item := range d.Itens {
		if item.QuantidadeSolicitada <= 0 {
			return ErrQuantidadeInvalida
		}
		if !item.PrecoUnitario.Positivo() {
			return ErrPrecoInvalido
		}
	}
	return nil
}
