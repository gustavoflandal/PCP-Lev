package handlers_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const corpoPecaValida = `{
	"codigo": "CON-001",
	"descricao": "Conector RCA macho",
	"unidade_medida": "und",
	"estoque_minimo": 50,
	"estoque_maximo": 500,
	"lead_time_compra": 7
}`

func apiPecas(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	handler := handlers.NovoPecaHandler(peca.NovoServico(repository.NovoPecaRepositorio(pool)))
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	return api
}

func criarPeca(t *testing.T, api *apiProtegida, corpo string) map[string]any {
	t.Helper()
	rec := api.chamar(http.MethodPost, "/api/v1/partes-pecas", corpo, usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return dados(t, rec)
}

func rotaPeca(criada map[string]any) string {
	return "/api/v1/partes-pecas/" + formatarID(criada["id"])
}

func TestCriarPecaResponde201(t *testing.T) {
	api := apiPecas(t)

	rec := api.chamar(http.MethodPost, "/api/v1/partes-pecas", corpoPecaValida, usuario.PerfilGestor)

	require.Equal(t, http.StatusCreated, rec.Code)
	criada := dados(t, rec)
	assert.Equal(t, "CON-001", criada["codigo"])
	assert.Equal(t, float64(50), criada["estoque_minimo"])
	assert.Equal(t, true, criada["ativo"])
}

func TestCriarPecaComEstoqueMinimoMaiorQueMaximoResponde400(t *testing.T) {
	api := apiPecas(t)

	rec := api.chamar(http.MethodPost, "/api/v1/partes-pecas",
		`{"codigo":"CON-001","descricao":"Conector RCA macho","unidade_medida":"und","estoque_minimo":600,"estoque_maximo":500,"lead_time_compra":7}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, "ERRO_VALIDACAO", codigoErro(t, rec))
	assert.Contains(t, mensagemErro(t, rec), "estoque minimo")
}

func TestCriarPecaSemCodigoResponde400ComOCampo(t *testing.T) {
	api := apiPecas(t)

	rec := api.chamar(http.MethodPost, "/api/v1/partes-pecas",
		`{"descricao":"Conector RCA macho","unidade_medida":"und","estoque_minimo":50,"estoque_maximo":500,"lead_time_compra":7}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	detalhes := corpoJSON(t, rec)["erro"].(map[string]any)["detalhes"].([]any)
	assert.Equal(t, "codigo", detalhes[0].(map[string]any)["campo"])
}

func TestCriarPecaComEstoqueMinimoZeroEhAceito(t *testing.T) {
	api := apiPecas(t)

	criada := criarPeca(t, api,
		`{"codigo":"CON-001","descricao":"Conector RCA macho","unidade_medida":"und","estoque_minimo":0,"estoque_maximo":500,"lead_time_compra":7}`)

	assert.Equal(t, float64(0), criada["estoque_minimo"])
}

func TestCriarPecaComFornecedorInexistenteResponde409(t *testing.T) {
	api := apiPecas(t)

	rec := api.chamar(http.MethodPost, "/api/v1/partes-pecas",
		`{"codigo":"CON-001","descricao":"Conector RCA macho","unidade_medida":"und","estoque_minimo":50,"estoque_maximo":500,"lead_time_compra":7,"fornecedor_padrao_id":999999}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
	assert.Contains(t, mensagemErro(t, rec), "fornecedor")
}

func TestCriarPecaComCodigoRepetidoResponde409(t *testing.T) {
	api := apiPecas(t)
	criarPeca(t, api, corpoPecaValida)

	rec := api.chamar(http.MethodPost, "/api/v1/partes-pecas", corpoPecaValida, usuario.PerfilGestor)

	assert.Equal(t, http.StatusConflict, rec.Code)
}

func TestCriarPecaNegadoParaOperador(t *testing.T) {
	api := apiPecas(t)

	rec := api.chamar(http.MethodPost, "/api/v1/partes-pecas", corpoPecaValida, usuario.PerfilOperador)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestListarPecasComPaginacao(t *testing.T) {
	api := apiPecas(t)
	criarPeca(t, api, corpoPecaValida)
	criarPeca(t, api, `{"codigo":"PLC-100","descricao":"Placa controladora","unidade_medida":"und","estoque_minimo":5,"estoque_maximo":50,"lead_time_compra":21}`)

	rec := api.chamar(http.MethodGet, "/api/v1/partes-pecas", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Len(t, lista(t, rec), 2)
	assert.Equal(t, float64(2), corpoJSON(t, rec)["paginacao"].(map[string]any)["total"])
}

func TestObterPecaPorID(t *testing.T) {
	api := apiPecas(t)
	criada := criarPeca(t, api, corpoPecaValida)

	rec := api.chamar(http.MethodGet, rotaPeca(criada), "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "CON-001", dados(t, rec)["codigo"])
}

func TestObterPecaInexistenteResponde404(t *testing.T) {
	api := apiPecas(t)

	rec := api.chamar(http.MethodGet, "/api/v1/partes-pecas/999999", "", usuario.PerfilGestor)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestAtualizarPeca(t *testing.T) {
	api := apiPecas(t)
	criada := criarPeca(t, api, corpoPecaValida)

	rec := api.chamar(http.MethodPut, rotaPeca(criada),
		`{"codigo":"CON-001","descricao":"Conector RCA macho dourado","unidade_medida":"und","estoque_minimo":80,"estoque_maximo":800,"lead_time_compra":10}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusOK, rec.Code)
	atualizada := dados(t, rec)
	assert.Equal(t, float64(80), atualizada["estoque_minimo"])
	assert.Equal(t, "Conector RCA macho dourado", atualizada["descricao"])
}

func TestExcluirPecaResponde204(t *testing.T) {
	api := apiPecas(t)
	criada := criarPeca(t, api, corpoPecaValida)

	rec := api.chamar(http.MethodDelete, rotaPeca(criada), "", usuario.PerfilGestor)

	require.Equal(t, http.StatusNoContent, rec.Code)
}

func TestExcluirPecaComMovimentacaoResponde409(t *testing.T) {
	api := apiPecas(t)
	criada := criarPeca(t, api, corpoPecaValida)
	id := int64(criada["id"].(float64))

	_, err := api.pool.Exec(context.Background(), `
		INSERT INTO movimentacao_estoque (parte_peca_id, tipo, quantidade, motivo, referencia_numero)
		VALUES ($1, 'Entrada', 100, 'Compra', 'PC-2026-001')`, id)
	require.NoError(t, err)

	rec := api.chamar(http.MethodDelete, rotaPeca(criada), "", usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
	assert.Contains(t, mensagemErro(t, rec), "movimentacao")
}
