package regional_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/stretchr/testify/assert"
)

func TestValidarAceitaACombinacaoPadrao(t *testing.T) {
	d := regional.Dados{FormatoData: regional.FormatoDataBR, FormatoHora: regional.FormatoHora24}
	assert.NoError(t, d.Validar())
}

func TestValidarAceitaTodasAsCombinacoes(t *testing.T) {
	formatosData := []regional.FormatoData{regional.FormatoDataBR, regional.FormatoDataTraco, regional.FormatoDataISO}
	formatosHora := []regional.FormatoHora{regional.FormatoHora24, regional.FormatoHora12}
	for _, fd := range formatosData {
		for _, fh := range formatosHora {
			d := regional.Dados{FormatoData: fd, FormatoHora: fh}
			assert.NoError(t, d.Validar(), "formato_data=%s formato_hora=%s", fd, fh)
		}
	}
}

func TestValidarRejeitaFormatoDataForaDoConjunto(t *testing.T) {
	d := regional.Dados{FormatoData: "MM/DD/AAAA", FormatoHora: regional.FormatoHora24}
	assert.ErrorIs(t, d.Validar(), regional.ErrFormatoDataInvalido)
}

func TestValidarRejeitaFormatoHoraForaDoConjunto(t *testing.T) {
	d := regional.Dados{FormatoData: regional.FormatoDataBR, FormatoHora: "36H"}
	assert.ErrorIs(t, d.Validar(), regional.ErrFormatoHoraInvalido)
}
