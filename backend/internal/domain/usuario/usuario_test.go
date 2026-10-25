package usuario_test

import (
	"strings"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGerarHashSenhaProduzHashVerificavel(t *testing.T) {
	hash, err := usuario.GerarHashSenha("Senha@12345")

	require.NoError(t, err)
	assert.NotEqual(t, "Senha@12345", hash, "a senha nunca pode ser persistida em claro")

	u := usuario.Usuario{SenhaHash: hash}
	assert.True(t, u.SenhaConfere("Senha@12345"))
}

func TestGerarHashSenhaProduzHashesDiferentesParaMesmaSenha(t *testing.T) {
	primeiro, err := usuario.GerarHashSenha("Senha@12345")
	require.NoError(t, err)
	segundo, err := usuario.GerarHashSenha("Senha@12345")
	require.NoError(t, err)

	assert.NotEqual(t, primeiro, segundo, "o salt deve tornar cada hash unico")
}

func TestGerarHashSenhaRejeitaSenhaComMenosDeDezCaracteres(t *testing.T) {
	_, err := usuario.GerarHashSenha("Curta12!x")

	require.ErrorIs(t, err, usuario.ErrSenhaFraca)
}

func TestSenhaConfereRejeitaSenhaErrada(t *testing.T) {
	hash, err := usuario.GerarHashSenha("Senha@12345")
	require.NoError(t, err)

	u := usuario.Usuario{SenhaHash: hash}
	assert.False(t, u.SenhaConfere("outra_senha"))
}

func TestSenhaConfereRejeitaHashVazio(t *testing.T) {
	u := usuario.Usuario{SenhaHash: ""}
	assert.False(t, u.SenhaConfere(""))
}

func TestPreferenciasValidarAceitaACombinacaoPadrao(t *testing.T) {
	p := usuario.Preferencias{
		Tema: usuario.TemaAutomatico, Densidade: usuario.DensidadeConfortavel, TamanhoFonte: usuario.FontePadrao,
	}
	assert.NoError(t, p.Validar())
}

func TestPreferenciasValidarRejeitaTemaForaDoConjunto(t *testing.T) {
	p := usuario.Preferencias{Tema: "roxo", Densidade: usuario.DensidadeConfortavel, TamanhoFonte: usuario.FontePadrao}
	assert.ErrorIs(t, p.Validar(), usuario.ErrPreferenciaInvalida)
}

func TestPreferenciasValidarRejeitaDensidadeForaDoConjunto(t *testing.T) {
	p := usuario.Preferencias{Tema: usuario.TemaClaro, Densidade: "espacosa", TamanhoFonte: usuario.FontePadrao}
	assert.ErrorIs(t, p.Validar(), usuario.ErrPreferenciaInvalida)
}

func TestPreferenciasValidarRejeitaTamanhoFonteForaDoConjunto(t *testing.T) {
	p := usuario.Preferencias{Tema: usuario.TemaClaro, Densidade: usuario.DensidadeCompacta, TamanhoFonte: "gigante"}
	assert.ErrorIs(t, p.Validar(), usuario.ErrPreferenciaInvalida)
}

func TestPoliticaDeSenha(t *testing.T) {
	for _, ruim := range []string{"1234567890", "Password12", "aaaaaaaaaaaa", strings.Repeat("x", 73) + "1"} {
		assert.ErrorIs(t, usuario.ValidarSenha(ruim), usuario.ErrSenhaFraca, ruim)
	}
	assert.NoError(t, usuario.ValidarSenha("Fabrica#Radar7"))
	assert.ErrorIs(t, usuario.ValidarSenhaDoUsuario("maria.silva#2026", "Maria.Silva"), usuario.ErrSenhaFraca, "contem o login")
	assert.NoError(t, usuario.ValidarSenhaDoUsuario("Fabrica#Radar7", "maria.silva"))
}
