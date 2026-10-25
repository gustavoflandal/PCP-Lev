package estoque_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidarExigePartePeca(t *testing.T) {
	d := estoque.AjusteDados{Quantidade: 10, Motivo: "Inventario"}
	require.ErrorIs(t, d.Validar(), estoque.ErrPartePecaObrigatoria)
}

func TestValidarExigeQuantidadeDiferenteDeZero(t *testing.T) {
	d := estoque.AjusteDados{PartePecaID: 1, Quantidade: 0, Motivo: "Inventario"}
	require.ErrorIs(t, d.Validar(), estoque.ErrQuantidadeAjusteObrigatoria)
}

func TestValidarAceitaQuantidadeNegativa(t *testing.T) {
	d := estoque.AjusteDados{PartePecaID: 1, Quantidade: -5, Motivo: "Perda"}
	require.NoError(t, d.Validar())
}

func TestValidarExigeMotivo(t *testing.T) {
	d := estoque.AjusteDados{PartePecaID: 1, Quantidade: 10}
	require.ErrorIs(t, d.Validar(), estoque.ErrMotivoAjusteObrigatorio)
}

func TestNormalizarLimpaEspacos(t *testing.T) {
	d := estoque.AjusteDados{PartePecaID: 1, Quantidade: 10, Motivo: "  Inventario  ", Observacoes: "  ok  "}
	d.Normalizar()
	assert.Equal(t, "Inventario", d.Motivo)
	assert.Equal(t, "ok", d.Observacoes)
}

func TestSituacaoDoSaldoCriticoNaFronteira(t *testing.T) {
	assert.Equal(t, estoque.StatusCritico, estoque.SituacaoDoSaldo(5, 5))
}

func TestSituacaoDoSaldoOKAcimaDoMinimo(t *testing.T) {
	assert.Equal(t, estoque.StatusOK, estoque.SituacaoDoSaldo(6, 5))
}

func TestSituacaoDoSaldoCriticoAbaixoDoMinimo(t *testing.T) {
	assert.Equal(t, estoque.StatusCritico, estoque.SituacaoDoSaldo(0, 5))
}
