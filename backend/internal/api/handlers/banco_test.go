package handlers_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/banco"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func apiBanco(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	servico := banco.NovoServico(repository.NovoBancoRepositorio(pool), "postgres", 5432)
	handlers.NovoBancoHandler(servico).Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	return api
}

func TestStatusBancoSemTokenResponde401(t *testing.T) {
	api := apiBanco(t)

	rec := api.semToken(http.MethodGet, "/api/v1/configuracoes/banco")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestStatusBancoSoParaAdministrador(t *testing.T) {
	api := apiBanco(t)

	for _, perfil := range []usuario.Perfil{usuario.PerfilGestor, usuario.PerfilOperador} {
		rec := api.chamar(http.MethodGet, "/api/v1/configuracoes/banco", "", perfil)
		assert.Equal(t, http.StatusForbidden, rec.Code, "GET como %s", perfil)

		rec = api.chamar(http.MethodPost, "/api/v1/configuracoes/banco/testar", "", perfil)
		assert.Equal(t, http.StatusForbidden, rec.Code, "POST testar como %s", perfil)
	}
}

func TestStatusBancoComoAdministradorNaoExpoeCredenciais(t *testing.T) {
	api := apiBanco(t)

	rec := api.chamar(http.MethodGet, "/api/v1/configuracoes/banco", "", usuario.PerfilAdmin)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	corpo := dados(t, rec)
	assert.Equal(t, true, corpo["conectado"])
	assert.Equal(t, "po*****es:5432", corpo["host"])
	assert.NotEmpty(t, corpo["versao"])
	assert.NotEmpty(t, corpo["maiores_tabelas"])
	assert.Nil(t, corpo["ultimo_backup"])

	// Usuario e senha do DSN de teste (testsupport.DSNTeste) nunca podem
	// aparecer na resposta, em nenhum campo.
	bruto := rec.Body.String()
	for _, segredo := range []string{"pcp_user", "senha_segura", "postgres://"} {
		assert.False(t, strings.Contains(bruto, segredo), "resposta contem %q", segredo)
	}
}

func TestTestarConexaoComoAdministrador(t *testing.T) {
	api := apiBanco(t)

	rec := api.chamar(http.MethodPost, "/api/v1/configuracoes/banco/testar", "", usuario.PerfilAdmin)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, true, dados(t, rec)["ok"])
}
