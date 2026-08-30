// Package cotacao contem a gestao de cotacoes de fornecedores (RF3.1).
package cotacao

import (
	"errors"
	"strings"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

// Status possiveis (CHECK constraint da migration 003 — autoritativo).
const (
	StatusRascunho   = "Rascunho"
	StatusEnviada    = "Enviada"
	StatusRespondida = "Respondida"
	StatusCancelada  = "Cancelada"
)

var (
	ErrFornecedorObrigatorio       = errors.New("informe o fornecedor")
	ErrDataValidadeObrigatoria     = errors.New("informe a data de validade")
	ErrDataValidadeInvalida        = errors.New("a data de validade deve ser posterior a data de emissao")
	ErrItensObrigatorios           = errors.New("informe ao menos um item")
	ErrQuantidadeInvalida          = errors.New("a quantidade de cada item deve ser maior que zero")
	ErrPrecoInvalido               = errors.New("o preco unitario de cada item deve ser maior que zero")
	ErrNumeroCotacaoObrigatorio    = errors.New("informe o numero da cotacao")
	ErrNumeroCotacaoDuplicado      = errors.New("ja existe uma cotacao com este numero")
	ErrFornecedorOuPecaInexistente = errors.New("o fornecedor ou uma das pecas informadas nao existe")
	ErrNaoEncontrado               = errors.New("cotacao nao encontrada")
	ErrStatusInvalidoParaAcao      = errors.New("a cotacao nao esta em um status que permite esta acao")
)

// ItemCotacao e um item da cotacao: uma parte/peca, quantidade e preco.
type ItemCotacao struct {
	ID            int64             `json:"id"`
	PartePecaID   int64             `json:"parte_peca_id"`
	Quantidade    int               `json:"quantidade"`
	PrecoUnitario dinheiro.Dinheiro `json:"preco_unitario"`
	Total         dinheiro.Dinheiro `json:"total"`
}

// Cotacao e o pedido de preco enviado a um fornecedor.
type Cotacao struct {
	ID            int64             `json:"id"`
	NumeroCotacao string            `json:"numero_cotacao"`
	FornecedorID  int64             `json:"fornecedor_id"`
	DataEmissao   tempo.Data        `json:"data_emissao"`
	DataValidade  tempo.Data        `json:"data_validade"`
	DataResposta  tempo.Data        `json:"data_resposta,omitzero"`
	ValorTotal    dinheiro.Dinheiro `json:"valor_total"`
	Status        string            `json:"status"`
	Observacoes   string            `json:"observacoes,omitempty"`
	Itens         []ItemCotacao     `json:"itens,omitempty"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
	CreatedBy     *string           `json:"created_by,omitempty"`
	UpdatedBy     *string           `json:"updated_by,omitempty"`
}

// ItemDados sao os dados de um item informados na criacao/edicao.
type ItemDados struct {
	PartePecaID   int64
	Quantidade    int
	PrecoUnitario dinheiro.Dinheiro
}

// Dados sao os campos informados na criacao e na edicao.
type Dados struct {
	NumeroCotacao string
	FornecedorID  int64
	DataEmissao   tempo.Data
	DataValidade  tempo.Data
	Observacoes   string
	Itens         []ItemDados
}

// Normalizar deixa os dados na forma em que sao persistidos.
func (d *Dados) Normalizar() {
	d.NumeroCotacao = strings.ToUpper(strings.TrimSpace(d.NumeroCotacao))
	d.Observacoes = strings.TrimSpace(d.Observacoes)
}

// Validar aplica as regras do RF3.1.
func (d Dados) Validar() error {
	if strings.TrimSpace(d.NumeroCotacao) == "" {
		return ErrNumeroCotacaoObrigatorio
	}
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
		if !item.PrecoUnitario.Positivo() {
			return ErrPrecoInvalido
		}
	}
	return nil
}
