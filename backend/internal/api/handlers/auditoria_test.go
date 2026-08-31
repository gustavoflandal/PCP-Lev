package handlers_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auditoria"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func apiAuditoria(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	handler := handlers.NovoAuditoriaHandler(auditoria.NovoServico(repository.NovoAuditoriaRepositorio(pool)))
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())

	// Uma linha de auditoria de verdade (o trigger da migration 007 grava
	// sozinho ao inserir um fornecedor).
	_, err := pool.Exec(context.Background(),
		`INSERT INTO fornecedores (razao_social, cnpj, lead_time_medio, ativo, created_by, updated_by)
		 VALUES ('Fornecedor Auditoria', '11222333000181', 7, true, 'teste', 'teste')`)
	require.NoError(t, err)

	return api
}

func TestListarAuditoriaSemTokenResponde401(t *testing.T) {
	api := apiAuditoria(t)

	rec := api.semToken(http.MethodGet, "/api/v1/auditoria")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestListarAuditoriaComoGestorResponde403(t *testing.T) {
	api := apiAuditoria(t)

	rec := api.chamar(http.MethodGet, "/api/v1/auditoria", "", usuario.PerfilGestor)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestListarAuditoriaComoOperadorResponde403(t *testing.T) {
	api := apiAuditoria(t)

	rec := api.chamar(http.MethodGet, "/api/v1/auditoria", "", usuario.PerfilOperador)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestListarAuditoriaComoAdminResponde200ComPaginacao(t *testing.T) {
	api := apiAuditoria(t)

	rec := api.chamar(http.MethodGet, "/api/v1/auditoria", "", usuario.PerfilAdmin)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	corpo := corpoJSON(t, rec)
	assert.NotEmpty(t, lista(t, rec))
	require.Contains(t, corpo, "paginacao")
}

func TestListarAuditoriaFiltraPorTabela(t *testing.T) {
	api := apiAuditoria(t)

	rec := api.chamar(http.MethodGet, "/api/v1/auditoria?tabela=fornecedores", "", usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.NotEmpty(t, lista(t, rec))

	rec = api.chamar(http.MethodGet, "/api/v1/auditoria?tabela=partes_pecas", "", usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Empty(t, lista(t, rec))
}

func TestListarAuditoriaComTabelaInvalidaResponde400(t *testing.T) {
	api := apiAuditoria(t)

	rec := api.chamar(http.MethodGet, "/api/v1/auditoria?tabela=nao_existe", "", usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestListarAuditoriaComDataInvalidaResponde400(t *testing.T) {
	api := apiAuditoria(t)

	rec := api.chamar(http.MethodGet, "/api/v1/auditoria?data_inicio=31-08-2026", "", usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestExportarAuditoriaCSVSemTokenResponde401(t *testing.T) {
	api := apiAuditoria(t)

	rec := api.semToken(http.MethodGet, "/api/v1/auditoria/exportar")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestExportarAuditoriaCSVComoGestorResponde403(t *testing.T) {
	api := apiAuditoria(t)

	rec := api.chamar(http.MethodGet, "/api/v1/auditoria/exportar", "", usuario.PerfilGestor)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestExportarAuditoriaCSVComoOperadorResponde403(t *testing.T) {
	api := apiAuditoria(t)

	rec := api.chamar(http.MethodGet, "/api/v1/auditoria/exportar", "", usuario.PerfilOperador)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestExportarAuditoriaCSVComoAdminRespondeArquivo(t *testing.T) {
	api := apiAuditoria(t)

	rec := api.chamar(http.MethodGet, "/api/v1/auditoria/exportar?tabela=fornecedores", "", usuario.PerfilAdmin)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Header().Get("Content-Type"), "text/csv")
	corpo := rec.Body.Bytes()
	require.True(t, len(corpo) > 3)
	assert.Equal(t, []byte{0xEF, 0xBB, 0xBF}, corpo[:3], "BOM UTF-8 obrigatorio para o Excel pt-BR")
	assert.Contains(t, string(corpo), "fornecedores")
}
