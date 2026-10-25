package handlers_test

import (
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func apiAcesso(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)
	handlers.NovoAcessoHandler(acesso.NovoServico(repository.NovoAcessoRepositorio(pool))).
		Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	return api
}

func TestAcessoSoComPermissaoDePerfis(t *testing.T) {
	api := apiAcesso(t)

	assert.Equal(t, http.StatusUnauthorized, api.semToken(http.MethodGet, "/api/v1/acesso/perfis").Code)
	assert.Equal(t, http.StatusForbidden, api.chamar(http.MethodGet, "/api/v1/acesso/perfis", "", usuario.PerfilGestor).Code,
		"o Gestor nao edita a matriz (sem acesso a credenciais tecnicas)")
	assert.Equal(t, http.StatusOK, api.chamar(http.MethodGet, "/api/v1/acesso/perfis", "", usuario.PerfilAdmin).Code)
}

func TestAcessoCatalogoEPerfisSemeados(t *testing.T) {
	api := apiAcesso(t)

	rec := api.chamar(http.MethodGet, "/api/v1/acesso/permissoes", "", usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"sensivel":true`)

	rec = api.chamar(http.MethodGet, "/api/v1/acesso/perfis", "", usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code)
	for _, codigo := range []string{"ADMIN", "GESTOR", "COMPRADOR", "ALMOXARIFE", "OPERADOR", "QUALIDADE", "VENDAS", "CONSULTA"} {
		assert.Contains(t, rec.Body.String(), `"codigo":"`+codigo+`"`)
	}
}

func TestAcessoCriarEditarExcluirPerfil(t *testing.T) {
	api := apiAcesso(t)

	rec := api.chamar(http.MethodPost, "/api/v1/acesso/perfis",
		`{"codigo":"COMPRADOR_JR","nome":"Comprador junior","permissoes":["cotacoes.visualizar"]}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	rec = api.chamar(http.MethodPut, "/api/v1/acesso/perfis/COMPRADOR_JR",
		`{"nome":"Comprador junior","permissoes":["cotacoes.visualizar","cotacoes.incluir"]}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Len(t, dados(t, rec)["permissoes"], 2)

	// A permissao nova vale na hora para quem tem o perfil.
	assert.Equal(t, http.StatusOK, api.chamar(http.MethodGet, "/api/v1/acesso/perfis/COMPRADOR_JR", "", usuario.PerfilAdmin).Code)

	rec = api.chamar(http.MethodDelete, "/api/v1/acesso/perfis/COMPRADOR_JR", "", usuario.PerfilAdmin)
	assert.Equal(t, http.StatusNoContent, rec.Code)
	assert.Equal(t, http.StatusNotFound, api.chamar(http.MethodGet, "/api/v1/acesso/perfis/COMPRADOR_JR", "", usuario.PerfilAdmin).Code)
}

func TestAcessoProtecoes(t *testing.T) {
	api := apiAcesso(t)

	assert.Equal(t, http.StatusConflict,
		api.chamar(http.MethodPut, "/api/v1/acesso/perfis/ADMIN", `{"nome":"Admin","permissoes":[]}`, usuario.PerfilAdmin).Code)
	assert.Equal(t, http.StatusConflict,
		api.chamar(http.MethodDelete, "/api/v1/acesso/perfis/GESTOR", "", usuario.PerfilAdmin).Code)
	assert.Equal(t, http.StatusBadRequest,
		api.chamar(http.MethodPost, "/api/v1/acesso/perfis", `{"codigo":"X","nome":"x"}`, usuario.PerfilAdmin).Code)
	assert.Equal(t, http.StatusBadRequest,
		api.chamar(http.MethodPut, "/api/v1/acesso/perfis/VENDAS", `{"nome":"Vendas","permissoes":["inventada.x"]}`, usuario.PerfilAdmin).Code)
}
