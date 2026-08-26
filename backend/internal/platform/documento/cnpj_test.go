package documento_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/documento"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCNPJValidoEhAceito(t *testing.T) {
	for _, cnpj := range []string{"11222333000181", "34028316000103"} {
		assert.True(t, documento.CNPJValido(cnpj), "%s deveria ser valido", cnpj)
	}
}

func TestCNPJComDigitoVerificadorErradoEhRejeitado(t *testing.T) {
	assert.False(t, documento.CNPJValido("11222333000182"))
}

func TestCNPJComTamanhoErradoEhRejeitado(t *testing.T) {
	for _, cnpj := range []string{"", "1122233300018", "112223330001811"} {
		assert.False(t, documento.CNPJValido(cnpj), "%q deveria ser rejeitado", cnpj)
	}
}

func TestCNPJComTodosOsDigitosIguaisEhRejeitado(t *testing.T) {
	// Passam na conta dos digitos verificadores, mas nao existem.
	for _, cnpj := range []string{"00000000000000", "11111111111111"} {
		assert.False(t, documento.CNPJValido(cnpj), "%s deveria ser rejeitado", cnpj)
	}
}

func TestCNPJComLetraEhRejeitado(t *testing.T) {
	assert.False(t, documento.CNPJValido("1122233300018X"))
}

func TestApenasDigitosRemoveAFormatacao(t *testing.T) {
	assert.Equal(t, "11222333000181", documento.ApenasDigitos("11.222.333/0001-81"))
}

func TestCNPJFormatadoEhAceitoAposLimpeza(t *testing.T) {
	require.True(t, documento.CNPJValido(documento.ApenasDigitos("11.222.333/0001-81")))
}

func TestFormatarCNPJDeixaLegivelParaExibicao(t *testing.T) {
	assert.Equal(t, "11.222.333/0001-81", documento.FormatarCNPJ("11222333000181"))
}

func TestFormatarCNPJDevolveOriginalQuandoNaoTemQuatorzeDigitos(t *testing.T) {
	assert.Equal(t, "123", documento.FormatarCNPJ("123"))
}
