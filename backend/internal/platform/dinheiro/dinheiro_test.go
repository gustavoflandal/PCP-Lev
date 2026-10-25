package dinheiro_test

import (
	"encoding/json"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDeStringLeValorComDuasCasas(t *testing.T) {
	valor, err := dinheiro.DeString("5000.00")

	require.NoError(t, err)
	assert.Equal(t, int64(500000), valor.Centavos())
}

func TestDeStringLeValorSemCasasDecimais(t *testing.T) {
	valor, err := dinheiro.DeString("120")

	require.NoError(t, err)
	assert.Equal(t, int64(12000), valor.Centavos())
}

func TestDeStringLeValorComUmaCasaDecimal(t *testing.T) {
	valor, err := dinheiro.DeString("12.5")

	require.NoError(t, err)
	assert.Equal(t, int64(1250), valor.Centavos())
}

func TestDeStringRejeitaMaisDeDuasCasas(t *testing.T) {
	_, err := dinheiro.DeString("10.005")

	require.Error(t, err)
}

func TestDeStringRejeitaTextoInvalido(t *testing.T) {
	_, err := dinheiro.DeString("mil reais")

	require.Error(t, err)
}

func TestStringDevolveSempreDuasCasas(t *testing.T) {
	valor, err := dinheiro.DeString("12.5")
	require.NoError(t, err)

	assert.Equal(t, "12.50", valor.String())
}

func TestJSONSerializaComoNumeroDecimal(t *testing.T) {
	valor, err := dinheiro.DeString("5000.00")
	require.NoError(t, err)

	bruto, err := json.Marshal(map[string]dinheiro.Dinheiro{"preco_venda": valor})

	require.NoError(t, err)
	assert.JSONEq(t, `{"preco_venda":5000.00}`, string(bruto))
}

func TestJSONLeNumeroDecimalSemPerderCentavos(t *testing.T) {
	var corpo struct {
		Preco dinheiro.Dinheiro `json:"preco_venda"`
	}

	require.NoError(t, json.Unmarshal([]byte(`{"preco_venda": 1234.56}`), &corpo))

	assert.Equal(t, int64(123456), corpo.Preco.Centavos())
}

func TestJSONLeValorEmTextoTambem(t *testing.T) {
	var corpo struct {
		Preco dinheiro.Dinheiro `json:"preco_venda"`
	}

	require.NoError(t, json.Unmarshal([]byte(`{"preco_venda": "89.90"}`), &corpo))

	assert.Equal(t, int64(8990), corpo.Preco.Centavos())
}

func TestMultiplicarPorQuantidadeNaoPerdeCentavos(t *testing.T) {
	unitario, err := dinheiro.DeString("0.07")
	require.NoError(t, err)

	// Em float64, 0.07 * 3 daria 0.21000000000000002.
	assert.Equal(t, "0.21", unitario.Vezes(3).String())
}

func TestSomarAcumulaValores(t *testing.T) {
	a, _ := dinheiro.DeString("10.10")
	b, _ := dinheiro.DeString("0.90")

	assert.Equal(t, "11.00", a.Mais(b).String())
}

func TestPositivoDistingueValorZeroDeValorValido(t *testing.T) {
	zero, _ := dinheiro.DeString("0")
	valido, _ := dinheiro.DeString("0.01")

	assert.False(t, zero.Positivo())
	assert.True(t, valido.Positivo())
}

func TestScanLeONumericDoPostgresComoTexto(t *testing.T) {
	var valor dinheiro.Dinheiro

	require.NoError(t, valor.Scan("5000.00"))

	assert.Equal(t, int64(500000), valor.Centavos())
}

func TestScanAceitaBytesDoDriver(t *testing.T) {
	var valor dinheiro.Dinheiro

	require.NoError(t, valor.Scan([]byte("89.90")))

	assert.Equal(t, int64(8990), valor.Centavos())
}

func TestScanDeNuloDeixaValorZerado(t *testing.T) {
	var valor dinheiro.Dinheiro

	require.NoError(t, valor.Scan(nil))

	assert.Equal(t, int64(0), valor.Centavos())
}

func TestValueEnviaTextoParaOBanco(t *testing.T) {
	valor, err := dinheiro.DeString("5000.00")
	require.NoError(t, err)

	bruto, err := valor.Value()

	require.NoError(t, err)
	assert.Equal(t, "5000.00", bruto)
}
