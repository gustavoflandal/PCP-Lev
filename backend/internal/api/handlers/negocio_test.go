package handlers_test

import (
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/negocio"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func apiNegocio(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)
	handlers.NovoNegocioHandler(negocio.NovoServico(repository.NovoNegocioRepositorio(pool))).
		Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	return api
}

const corpoNegocioValido = `{"metodo_custeio":"PEPS","tolerancia_excesso_recebimento_pct":5,
	"lead_time_padrao_dias":10,"limite_emissao_gestor":10000,"cotacoes_minimas":3,"valor_exige_cotacoes":5000}`

func TestNegocioSemTokenResponde401(t *testing.T) {
	api := apiNegocio(t)

	assert.Equal(t, http.StatusUnauthorized, api.semToken(http.MethodGet, "/api/v1/configuracoes/negocio").Code)
	assert.Equal(t, http.StatusUnauthorized, api.semToken(http.MethodPut, "/api/v1/configuracoes/negocio").Code)
}

func TestNegocioLeituraParaQualquerPerfil(t *testing.T) {
	api := apiNegocio(t)

	rec := api.chamar(http.MethodGet, "/api/v1/configuracoes/negocio", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	corpo := dados(t, rec)
	assert.Equal(t, "CMP", corpo["metodo_custeio"])
	assert.Equal(t, float64(7), corpo["lead_time_padrao_dias"])
	assert.Nil(t, corpo["limite_emissao_gestor"])
}

func TestNegocioEscritaSoAdministrador(t *testing.T) {
	api := apiNegocio(t)

	for _, perfil := range []usuario.Perfil{usuario.PerfilGestor, usuario.PerfilOperador} {
		rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/negocio", corpoNegocioValido, perfil)
		assert.Equal(t, http.StatusForbidden, rec.Code, "PUT como %s", perfil)
	}
}

func TestNegocioAtualizarValidoReflecteNoGet(t *testing.T) {
	api := apiNegocio(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/negocio", corpoNegocioValido, usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = api.chamar(http.MethodGet, "/api/v1/configuracoes/negocio", "", usuario.PerfilGestor)
	corpo := dados(t, rec)
	assert.Equal(t, "PEPS", corpo["metodo_custeio"])
	assert.Equal(t, float64(5), corpo["tolerancia_excesso_recebimento_pct"])
	assert.Equal(t, float64(10000), corpo["limite_emissao_gestor"])
	assert.Equal(t, float64(3), corpo["cotacoes_minimas"])
}

func TestNegocioAtualizarForaDoIntervaloResponde400(t *testing.T) {
	api := apiNegocio(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/negocio",
		`{"metodo_custeio":"CMP","tolerancia_excesso_recebimento_pct":150,"lead_time_padrao_dias":7}`, usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "tolerancia")
}
