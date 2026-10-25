package notaentrada_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/notaentrada"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/stretchr/testify/assert"
)

func TestChaveAcessoValidaConfereODigitoVerificador(t *testing.T) {
	// Chave publica de exemplo do manual da NF-e (DV 4).
	valida := "35080599999090910270550010000000015180051273"
	assert.True(t, notaentrada.ChaveAcessoValida(valida))
	assert.False(t, notaentrada.ChaveAcessoValida(valida[:43]+"5"), "DV errado")
	assert.False(t, notaentrada.ChaveAcessoValida(valida[:40]), "curta")
	assert.False(t, notaentrada.ChaveAcessoValida("3508059999909091027055001000000001518005127X"))
}

func TestCFOPDeEntrada(t *testing.T) {
	for _, cfop := range []string{"1102", "2102", "3102", "1556", "2949"} {
		assert.True(t, notaentrada.CFOPAceito(cfop), cfop)
	}
	for _, cfop := range []string{"5102", "6102", "1999", "102", ""} {
		assert.False(t, notaentrada.CFOPAceito(cfop), cfop)
	}
}

func TestRatearCustosPorValorComFreteEDesconto(t *testing.T) {
	n := notaentrada.Nota{
		ValorFrete: dinheiro.DeCentavos(10_000), ValorDesconto: dinheiro.DeCentavos(2_000),
		Itens: []notaentrada.Item{
			{Ordem: 1, ValorTotal: dinheiro.DeCentavos(30_000), QuantidadeRecebida: 10},
			{Ordem: 2, ValorTotal: dinheiro.DeCentavos(10_000), QuantidadeRecebida: 100},
			{Ordem: 3, Bonificacao: true, QuantidadeRecebida: 5},
		},
	}
	custos := notaentrada.RatearCustos(n)
	// Extras 100 - 20 = 80, rateados 75% / 25%.
	assert.InDelta(t, (300+60)/10.0, custos[1], 0.0001)
	assert.InDelta(t, (100+20)/100.0, custos[2], 0.0001)
	assert.Zero(t, custos[3], "bonificacao entra a custo zero")
}
