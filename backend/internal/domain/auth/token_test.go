package auth_test

import (
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const segredoTeste = "chave_de_teste_com_mais_de_32_caracteres_ok"

func gestor() *usuario.Usuario {
	return &usuario.Usuario{
		ID: 7, Username: "gestor01", Nome: "Gustavo Landal",
		Perfil: usuario.PerfilGestor, Ativo: true,
	}
}

func TestGerarProduzTokenQueValidaComAsMesmasClaims(t *testing.T) {
	servico := auth.NovoServicoToken(segredoTeste, time.Hour)

	token, expiraEm, err := servico.Gerar(gestor())
	require.NoError(t, err)
	assert.NotEmpty(t, token)
	assert.Equal(t, 3600, expiraEm, "expires_in e informado em segundos")

	claims, err := servico.Validar(token)
	require.NoError(t, err)
	assert.Equal(t, int64(7), claims.UsuarioID)
	assert.Equal(t, "gestor01", claims.Username)
	assert.Equal(t, "Gustavo Landal", claims.Nome)
	assert.Equal(t, usuario.PerfilGestor, claims.Perfil)
}

func TestValidarRejeitaTokenAssinadoComOutroSegredo(t *testing.T) {
	emissor := auth.NovoServicoToken("outro_segredo_com_mais_de_32_caracteres_x", time.Hour)
	token, _, err := emissor.Gerar(gestor())
	require.NoError(t, err)

	_, err = auth.NovoServicoToken(segredoTeste, time.Hour).Validar(token)

	require.ErrorIs(t, err, auth.ErrTokenInvalido)
}

func TestValidarRejeitaTokenExpirado(t *testing.T) {
	servico := auth.NovoServicoToken(segredoTeste, -time.Minute)
	token, _, err := servico.Gerar(gestor())
	require.NoError(t, err)

	_, err = servico.Validar(token)

	require.ErrorIs(t, err, auth.ErrTokenExpirado)
}

func TestValidarRejeitaTokenMalformado(t *testing.T) {
	servico := auth.NovoServicoToken(segredoTeste, time.Hour)

	_, err := servico.Validar("isto.nao.e.um.jwt")

	require.ErrorIs(t, err, auth.ErrTokenInvalido)
}

func TestValidarRejeitaTokenSemAssinatura(t *testing.T) {
	// Ataque "alg: none": o token traz claims validas e nenhuma assinatura.
	semAssinatura := "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0." +
		"eyJ1c3VhcmlvX2lkIjo3LCJwZXJmaWwiOiJBRE1JTiJ9."

	_, err := auth.NovoServicoToken(segredoTeste, time.Hour).Validar(semAssinatura)

	require.ErrorIs(t, err, auth.ErrTokenInvalido)
}
