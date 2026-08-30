package tempo_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDeStringLeDataValida(t *testing.T) {
	d, err := tempo.DeString("2026-09-25")

	require.NoError(t, err)
	assert.Equal(t, 2026, d.Time.Year())
	assert.Equal(t, time.September, d.Time.Month())
	assert.Equal(t, 25, d.Time.Day())
}

func TestDeStringRejeitaFormatoInvalido(t *testing.T) {
	_, err := tempo.DeString("25/09/2026")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "AAAA-MM-DD")
}

func TestJSONSerializaComoDataPura(t *testing.T) {
	d, err := tempo.DeString("2026-09-25")
	require.NoError(t, err)

	bruto, err := json.Marshal(map[string]tempo.Data{"data_validade": d})

	require.NoError(t, err)
	assert.JSONEq(t, `{"data_validade":"2026-09-25"}`, string(bruto))
}

func TestJSONSerializaZeroValueComoNulo(t *testing.T) {
	var d tempo.Data

	bruto, err := json.Marshal(map[string]tempo.Data{"data_resposta": d})

	require.NoError(t, err)
	assert.JSONEq(t, `{"data_resposta":null}`, string(bruto))
}

func TestJSONLeDataPura(t *testing.T) {
	var corpo struct {
		DataValidade tempo.Data `json:"data_validade"`
	}

	require.NoError(t, json.Unmarshal([]byte(`{"data_validade":"2026-09-25"}`), &corpo))

	assert.Equal(t, 2026, corpo.DataValidade.Time.Year())
}

func TestJSONLeNuloComoZeroValue(t *testing.T) {
	var corpo struct {
		DataResposta tempo.Data `json:"data_resposta"`
	}

	require.NoError(t, json.Unmarshal([]byte(`{"data_resposta":null}`), &corpo))

	assert.True(t, corpo.DataResposta.IsZero())
}

func TestAfterComparaDatas(t *testing.T) {
	antes, _ := tempo.DeString("2026-09-01")
	depois, _ := tempo.DeString("2026-09-25")

	assert.True(t, depois.After(antes))
	assert.False(t, antes.After(depois))
}

func TestIsZeroDistingueDataInformada(t *testing.T) {
	var vazia tempo.Data
	informada, _ := tempo.DeString("2026-09-25")

	assert.True(t, vazia.IsZero())
	assert.False(t, informada.IsZero())
}

func TestScanLeTimeTimeDoPgx(t *testing.T) {
	var d tempo.Data

	require.NoError(t, d.Scan(time.Date(2026, time.September, 25, 0, 0, 0, 0, time.UTC)))

	assert.Equal(t, 2026, d.Time.Year())
	assert.Equal(t, 25, d.Time.Day())
}

func TestScanDeNuloDeixaZeroValue(t *testing.T) {
	var d tempo.Data

	require.NoError(t, d.Scan(nil))

	assert.True(t, d.IsZero())
}

func TestScanRejeitaTipoDesconhecido(t *testing.T) {
	var d tempo.Data

	err := d.Scan("2026-09-25")

	require.Error(t, err)
}

func TestValueEnviaTimeTimeParaOPgx(t *testing.T) {
	d, err := tempo.DeString("2026-09-25")
	require.NoError(t, err)

	bruto, err := d.Value()

	require.NoError(t, err)
	assert.IsType(t, time.Time{}, bruto)
}

func TestValueDeZeroValueEnviaNulo(t *testing.T) {
	var d tempo.Data

	bruto, err := d.Value()

	require.NoError(t, err)
	assert.Nil(t, bruto)
}

func TestHojeDevolveADataCorrenteSemHora(t *testing.T) {
	h := tempo.Hoje()

	assert.Equal(t, 0, h.Time.Hour())
	assert.Equal(t, 0, h.Time.Minute())
}
