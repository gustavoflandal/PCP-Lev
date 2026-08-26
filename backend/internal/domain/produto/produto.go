// Package produto contem o cadastro de Produtos Acabados (RF1.1).
package produto

import (
	"errors"
	"strings"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
)

const tamanhoMinimoDescricao = 5

var (
	ErrCodigoObrigatorio  = errors.New("o codigo do produto e obrigatorio")
	ErrDescricaoCurta     = errors.New("a descricao deve ter no minimo 5 caracteres")
	ErrUnidadeObrigatoria = errors.New("a unidade de medida e obrigatoria")
	ErrPrecoInvalido      = errors.New("o preco de venda deve ser maior que zero")
	ErrLeadTimeInvalido   = errors.New("o lead time de producao deve ser maior que zero")

	// ErrCodigoDuplicado indica outro produto ja cadastrado com o mesmo codigo.
	ErrCodigoDuplicado = errors.New("ja existe um produto acabado com este codigo")
	// ErrNaoEncontrado indica produto inexistente.
	ErrNaoEncontrado = errors.New("produto acabado nao encontrado")
	// ErrPossuiVendas bloqueia a exclusao de PA com historico de vendas (RF1.1).
	ErrPossuiVendas = errors.New("o produto possui pedidos de venda e nao pode ser excluido")
)

// ProdutoAcabado e o produto final vendido ao cliente.
type ProdutoAcabado struct {
	ID               int64             `json:"id"`
	Codigo           string            `json:"codigo"`
	Descricao        string            `json:"descricao"`
	UnidadeMedida    string            `json:"unidade_medida"`
	PrecoVenda       dinheiro.Dinheiro `json:"preco_venda"`
	LeadTimeProducao int               `json:"lead_time_producao"`
	Ativo            bool              `json:"ativo"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
	CreatedBy        *string           `json:"created_by,omitempty"`
	UpdatedBy        *string           `json:"updated_by,omitempty"`
}

// PrevisaoDeConclusao aplica o lead time de producao a partir de uma data
// (RN6: data de conclusao da OP = hoje + lead time).
func (p ProdutoAcabado) PrevisaoDeConclusao(inicio time.Time) time.Time {
	return inicio.AddDate(0, 0, p.LeadTimeProducao)
}

// Dados sao os campos informados na criacao e na edicao.
type Dados struct {
	Codigo           string
	Descricao        string
	UnidadeMedida    string
	PrecoVenda       dinheiro.Dinheiro
	LeadTimeProducao int
	// Ativo nil significa "nao informado": na criacao o produto nasce ativo,
	// na edicao a situacao atual e preservada.
	Ativo *bool
}

// Normalizar limpa espacos e padroniza o codigo em caixa alta, para que
// "vms-01" e "VMS-01" nao virem dois cadastros distintos.
func (d *Dados) Normalizar() {
	d.Codigo = strings.ToUpper(strings.TrimSpace(d.Codigo))
	d.Descricao = strings.TrimSpace(d.Descricao)
	d.UnidadeMedida = strings.TrimSpace(d.UnidadeMedida)
}

// Validar aplica as regras do RF1.1.
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
	if !d.PrecoVenda.Positivo() {
		return ErrPrecoInvalido
	}
	if d.LeadTimeProducao <= 0 {
		return ErrLeadTimeInvalido
	}
	return nil
}
