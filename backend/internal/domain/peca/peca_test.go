package peca_test

import (
	"time"

	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func dadosValidos() peca.Dados {
	return peca.Dados{
		Codigo:         "CON-001",
		Descricao:      "Conector RCA macho",
		UnidadeMedida:  "und",
		EstoqueMinimo:  50,
		EstoqueMaximo:  500,
		LeadTimeCompra: 7,
	}
}

func TestDadosValidosPassamNaValidacao(t *testing.T) {
	require.NoError(t, dadosValidos().Validar())
}

func TestCodigoEhNormalizadoParaCaixaAlta(t *testing.T) {
	dados := dadosValidos()
	dados.Codigo = "  con-001 "

	dados.Normalizar()

	assert.Equal(t, "CON-001", dados.Codigo)
}

func TestCodigoVazioEhRejeitado(t *testing.T) {
	dados := dadosValidos()
	dados.Codigo = ""

	require.ErrorIs(t, dados.Validar(), peca.ErrCodigoObrigatorio)
}

func TestDescricaoCurtaEhRejeitada(t *testing.T) {
	dados := dadosValidos()
	dados.Descricao = "RCA"

	require.ErrorIs(t, dados.Validar(), peca.ErrDescricaoCurta)
}

func TestEstoqueMinimoPrecisaSerMenorQueOMaximo(t *testing.T) {
	dados := dadosValidos()
	dados.EstoqueMinimo = 500
	dados.EstoqueMaximo = 500

	require.ErrorIs(t, dados.Validar(), peca.ErrFaixaDeEstoqueInvalida)
}

func TestEstoqueMinimoNegativoEhRejeitado(t *testing.T) {
	dados := dadosValidos()
	dados.EstoqueMinimo = -1

	require.ErrorIs(t, dados.Validar(), peca.ErrEstoqueMinimoNegativo)
}

func TestLeadTimeDeCompraPrecisaSerPositivo(t *testing.T) {
	dados := dadosValidos()
	dados.LeadTimeCompra = 0

	require.ErrorIs(t, dados.Validar(), peca.ErrLeadTimeInvalido)
}

func TestUnidadeDeMedidaEhObrigatoria(t *testing.T) {
	dados := dadosValidos()
	dados.UnidadeMedida = "  "

	require.ErrorIs(t, dados.Validar(), peca.ErrUnidadeObrigatoria)
}

func TestSituacaoDoSaldoEhCriticaAbaixoDoMinimo(t *testing.T) {
	// RN5: critico quando o saldo fica abaixo do estoque minimo.
	p := peca.PartePeca{EstoqueMinimo: 50}

	assert.Equal(t, peca.SaldoCritico, p.SituacaoDoSaldo(49))
}

func TestSituacaoDoSaldoEhCriticaNoLimiteDoMinimo(t *testing.T) {
	// RF2.1: gerar alerta quando saldo <= estoque minimo.
	p := peca.PartePeca{EstoqueMinimo: 50}

	assert.Equal(t, peca.SaldoCritico, p.SituacaoDoSaldo(50))
}

func TestSituacaoDoSaldoEhNormalAcimaDoMinimo(t *testing.T) {
	p := peca.PartePeca{EstoqueMinimo: 50}

	assert.Equal(t, peca.SaldoOK, p.SituacaoDoSaldo(51))
}

func TestPrevisaoDeChegadaUsaOLeadTimeDeCompra(t *testing.T) {
	// RN6: data de entrega do PC = hoje + lead time de compra.
	p := peca.PartePeca{LeadTimeCompra: 7}

	chegada := p.PrevisaoDeChegada(dataFixa())

	assert.Equal(t, "2026-09-01", chegada.Format("2006-01-02"))
}

func dataFixa() time.Time {
	return time.Date(2026, 8, 25, 10, 0, 0, 0, time.UTC)
}
