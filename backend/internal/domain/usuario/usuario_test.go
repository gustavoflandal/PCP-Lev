package usuario_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGerarHashSenhaProduzHashVerificavel(t *testing.T) {
	hash, err := usuario.GerarHashSenha("Senha@123")

	require.NoError(t, err)
	assert.NotEqual(t, "Senha@123", hash, "a senha nunca pode ser persistida em claro")

	u := usuario.Usuario{SenhaHash: hash}
	assert.True(t, u.SenhaConfere("Senha@123"))
}

func TestGerarHashSenhaProduzHashesDiferentesParaMesmaSenha(t *testing.T) {
	primeiro, err := usuario.GerarHashSenha("Senha@123")
	require.NoError(t, err)
	segundo, err := usuario.GerarHashSenha("Senha@123")
	require.NoError(t, err)

	assert.NotEqual(t, primeiro, segundo, "o salt deve tornar cada hash unico")
}

func TestGerarHashSenhaRejeitaSenhaComMenosDeOitoCaracteres(t *testing.T) {
	_, err := usuario.GerarHashSenha("Curta1!")

	require.ErrorIs(t, err, usuario.ErrSenhaFraca)
}

func TestSenhaConfereRejeitaSenhaErrada(t *testing.T) {
	hash, err := usuario.GerarHashSenha("Senha@123")
	require.NoError(t, err)

	u := usuario.Usuario{SenhaHash: hash}
	assert.False(t, u.SenhaConfere("outra_senha"))
}

func TestSenhaConfereRejeitaHashVazio(t *testing.T) {
	u := usuario.Usuario{SenhaHash: ""}
	assert.False(t, u.SenhaConfere(""))
}

func TestPerfilReconheceApenasOsTresPerfisDoRNF3(t *testing.T) {
	assert.True(t, usuario.PerfilAdmin.Valido())
	assert.True(t, usuario.PerfilGestor.Valido())
	assert.True(t, usuario.PerfilOperador.Valido())
	assert.False(t, usuario.Perfil("DIRETOR").Valido())
}

func TestPodeGerenciarCadastrosSomenteParaGestorEAdmin(t *testing.T) {
	assert.True(t, usuario.PerfilAdmin.PodeGerenciarCadastros())
	assert.True(t, usuario.PerfilGestor.PodeGerenciarCadastros())
	assert.False(t, usuario.PerfilOperador.PodeGerenciarCadastros())
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
