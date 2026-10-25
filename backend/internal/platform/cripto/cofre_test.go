package cripto_test

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/cripto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func chave(b byte) string {
	return base64.StdEncoding.EncodeToString([]byte(strings.Repeat(string(b), cripto.TamanhoChave)))
}

const contexto = "configuracao_smtp|smtp.empresa.com.br|587|pcp"

func TestCifrarEDecifrarIdaEVolta(t *testing.T) {
	cofre, err := cripto.NovoCofre(chave('a'))
	require.NoError(t, err)

	cifrado, err := cofre.Cifrar("senha-do-smtp", contexto)
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(cifrado, "v1:"), "versao do esquema na frente")
	assert.NotContains(t, cifrado, "senha-do-smtp")

	texto, err := cofre.Decifrar(cifrado, contexto)
	require.NoError(t, err)
	assert.Equal(t, "senha-do-smtp", texto)
}

func TestCifrarDuasVezesDaResultadosDiferentes(t *testing.T) {
	cofre, _ := cripto.NovoCofre(chave('a'))

	a, _ := cofre.Cifrar("mesma", contexto)
	b, _ := cofre.Cifrar("mesma", contexto)

	assert.NotEqual(t, a, b, "nonce aleatorio a cada gravacao")
}

func TestDecifrarEmOutroContextoFalha(t *testing.T) {
	cofre, _ := cripto.NovoCofre(chave('a'))
	cifrado, _ := cofre.Cifrar("segredo", contexto)

	_, err := cofre.Decifrar(cifrado, "configuracao_smtp|smtp.atacante.com|587|pcp")

	assert.ErrorIs(t, err, cripto.ErrTextoCifradoInvalido, "o segredo fica amarrado ao destino")
}

func TestDecifrarComOutraChaveFalha(t *testing.T) {
	cofreA, _ := cripto.NovoCofre(chave('a'))
	cofreB, _ := cripto.NovoCofre(chave('b'))
	cifrado, _ := cofreA.Cifrar("segredo", contexto)

	_, err := cofreB.Decifrar(cifrado, contexto)

	assert.ErrorIs(t, err, cripto.ErrTextoCifradoInvalido)
}

func TestDecifrarValorAdulteradoOuSemVersaoFalha(t *testing.T) {
	cofre, _ := cripto.NovoCofre(chave('a'))
	cifrado, _ := cofre.Cifrar("segredo", contexto)
	bruto, _ := base64.StdEncoding.DecodeString(strings.TrimPrefix(cifrado, "v1:"))
	bruto[len(bruto)-1] ^= 0xff

	_, err := cofre.Decifrar("v1:"+base64.StdEncoding.EncodeToString(bruto), contexto)
	assert.ErrorIs(t, err, cripto.ErrTextoCifradoInvalido)

	_, err = cofre.Decifrar(strings.TrimPrefix(cifrado, "v1:"), contexto)
	assert.ErrorIs(t, err, cripto.ErrTextoCifradoInvalido, "sem o prefixo de versao")

	_, err = cofre.Decifrar("v1:nao-e-base64!", contexto)
	assert.ErrorIs(t, err, cripto.ErrTextoCifradoInvalido)
}

func TestNovoCofreSemChaveDevolveNil(t *testing.T) {
	cofre, err := cripto.NovoCofre("")

	assert.NoError(t, err)
	assert.Nil(t, cofre)
}

func TestNovoCofreRecusaChaveInvalida(t *testing.T) {
	_, err := cripto.NovoCofre("curta")
	assert.Error(t, err)

	_, err = cripto.NovoCofre(base64.StdEncoding.EncodeToString([]byte("16-bytes-apenas!")))
	assert.ErrorContains(t, err, "32 bytes")
}
