package controle_test

import (
	"strings"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/controle"
	"github.com/stretchr/testify/assert"
)

func TestFlagsValidadeSoComLote(t *testing.T) {
	assert.ErrorIs(t, controle.Flags{ControlaValidade: true}.Validar(), controle.ErrValidadeSemLote)
	assert.NoError(t, controle.Flags{ControlaValidade: true, ControlaLote: true}.Validar())
	assert.NoError(t, controle.Flags{ControlaNumeroSerie: true}.Validar())
}

func TestValidarRecebimento(t *testing.T) {
	assert.NoError(t, controle.ValidarRecebimento(30, `SN-\d{4}`))
	assert.NoError(t, controle.ValidarRecebimento(0, "  "))
	assert.ErrorIs(t, controle.ValidarRecebimento(-1, ""), controle.ErrValidadeMinima)
	assert.ErrorIs(t, controle.ValidarRecebimento(3651, ""), controle.ErrValidadeMinima)
	assert.ErrorIs(t, controle.ValidarRecebimento(0, "SN-[0-9"), controle.ErrMascaraInvalida)
	assert.ErrorIs(t, controle.ValidarRecebimento(0, strings.Repeat("a", 121)), controle.ErrMascaraInvalida)
}

func TestSerieConfereComAMascaraInteira(t *testing.T) {
	assert.True(t, controle.SerieConfere(`SN-\d{4}`, "SN-0042"))
	assert.False(t, controle.SerieConfere(`SN-\d{4}`, "SN-00421"), "a mascara vale para a serie inteira")
	assert.False(t, controle.SerieConfere(`SN-\d{4}`, "XSN-0042"))
	assert.True(t, controle.SerieConfere("", "qualquer coisa"), "sem mascara, serie livre")
	assert.False(t, controle.SerieConfere("SN-[0-9", "SN-1"), "mascara invalida nao aceita nada")
}
