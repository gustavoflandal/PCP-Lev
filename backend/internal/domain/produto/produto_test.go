package produto_test

import (
	"time"

	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func dadosValidos() produto.Dados {
	return produto.Dados{
		Codigo:           "VMS-01",
		Descricao:        "Painel de Velocidade VMS Serie 01",
		UnidadeMedida:    "und",
		PrecoVenda:       dinheiro.DeCentavos(500000),
		LeadTimeProducao: 10,
	}
}

func TestDadosValidosPassamNaValidacao(t *testing.T) {
	require.NoError(t, dadosValidos().Validar())
}

func TestCodigoEhNormalizadoParaCaixaAlta(t *testing.T) {
	dados := dadosValidos()
	dados.Codigo = "  vms-01  "

	dados.Normalizar()

	assert.Equal(t, "VMS-01", dados.Codigo)
}

func TestCodigoVazioEhRejeitado(t *testing.T) {
	dados := dadosValidos()
	dados.Codigo = "   "

	require.ErrorIs(t, dados.Validar(), produto.ErrCodigoObrigatorio)
}

func TestDescricaoComMenosDeCincoCaracteresEhRejeitada(t *testing.T) {
	dados := dadosValidos()
	dados.Descricao = "VMS"

	require.ErrorIs(t, dados.Validar(), produto.ErrDescricaoCurta)
}

func TestPrecoDeVendaZeradoEhRejeitado(t *testing.T) {
	dados := dadosValidos()
	dados.PrecoVenda = dinheiro.DeCentavos(0)

	require.ErrorIs(t, dados.Validar(), produto.ErrPrecoInvalido)
}

func TestLeadTimeDeProducaoPrecisaSerPositivo(t *testing.T) {
	dados := dadosValidos()
	dados.LeadTimeProducao = 0

	require.ErrorIs(t, dados.Validar(), produto.ErrLeadTimeInvalido)
}

func TestUnidadeDeMedidaEhObrigatoria(t *testing.T) {
	dados := dadosValidos()
	dados.UnidadeMedida = ""

	require.ErrorIs(t, dados.Validar(), produto.ErrUnidadeObrigatoria)
}

func TestDataDeConclusaoUsaOLeadTimeDeProducao(t *testing.T) {
	// RN6: ao criar OP, data conclusao = hoje + lead time de producao.
	pa := produto.ProdutoAcabado{LeadTimeProducao: 10}

	previsao := pa.PrevisaoDeConclusao(dataFixa())

	assert.Equal(t, "2026-09-04", previsao.Format("2006-01-02"))
}

func dataFixa() time.Time {
	return time.Date(2026, 8, 25, 10, 0, 0, 0, time.UTC)
}
