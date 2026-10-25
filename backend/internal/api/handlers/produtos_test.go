package handlers_test

import (
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const corpoProdutoValido = `{
	"codigo": "VMS-01",
	"descricao": "Painel de Velocidade VMS Serie 01",
	"unidade_medida": "und",
	"preco_venda": 5000.00,
	"lead_time_producao": 10
}`

func apiProdutos(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	handler := handlers.NovoProdutoHandler(produto.NovoServico(repository.NovoProdutoRepositorio(pool)))
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	return api
}

func criarProduto(t *testing.T, api *apiProtegida, corpo string) map[string]any {
	t.Helper()
	rec := api.chamar(http.MethodPost, "/api/v1/produtos-acabados", corpo, usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return dados(t, rec)
}

func TestCriarProdutoResponde201ComOContratoDoDoc3(t *testing.T) {
	api := apiProdutos(t)

	rec := api.chamar(http.MethodPost, "/api/v1/produtos-acabados", corpoProdutoValido, usuario.PerfilGestor)

	require.Equal(t, http.StatusCreated, rec.Code)
	body := corpoJSON(t, rec)
	assert.Equal(t, true, body["sucesso"])

	criado := body["dados"].(map[string]any)
	assert.NotZero(t, criado["id"])
	assert.Equal(t, "VMS-01", criado["codigo"])
	assert.Equal(t, 5000.00, criado["preco_venda"])
	assert.Equal(t, true, criado["ativo"])
	assert.Equal(t, "gestor01", criado["created_by"])
}

func TestCriarProdutoNormalizaOCodigo(t *testing.T) {
	api := apiProdutos(t)

	criado := criarProduto(t, api, `{"codigo":"vms-01","descricao":"Painel de velocidade","unidade_medida":"und","preco_venda":5000,"lead_time_producao":10}`)

	assert.Equal(t, "VMS-01", criado["codigo"])
}

func TestCriarProdutoSemCodigoResponde400ComOCampo(t *testing.T) {
	api := apiProdutos(t)

	rec := api.chamar(http.MethodPost, "/api/v1/produtos-acabados",
		`{"descricao":"Painel de velocidade","unidade_medida":"und","preco_venda":5000,"lead_time_producao":10}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, "ERRO_VALIDACAO", codigoErro(t, rec))
	detalhes := corpoJSON(t, rec)["erro"].(map[string]any)["detalhes"].([]any)
	assert.Equal(t, "codigo", detalhes[0].(map[string]any)["campo"])
}

func TestCriarProdutoComDescricaoCurtaResponde400(t *testing.T) {
	api := apiProdutos(t)

	rec := api.chamar(http.MethodPost, "/api/v1/produtos-acabados",
		`{"codigo":"VMS-01","descricao":"VMS","unidade_medida":"und","preco_venda":5000,"lead_time_producao":10}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, "ERRO_VALIDACAO", codigoErro(t, rec))
}

func TestCriarProdutoComPrecoZeradoResponde400(t *testing.T) {
	api := apiProdutos(t)

	rec := api.chamar(http.MethodPost, "/api/v1/produtos-acabados",
		`{"codigo":"VMS-01","descricao":"Painel de velocidade","unidade_medida":"und","preco_venda":0,"lead_time_producao":10}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestCriarProdutoComCodigoRepetidoResponde409(t *testing.T) {
	api := apiProdutos(t)
	criarProduto(t, api, corpoProdutoValido)

	rec := api.chamar(http.MethodPost, "/api/v1/produtos-acabados", corpoProdutoValido, usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
	assert.Equal(t, "CONFLITO", codigoErro(t, rec))
	assert.Contains(t, mensagemErro(t, rec), "codigo")
}

func TestCriarProdutoExigeAutenticacao(t *testing.T) {
	api := apiProdutos(t)

	rec := api.semToken(http.MethodPost, "/api/v1/produtos-acabados")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestCriarProdutoNegadoParaOperador(t *testing.T) {
	api := apiProdutos(t)

	rec := api.chamar(http.MethodPost, "/api/v1/produtos-acabados", corpoProdutoValido, usuario.PerfilOperador)

	require.Equal(t, http.StatusForbidden, rec.Code)
	assert.Equal(t, "ACESSO_NEGADO", codigoErro(t, rec))
}

func TestListarProdutosDevolvePaginacao(t *testing.T) {
	api := apiProdutos(t)
	criarProduto(t, api, corpoProdutoValido)
	criarProduto(t, api, `{"codigo":"R-200","descricao":"Radar de transito","unidade_medida":"und","preco_venda":12000,"lead_time_producao":15}`)

	rec := api.chamar(http.MethodGet, "/api/v1/produtos-acabados?pagina=1&limite=1", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Len(t, lista(t, rec), 1)

	paginacao := corpoJSON(t, rec)["paginacao"].(map[string]any)
	assert.Equal(t, float64(1), paginacao["pagina"])
	assert.Equal(t, float64(2), paginacao["total"])
	assert.Equal(t, float64(2), paginacao["total_paginas"])
}

func TestListarProdutosFiltraPelaBusca(t *testing.T) {
	api := apiProdutos(t)
	criarProduto(t, api, corpoProdutoValido)
	criarProduto(t, api, `{"codigo":"R-200","descricao":"Radar de transito","unidade_medida":"und","preco_venda":12000,"lead_time_producao":15}`)

	rec := api.chamar(http.MethodGet, "/api/v1/produtos-acabados?busca=radar", "", usuario.PerfilGestor)

	require.Equal(t, http.StatusOK, rec.Code)
	itens := lista(t, rec)
	require.Len(t, itens, 1)
	assert.Equal(t, "R-200", itens[0].(map[string]any)["codigo"])
}

func TestListarProdutosRejeitaOrdenacaoPorColunaDesconhecida(t *testing.T) {
	api := apiProdutos(t)

	rec := api.chamar(http.MethodGet, "/api/v1/produtos-acabados?ordenar_por=senha_hash", "", usuario.PerfilGestor)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, "REQUISICAO_INVALIDA", codigoErro(t, rec))
}

func TestListarProdutosLiberadoParaOperador(t *testing.T) {
	api := apiProdutos(t)

	rec := api.chamar(http.MethodGet, "/api/v1/produtos-acabados", "", usuario.PerfilOperador)

	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestObterProdutoPorID(t *testing.T) {
	api := apiProdutos(t)
	criado := criarProduto(t, api, corpoProdutoValido)

	rec := api.chamar(http.MethodGet, rotaProduto(criado), "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "VMS-01", dados(t, rec)["codigo"])
}

func TestObterProdutoInexistenteResponde404(t *testing.T) {
	api := apiProdutos(t)

	rec := api.chamar(http.MethodGet, "/api/v1/produtos-acabados/999999", "", usuario.PerfilGestor)

	require.Equal(t, http.StatusNotFound, rec.Code)
	assert.Equal(t, "NAO_ENCONTRADO", codigoErro(t, rec))
}

func TestObterProdutoComIDNaoNumericoResponde400(t *testing.T) {
	api := apiProdutos(t)

	rec := api.chamar(http.MethodGet, "/api/v1/produtos-acabados/abc", "", usuario.PerfilGestor)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAtualizarProduto(t *testing.T) {
	api := apiProdutos(t)
	criado := criarProduto(t, api, corpoProdutoValido)

	rec := api.chamar(http.MethodPut, rotaProduto(criado),
		`{"codigo":"VMS-01","descricao":"Painel de Velocidade VMS Serie 02","unidade_medida":"und","preco_venda":6200.50,"lead_time_producao":12}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusOK, rec.Code)
	atualizado := dados(t, rec)
	assert.Equal(t, "Painel de Velocidade VMS Serie 02", atualizado["descricao"])
	assert.Equal(t, 6200.50, atualizado["preco_venda"])
}

func TestAtualizarProdutoInexistenteResponde404(t *testing.T) {
	api := apiProdutos(t)

	rec := api.chamar(http.MethodPut, "/api/v1/produtos-acabados/999999", corpoProdutoValido, usuario.PerfilGestor)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestExcluirProdutoResponde204(t *testing.T) {
	api := apiProdutos(t)
	criado := criarProduto(t, api, corpoProdutoValido)

	rec := api.chamar(http.MethodDelete, rotaProduto(criado), "", usuario.PerfilGestor)

	require.Equal(t, http.StatusNoContent, rec.Code)
	assert.Empty(t, rec.Body.String())

	consulta := api.chamar(http.MethodGet, rotaProduto(criado), "", usuario.PerfilGestor)
	assert.Equal(t, false, dados(t, consulta)["ativo"], "exclusao e logica: o registro continua")
}

func TestExcluirProdutoNegadoParaOperador(t *testing.T) {
	api := apiProdutos(t)
	criado := criarProduto(t, api, corpoProdutoValido)

	rec := api.chamar(http.MethodDelete, rotaProduto(criado), "", usuario.PerfilOperador)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestExcluirProdutoComVendasResponde409(t *testing.T) {
	api := apiProdutos(t)
	criado := criarProduto(t, api, corpoProdutoValido)
	id := int64(criado["id"].(float64))

	ctx := t.Context()
	_, err := api.pool.Exec(ctx, `
		INSERT INTO pedidos_venda (numero_pedido, cliente_nome, data_pedido, data_entrega_prometida, valor_total)
		VALUES ('PV-2026-001', 'Prefeitura', CURRENT_DATE, CURRENT_DATE + 30, 5000.00)`)
	require.NoError(t, err)
	_, err = api.pool.Exec(ctx, `
		INSERT INTO itens_pedido_venda (pedido_venda_id, produto_acabado_id, quantidade, preco_unitario, total)
		SELECT id, $1, 1, 5000.00, 5000.00 FROM pedidos_venda WHERE numero_pedido = 'PV-2026-001'`, id)
	require.NoError(t, err)

	rec := api.chamar(http.MethodDelete, rotaProduto(criado), "", usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
	assert.Contains(t, mensagemErro(t, rec), "pedidos de venda")
}

func rotaProduto(criado map[string]any) string {
	return "/api/v1/produtos-acabados/" + formatarID(criado["id"])
}
