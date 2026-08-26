// Package peca contem o cadastro de Partes/Pecas — os componentes comprados
// e consumidos na producao (RF1.2).
package peca

import (
	"errors"
	"strings"
	"time"
)

const tamanhoMinimoDescricao = 5

var (
	ErrCodigoObrigatorio      = errors.New("o codigo da parte/peca e obrigatorio")
	ErrDescricaoCurta         = errors.New("a descricao deve ter no minimo 5 caracteres")
	ErrUnidadeObrigatoria     = errors.New("a unidade de medida e obrigatoria")
	ErrEstoqueMinimoNegativo  = errors.New("o estoque minimo nao pode ser negativo")
	ErrFaixaDeEstoqueInvalida = errors.New("o estoque minimo deve ser menor que o estoque maximo")
	ErrLeadTimeInvalido       = errors.New("o lead time de compra deve ser maior que zero")

	// ErrCodigoDuplicado indica outra peca ja cadastrada com o mesmo codigo.
	ErrCodigoDuplicado = errors.New("ja existe uma parte/peca com este codigo")
	// ErrNaoEncontrado indica peca inexistente.
	ErrNaoEncontrado = errors.New("parte/peca nao encontrada")
	// ErrFornecedorInexistente indica fornecedor padrao inexistente.
	ErrFornecedorInexistente = errors.New("o fornecedor padrao informado nao existe")
	// ErrPossuiMovimentacao bloqueia a exclusao de peca ja movimentada (RF1.2).
	ErrPossuiMovimentacao = errors.New("a parte/peca possui movimentacao de estoque e nao pode ser excluida")
)

// SituacaoSaldo classifica o saldo de estoque da peca (RN5).
type SituacaoSaldo string

const (
	SaldoOK        SituacaoSaldo = "OK"
	SaldoCritico   SituacaoSaldo = "CRITICO"
	SaldoBloqueado SituacaoSaldo = "BLOQUEADO"
)

// PartePeca e um componente usado na montagem dos produtos acabados.
type PartePeca struct {
	ID                 int64     `json:"id"`
	Codigo             string    `json:"codigo"`
	Descricao          string    `json:"descricao"`
	UnidadeMedida      string    `json:"unidade_medida"`
	EstoqueMinimo      int       `json:"estoque_minimo"`
	EstoqueMaximo      int       `json:"estoque_maximo"`
	FornecedorPadraoID *int64    `json:"fornecedor_padrao_id,omitempty"`
	LeadTimeCompra     int       `json:"lead_time_compra"`
	Ativo              bool      `json:"ativo"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
	CreatedBy          *string   `json:"created_by,omitempty"`
	UpdatedBy          *string   `json:"updated_by,omitempty"`
}

// SituacaoDoSaldo classifica o saldo informado.
//
// RF2.1 pede alerta quando o saldo atinge o minimo, entao a fronteira e
// inclusiva: saldo igual ao minimo ja e critico.
func (p PartePeca) SituacaoDoSaldo(saldo int) SituacaoSaldo {
	if saldo <= p.EstoqueMinimo {
		return SaldoCritico
	}
	return SaldoOK
}

// PrevisaoDeChegada aplica o lead time de compra (RN6).
func (p PartePeca) PrevisaoDeChegada(inicio time.Time) time.Time {
	return inicio.AddDate(0, 0, p.LeadTimeCompra)
}

// Dados sao os campos informados na criacao e na edicao.
type Dados struct {
	Codigo             string
	Descricao          string
	UnidadeMedida      string
	EstoqueMinimo      int
	EstoqueMaximo      int
	FornecedorPadraoID *int64
	LeadTimeCompra     int
	// Ativo nil significa "nao informado".
	Ativo *bool
}

// Normalizar limpa espacos e padroniza o codigo em caixa alta.
func (d *Dados) Normalizar() {
	d.Codigo = strings.ToUpper(strings.TrimSpace(d.Codigo))
	d.Descricao = strings.TrimSpace(d.Descricao)
	d.UnidadeMedida = strings.TrimSpace(d.UnidadeMedida)
}

// Validar aplica as regras do RF1.2.
func (d Dados) Validar() error {
	if strings.TrimSpace(d.Codigo) == "" {
		return ErrCodigoObrigatorio
	}
	if len([]rune(strings.TrimSpace(d.Descricao))) < tamanhoMinimoDescricao {
		return ErrDescricaoCurta
	}
	if strings.TrimSpace(d.UnidadeMedida) == "" {
		return ErrUnidadeObrigatoria
	}
	if d.EstoqueMinimo < 0 {
		return ErrEstoqueMinimoNegativo
	}
	if d.EstoqueMinimo >= d.EstoqueMaximo {
		return ErrFaixaDeEstoqueInvalida
	}
	if d.LeadTimeCompra <= 0 {
		return ErrLeadTimeInvalido
	}
	return nil
}
