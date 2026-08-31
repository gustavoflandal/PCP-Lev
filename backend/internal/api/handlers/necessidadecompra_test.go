package handlers_test

import (
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/necessidadecompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// apiNecessidadeCompra monta o NecessidadeCompraHandler sobre um banco
// migrado, com uma peca de apoio ja abaixo do estoque minimo.
func apiNecessidadeCompra(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	handler := handlers.NovoNecessidadeCompraHandler(necessidadecompra.NovoServico(repository.NovoNecessidadeCompraRepositorio(pool)))
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())

	criarPecaDeApoio(t, api, "PP-NC-001", 5)
	return api
}

func TestListarNecessidadeCompraResponde200(t *testing.T) {
	api := apiNecessidadeCompra(t)

	rec := api.chamar(http.MethodGet, "/api/v1/necessidade-compra", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	itens := lista(t, rec)
	require.Len(t, itens, 1)
	item := itens[0].(map[string]any)
	assert.Equal(t, "PP-NC-001", item["codigo"])
	assert.Equal(t, float64(5), item["necessidade"])
}

func TestListarNecessidadeCompraQualquerPerfilAutenticadoLe(t *testing.T) {
	api := apiNecessidadeCompra(t)

	rec := api.chamar(http.MethodGet, "/api/v1/necessidade-compra", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
}

func TestListarNecessidadeCompraSemPecaCriticaDevolveListaVazia(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)
	handler := handlers.NovoNecessidadeCompraHandler(necessidadecompra.NovoServico(repository.NovoNecessidadeCompraRepositorio(pool)))
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())

	rec := api.chamar(http.MethodGet, "/api/v1/necessidade-compra", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Empty(t, lista(t, rec))
}
