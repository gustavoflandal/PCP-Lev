package negocio_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/negocio"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/stretchr/testify/assert"
)

func padrao() negocio.Dados {
	return negocio.Dados{MetodoCusteio: negocio.CustoMedioPonderado, LeadTimePadraoDias: 7}
}

func valor(texto string) dinheiro.Dinheiro {
	v, err := dinheiro.DeString(texto)
	if err != nil {
		panic(err)
	}
	return v
}

func TestValidarAceitaOsDefaults(t *testing.T) {
	assert.NoError(t, padrao().Validar())
}

func TestValidarRejeitaCadaCampoForaDoIntervalo(t *testing.T) {
	negativo := valor("-1")
	casos := map[string]struct {
		mudar func(*negocio.Dados)
		erro  error
	}{
		"metodo":                          {func(d *negocio.Dados) { d.MetodoCusteio = "FIFO" }, negocio.ErrMetodoCusteioInvalido},
		"tolerancia >":                    {func(d *negocio.Dados) { d.ToleranciaExcessoRecebimentoPct = valor("100.01") }, negocio.ErrToleranciaInvalida},
		"tolerancia <":                    {func(d *negocio.Dados) { d.ToleranciaExcessoRecebimentoPct = valor("-0.01") }, negocio.ErrToleranciaInvalida},
		"lead time 0":                     {func(d *negocio.Dados) { d.LeadTimePadraoDias = 0 }, negocio.ErrLeadTimeInvalido},
		"lead time 366":                   {func(d *negocio.Dados) { d.LeadTimePadraoDias = 366 }, negocio.ErrLeadTimeInvalido},
		"limite gestor":                   {func(d *negocio.Dados) { d.LimiteEmissaoGestor = &negativo }, negocio.ErrLimiteGestorInvalido},
		"cotacoes 11":                     {func(d *negocio.Dados) { d.CotacoesMinimas = 11 }, negocio.ErrCotacoesInvalidas},
		"valor cotacoes":                  {func(d *negocio.Dados) { d.ValorExigeCotacoes = negativo }, negocio.ErrValorCotacoesInvalido},
		"valor cotacoes acima do NUMERIC": {func(d *negocio.Dados) { d.ValorExigeCotacoes = valor("10000000000") }, negocio.ErrValorCotacoesInvalido},
		"limite acima do NUMERIC":         {func(d *negocio.Dados) { v := valor("10000000000"); d.LimiteEmissaoGestor = &v }, negocio.ErrLimiteGestorInvalido},
	}
	for nome, caso := range casos {
		t.Run(nome, func(t *testing.T) {
			d := padrao()
			caso.mudar(&d)
			assert.ErrorIs(t, d.Validar(), caso.erro)
		})
	}
}

func TestLimiteDeRecebimentoArredondaParaBaixoSemErroDeFloat(t *testing.T) {
	d := padrao()
	assert.Equal(t, 100, d.LimiteDeRecebimento(100), "tolerancia 0 = so o solicitado")

	d.ToleranciaExcessoRecebimentoPct = valor("15")
	assert.Equal(t, 115, d.LimiteDeRecebimento(100), "1.15*100 em float daria 114")

	d.ToleranciaExcessoRecebimentoPct = valor("5")
	assert.Equal(t, 10, d.LimiteDeRecebimento(10), "10 * 5% = 0,5 unidade -> nao libera nenhuma")

	d.ToleranciaExcessoRecebimentoPct = valor("100")
	assert.Equal(t, 14, d.LimiteDeRecebimento(7))
}

func TestGestorPodeEmitir(t *testing.T) {
	d := padrao()
	assert.True(t, d.GestorPodeEmitir(valor("1000000")), "sem limite configurado")

	limite := valor("10000")
	d.LimiteEmissaoGestor = &limite
	assert.True(t, d.GestorPodeEmitir(valor("10000")), "o limite e inclusivo")
	assert.False(t, d.GestorPodeEmitir(valor("10000.01")))
}

func TestExigeCotacoes(t *testing.T) {
	d := padrao()
	d.ValorExigeCotacoes = valor("5000")
	assert.False(t, d.ExigeCotacoes(valor("9000")), "minimo 0 desliga a regra")

	d.CotacoesMinimas = 3
	assert.False(t, d.ExigeCotacoes(valor("4999.99")))
	assert.True(t, d.ExigeCotacoes(valor("5000")))
}
