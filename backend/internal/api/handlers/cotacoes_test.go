package handlers_test

import (
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cotacao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func apiCotacoes(t *testing.T) (*apiProtegida, int64, int64) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	cotacaoServico := cotacao.NovoServico(repository.NovoCotacaoRepositorio(pool))
	pedidoServico := pedidocompra.NovoServico(repository.NovoPedidoCompraRepositorio(pool))

	handlers.NovoCotacaoHandler(cotacaoServico, pedidoServico).Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	handlers.NovoPedidoCompraHandler(pedidoServico).Registrar(api.echo.Group("/api/v1"), api.autenticacao())

	fornecedorID, pecaID := criarFornecedorEPecaDeApoio(t, api)
	return api, fornecedorID, pecaID
}

func corpoCotacaoValido(fornecedorID, pecaID int64) string {
	return `{
		"numero_cotacao": "COT-2026-001",
		"fornecedor_id": ` + formatarID(float64(fornecedorID)) + `,
		"data_validade": "2026-12-25",
		"itens": [{"parte_peca_id": ` + formatarID(float64(pecaID)) + `, "quantidade": 100, "preco_unitario": 50.00}]
	}`
}

func criarCotacao(t *testing.T, api *apiProtegida, corpo string) map[string]any {
	t.Helper()
	rec := api.chamar(http.MethodPost, "/api/v1/cotacoes", corpo, usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return dados(t, rec)
}

func rotaCotacao(criada map[string]any) string {
	return "/api/v1/cotacoes/" + formatarID(criada["id"])
}

func TestCriarCotacaoResponde201(t *testing.T) {
	api, fornecedorID, pecaID := apiCotacoes(t)

	rec := api.chamar(http.MethodPost, "/api/v1/cotacoes", corpoCotacaoValido(fornecedorID, pecaID), usuario.PerfilGestor)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	criada := dados(t, rec)
	assert.Equal(t, "Rascunho", criada["status"])
	assert.Equal(t, float64(5000), criada["valor_total"])
}

func TestCriarCotacaoSemItensResponde400(t *testing.T) {
	api, fornecedorID, _ := apiCotacoes(t)

	rec := api.chamar(http.MethodPost, "/api/v1/cotacoes",
		`{"numero_cotacao":"COT-2026-001","fornecedor_id":`+formatarID(float64(fornecedorID))+`,"data_validade":"2026-12-25","itens":[]}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestCriarCotacaoComNumeroRepetidoResponde409(t *testing.T) {
	api, fornecedorID, pecaID := apiCotacoes(t)
	criarCotacao(t, api, corpoCotacaoValido(fornecedorID, pecaID))

	rec := api.chamar(http.MethodPost, "/api/v1/cotacoes", corpoCotacaoValido(fornecedorID, pecaID), usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestObterCotacaoInexistenteResponde404(t *testing.T) {
	api, _, _ := apiCotacoes(t)

	rec := api.chamar(http.MethodGet, "/api/v1/cotacoes/999999", "", usuario.PerfilGestor)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestListarCotacoesComFiltroDeStatus(t *testing.T) {
	api, fornecedorID, pecaID := apiCotacoes(t)
	criada := criarCotacao(t, api, corpoCotacaoValido(fornecedorID, pecaID))
	rec := api.chamar(http.MethodPost, rotaCotacao(criada)+"/enviar", "", usuario.PerfilGestor)
	require.Equal(t, http.StatusOK, rec.Code)

	rec = api.chamar(http.MethodGet, "/api/v1/cotacoes?status=Enviada", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Len(t, lista(t, rec), 1)
}

func TestEnviarCotacaoMudaStatus(t *testing.T) {
	api, fornecedorID, pecaID := apiCotacoes(t)
	criada := criarCotacao(t, api, corpoCotacaoValido(fornecedorID, pecaID))

	rec := api.chamar(http.MethodPost, rotaCotacao(criada)+"/enviar", "", usuario.PerfilGestor)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "Enviada", dados(t, rec)["status"])
}

func TestEnviarCotacaoForaDeRascunhoResponde409(t *testing.T) {
	api, fornecedorID, pecaID := apiCotacoes(t)
	criada := criarCotacao(t, api, corpoCotacaoValido(fornecedorID, pecaID))
	rec := api.chamar(http.MethodPost, rotaCotacao(criada)+"/enviar", "", usuario.PerfilGestor)
	require.Equal(t, http.StatusOK, rec.Code)

	rec = api.chamar(http.MethodPost, rotaCotacao(criada)+"/enviar", "", usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestRegistrarRespostaMudaStatusERecalculaValorTotal(t *testing.T) {
	api, fornecedorID, pecaID := apiCotacoes(t)
	criada := criarCotacao(t, api, corpoCotacaoValido(fornecedorID, pecaID))
	rec := api.chamar(http.MethodPost, rotaCotacao(criada)+"/enviar", "", usuario.PerfilGestor)
	require.Equal(t, http.StatusOK, rec.Code)

	corpo := `{"data_resposta":"2026-09-01","itens":[{"parte_peca_id":` + formatarID(criada["itens"].([]any)[0].(map[string]any)["parte_peca_id"]) + `,"preco_unitario":48.00}]}`
	rec = api.chamar(http.MethodPost, rotaCotacao(criada)+"/registrar-resposta", corpo, usuario.PerfilGestor)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	respondida := dados(t, rec)
	assert.Equal(t, "Respondida", respondida["status"])
	assert.Equal(t, float64(4800), respondida["valor_total"])
}

func TestRegistrarRespostaForaDeEnviadaResponde409(t *testing.T) {
	api, fornecedorID, pecaID := apiCotacoes(t)
	criada := criarCotacao(t, api, corpoCotacaoValido(fornecedorID, pecaID))

	corpo := `{"data_resposta":"2026-09-01","itens":[{"parte_peca_id":` + formatarID(float64(pecaID)) + `,"preco_unitario":48.00}]}`
	rec := api.chamar(http.MethodPost, rotaCotacao(criada)+"/registrar-resposta", corpo, usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestCancelarCotacaoMudaStatus(t *testing.T) {
	api, fornecedorID, pecaID := apiCotacoes(t)
	criada := criarCotacao(t, api, corpoCotacaoValido(fornecedorID, pecaID))

	rec := api.chamar(http.MethodPost, rotaCotacao(criada)+"/cancelar", "", usuario.PerfilGestor)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "Cancelada", dados(t, rec)["status"])
}

func TestCriarCotacaoNegadoParaOperadorMasListarNaoEh(t *testing.T) {
	api, fornecedorID, pecaID := apiCotacoes(t)

	rec := api.chamar(http.MethodPost, "/api/v1/cotacoes", corpoCotacaoValido(fornecedorID, pecaID), usuario.PerfilOperador)
	assert.Equal(t, http.StatusForbidden, rec.Code)

	rec = api.chamar(http.MethodGet, "/api/v1/cotacoes", "", usuario.PerfilOperador)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestConverterCotacaoEmPedidoCompra(t *testing.T) {
	api, fornecedorID, pecaID := apiCotacoes(t)
	criada := criarCotacao(t, api, corpoCotacaoValido(fornecedorID, pecaID))
	rec := api.chamar(http.MethodPost, rotaCotacao(criada)+"/enviar", "", usuario.PerfilGestor)
	require.Equal(t, http.StatusOK, rec.Code)
	corpoResposta := `{"data_resposta":"2026-09-01","itens":[{"parte_peca_id":` + formatarID(float64(pecaID)) + `,"preco_unitario":48.00}]}`
	rec = api.chamar(http.MethodPost, rotaCotacao(criada)+"/registrar-resposta", corpoResposta, usuario.PerfilGestor)
	require.Equal(t, http.StatusOK, rec.Code)

	corpoConverter := `{"numero_pc":"PC-2026-001","data_entrega_prevista":"2026-10-15","condicao_pagamento":"30 dias"}`
	rec = api.chamar(http.MethodPost, rotaCotacao(criada)+"/converter-pc", corpoConverter, usuario.PerfilGestor)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	pc := dados(t, rec)
	assert.Equal(t, "Rascunho", pc["status"])
	assert.Equal(t, float64(4800), pc["valor_total"])
	require.NotNil(t, pc["cotacao_id"])
	assert.Equal(t, criada["id"], pc["cotacao_id"])
}

func TestConverterCotacaoForaDeRespondidaResponde409(t *testing.T) {
	api, fornecedorID, pecaID := apiCotacoes(t)
	criada := criarCotacao(t, api, corpoCotacaoValido(fornecedorID, pecaID))

	corpoConverter := `{"numero_pc":"PC-2026-001","data_entrega_prevista":"2026-10-15","condicao_pagamento":"30 dias"}`
	rec := api.chamar(http.MethodPost, rotaCotacao(criada)+"/converter-pc", corpoConverter, usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
}
