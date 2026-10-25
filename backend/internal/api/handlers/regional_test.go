package handlers_test

import (
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func apiRegional(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	handler := handlers.NovoRegionalHandler(regional.NovoServico(repository.NovoRegionalRepositorio(pool)))
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	return api
}

func TestBuscarRegionalSemTokenResponde401(t *testing.T) {
	api := apiRegional(t)

	rec := api.semToken(http.MethodGet, "/api/v1/configuracoes/regional")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestBuscarRegionalComoOperadorResponde200(t *testing.T) {
	api := apiRegional(t)

	rec := api.chamar(http.MethodGet, "/api/v1/configuracoes/regional", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "DD/MM/AAAA", dados(t, rec)["formato_data"])
}

func TestAtualizarRegionalSemTokenResponde401(t *testing.T) {
	api := apiRegional(t)

	rec := api.semToken(http.MethodPut, "/api/v1/configuracoes/regional")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAtualizarRegionalComoGestorResponde403(t *testing.T) {
	api := apiRegional(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/regional",
		`{"formato_data": "AAAA-MM-DD", "formato_hora": "12H"}`, usuario.PerfilGestor)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestAtualizarRegionalComoOperadorResponde403(t *testing.T) {
	api := apiRegional(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/regional",
		`{"formato_data": "AAAA-MM-DD", "formato_hora": "12H"}`, usuario.PerfilOperador)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestAtualizarRegionalComFormatoDataInvalidoResponde400(t *testing.T) {
	api := apiRegional(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/regional",
		`{"formato_data": "MM/DD/AAAA", "formato_hora": "24H"}`, usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAtualizarRegionalComFormatoHoraInvalidoResponde400(t *testing.T) {
	api := apiRegional(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/regional",
		`{"formato_data": "DD/MM/AAAA", "formato_hora": "36H"}`, usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAtualizarRegionalValidoReflecteNoGetSeguinte(t *testing.T) {
	api := apiRegional(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/regional",
		`{"formato_data": "AAAA-MM-DD", "formato_hora": "12H"}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = api.chamar(http.MethodGet, "/api/v1/configuracoes/regional", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	corpo := dados(t, rec)
	assert.Equal(t, "AAAA-MM-DD", corpo["formato_data"])
	assert.Equal(t, "12H", corpo["formato_hora"])
}
