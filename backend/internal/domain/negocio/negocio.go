// Package negocio contem os parametros de negocio de Estoque e Compras (doc 0,
// secao 4.7.5). Singleton, mesmo molde de internal/domain/regional: uma linha
// no banco, Buscar/Atualizar. Cada parametro aqui e aplicado por algum fluxo
// do sistema (ver docs/superpowers/specs/2026-10-24-parametros-negocio-design.md)
// -- os metodos de Configuracao concentram essas regras para os servicos que
// as usam nao reimplementarem a conta.
package negocio

import (
	"errors"
	"slices"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
)

// MetodoCusteio e o metodo de valorizacao do estoque.
type MetodoCusteio string

const (
	CustoMedioPonderado MetodoCusteio = "CMP"
	PrimeiroQueEntra    MetodoCusteio = "PEPS"
	UltimoPrecoDeCompra MetodoCusteio = "UPC"
)

var metodosValidos = []MetodoCusteio{CustoMedioPonderado, PrimeiroQueEntra, UltimoPrecoDeCompra}

// Percentual e um valor com duas casas decimais guardado em centesimos -- o
// mesmo ponto fixo de dinheiro.Dinheiro (numero no JSON, NUMERIC no banco),
// reaproveitado para a conta da tolerancia nao passar por float (1.15 * 100
// em float da 114.999..., e o arredondamento para baixo erraria por um).
type Percentual = dinheiro.Dinheiro

// Limites de cada campo -- os mesmos CHECKs da migration 012.
const (
	toleranciaMaxima    = Percentual(100_00)
	leadTimeMinimo      = 1
	leadTimeMaximo      = 365
	cotacoesMinimasTeto = 10
	// valorMaximo e o maior NUMERIC(12,2) -- acima disso o banco recusaria
	// com um 500 generico.
	valorMaximo = dinheiro.Dinheiro(9_999_999_999_99)
)

var (
	ErrMetodoCusteioInvalido   = errors.New("metodo de custeio invalido")
	ErrToleranciaInvalida      = errors.New("a tolerancia de recebimento deve ficar entre 0% e 100%")
	ErrLeadTimeInvalido        = errors.New("o lead time padrao deve ficar entre 1 e 365 dias")
	ErrLimiteGestorInvalido    = errors.New("o limite de emissao do Gestor deve ficar entre 0 e 9.999.999.999,99")
	ErrCotacoesInvalidas       = errors.New("o minimo de cotacoes deve ficar entre 0 e 10")
	ErrValorCotacoesInvalido   = errors.New("o valor que exige cotacoes deve ficar entre 0 e 9.999.999.999,99")
	ErrToleranciaPrecoInvalida = errors.New("a tolerancia de divergencia de preco deve ficar entre 0% e 100%")
	ErrAcaoDivergenciaInvalida = errors.New("a acao para divergencia de preco deve ser BLOQUEAR ou APROVAR")
)

// Dados sao os campos informados no PUT -- sempre a configuracao inteira.
type Dados struct {
	MetodoCusteio                   MetodoCusteio      `json:"metodo_custeio"`
	ToleranciaExcessoRecebimentoPct Percentual         `json:"tolerancia_excesso_recebimento_pct"`
	LeadTimePadraoDias              int                `json:"lead_time_padrao_dias"`
	LimiteEmissaoGestor             *dinheiro.Dinheiro `json:"limite_emissao_gestor"`
	CotacoesMinimas                 int                `json:"cotacoes_minimas"`
	ValorExigeCotacoes              dinheiro.Dinheiro  `json:"valor_exige_cotacoes"`
	// Divergencia de preco NF x PC (v1.2, 4.3.4): tolerancia e o que fazer
	// acima dela -- BLOQUEAR a efetivacao ou exigir APROVAR (permissao propria).
	ToleranciaPrecoPct   Percentual `json:"tolerancia_preco_pct"`
	DivergenciaPrecoAcao string     `json:"divergencia_preco_acao"`
}

// Configuracao e o singleton lido por GET /configuracoes/negocio.
type Configuracao struct {
	Dados
	UpdatedAt time.Time `json:"updated_at"`
	UpdatedBy *string   `json:"updated_by,omitempty"`
}

// Validar confere cada campo contra o seu intervalo -- um valor fora quebraria
// o CHECK da migration 012 com um 500 generico em vez de um 400 explicado.
func (d Dados) Validar() error {
	if !slices.Contains(metodosValidos, d.MetodoCusteio) {
		return ErrMetodoCusteioInvalido
	}
	if d.ToleranciaExcessoRecebimentoPct < 0 || d.ToleranciaExcessoRecebimentoPct > toleranciaMaxima {
		return ErrToleranciaInvalida
	}
	if d.LeadTimePadraoDias < leadTimeMinimo || d.LeadTimePadraoDias > leadTimeMaximo {
		return ErrLeadTimeInvalido
	}
	if d.LimiteEmissaoGestor != nil && (*d.LimiteEmissaoGestor < 0 || *d.LimiteEmissaoGestor > valorMaximo) {
		return ErrLimiteGestorInvalido
	}
	if d.CotacoesMinimas < 0 || d.CotacoesMinimas > cotacoesMinimasTeto {
		return ErrCotacoesInvalidas
	}
	if d.ValorExigeCotacoes < 0 || d.ValorExigeCotacoes > valorMaximo {
		return ErrValorCotacoesInvalido
	}
	if d.ToleranciaPrecoPct < 0 || d.ToleranciaPrecoPct > toleranciaMaxima {
		return ErrToleranciaPrecoInvalida
	}
	// Vazio = padrao BLOQUEAR (cliente anterior a v1.2).
	if d.DivergenciaPrecoAcao != "" && d.DivergenciaPrecoAcao != "BLOQUEAR" && d.DivergenciaPrecoAcao != "APROVAR" {
		return ErrAcaoDivergenciaInvalida
	}
	return nil
}

// LimiteDeRecebimento e o maximo que pode ser recebido, no acumulado, de um
// item com a quantidade solicitada informada: o solicitado mais a
// tolerancia, arredondado para baixo (nunca libera uma unidade a mais do que
// a porcentagem permite).
func (d Dados) LimiteDeRecebimento(solicitada int) int {
	return solicitada + int(int64(solicitada)*d.ToleranciaExcessoRecebimentoPct.Centavos()/100_00)
}

// GestorPodeEmitir diz se o valor total cabe na alcada do Gestor.
func (d Dados) GestorPodeEmitir(valorTotal dinheiro.Dinheiro) bool {
	return d.LimiteEmissaoGestor == nil || valorTotal <= *d.LimiteEmissaoGestor
}

// ExigeCotacoes diz se um pedido com esse valor total precisa cumprir o
// minimo de cotacoes.
func (d Dados) ExigeCotacoes(valorTotal dinheiro.Dinheiro) bool {
	return d.CotacoesMinimas > 0 && valorTotal >= d.ValorExigeCotacoes
}
