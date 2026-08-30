package handlers_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func apiPedidosCompra(t *testing.T) (*apiProtegida, int64, int64) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	estoqueServico := estoque.NovoServico(repository.NovoEstoqueRepositorio(pool))
	handler := handlers.NovoPedidoCompraHandler(
		pedidocompra.NovoServico(repository.NovoPedidoCompraRepositorio(pool), estoqueServico),
	)
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())

	fornecedorID, pecaID := criarFornecedorEPecaDeApoio(t, api)
	return api, fornecedorID, pecaID
}

// criarFornecedorEPecaDeApoio cadastra direto no banco: os pedidos de compra
// dependem de fornecedor_id e parte_peca_id validos (FK), mas os handlers
// desses dois cadastros nao precisam estar registrados neste sub-teste.
func criarFornecedorEPecaDeApoio(t *testing.T, api *apiProtegida) (int64, int64) {
	t.Helper()
	ctx := context.Background()

	var fornecedorID int64
	require.NoError(t, api.pool.QueryRow(ctx,
		`INSERT INTO fornecedores (razao_social, cnpj, lead_time_medio) VALUES ($1, $2, $3) RETURNING id`,
		"Fornecedor Teste", "11222333000181", 7).Scan(&fornecedorID))

	var pecaID int64
	require.NoError(t, api.pool.QueryRow(ctx,
		`INSERT INTO partes_pecas (codigo, descricao, unidade_medida, estoque_minimo, estoque_maximo, lead_time_compra)
		 VALUES ($1, $2, 'UN', 0, 100, 7) RETURNING id`,
		"RES-10K", "Resistor de 10 kOhm").Scan(&pecaID))

	return fornecedorID, pecaID
}

func corpoPedidoCompraValido(fornecedorID, pecaID int64) string {
	return `{
		"numero_pc": "PC-2026-001",
		"fornecedor_id": ` + formatarID(float64(fornecedorID)) + `,
		"data_entrega_prevista": "2026-12-25",
		"condicao_pagamento": "30 dias",
		"itens": [{"parte_peca_id": ` + formatarID(float64(pecaID)) + `, "quantidade_solicitada": 10, "preco_unitario": 12.50}]
	}`
}

func TestCriarPedidoCompraResponde201(t *testing.T) {
	api, fornecedorID, pecaID := apiPedidosCompra(t)

	rec := api.chamar(http.MethodPost, "/api/v1/pedidos-compra",
		corpoPedidoCompraValido(fornecedorID, pecaID), usuario.PerfilGestor)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	criado := dados(t, rec)
	assert.Equal(t, "Rascunho", criado["status"])
	assert.Equal(t, float64(125), criado["valor_total"])
}

func TestCriarPedidoCompraSemItensResponde400(t *testing.T) {
	api, fornecedorID, _ := apiPedidosCompra(t)

	rec := api.chamar(http.MethodPost, "/api/v1/pedidos-compra",
		`{"numero_pc":"PC-2026-001","fornecedor_id":`+formatarID(float64(fornecedorID))+`,"data_entrega_prevista":"2026-12-25","itens":[]}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestCriarPedidoCompraComDataInvalidaResponde400(t *testing.T) {
	api, fornecedorID, pecaID := apiPedidosCompra(t)

	rec := api.chamar(http.MethodPost, "/api/v1/pedidos-compra",
		`{"numero_pc":"PC-2026-001","fornecedor_id":`+formatarID(float64(fornecedorID))+
			`,"data_entrega_prevista":"25/12/2026","itens":[{"parte_peca_id":`+formatarID(float64(pecaID))+`,"quantidade_solicitada":1,"preco_unitario":1}]}`,
		usuario.PerfilGestor)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestCriarPedidoCompraComNumeroRepetidoResponde409(t *testing.T) {
	api, fornecedorID, pecaID := apiPedidosCompra(t)
	rec := api.chamar(http.MethodPost, "/api/v1/pedidos-compra",
		corpoPedidoCompraValido(fornecedorID, pecaID), usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code)

	rec = api.chamar(http.MethodPost, "/api/v1/pedidos-compra",
		corpoPedidoCompraValido(fornecedorID, pecaID), usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestCriarPedidoCompraNegadoParaOperador(t *testing.T) {
	api, fornecedorID, pecaID := apiPedidosCompra(t)

	rec := api.chamar(http.MethodPost, "/api/v1/pedidos-compra",
		corpoPedidoCompraValido(fornecedorID, pecaID), usuario.PerfilOperador)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestListarPedidosCompraComFiltroDeStatus(t *testing.T) {
	api, fornecedorID, pecaID := apiPedidosCompra(t)
	criado := criarPedidoCompra(t, api, corpoPedidoCompraValido(fornecedorID, pecaID))
	rec := api.chamar(http.MethodPost, rotaPedidoCompra(criado)+"/emitir", "", usuario.PerfilGestor)
	require.Equal(t, http.StatusOK, rec.Code)

	rec = api.chamar(http.MethodGet, "/api/v1/pedidos-compra?status=Aguardando+Entrega", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Len(t, lista(t, rec), 1)
}

func TestObterPedidoCompraInexistenteResponde404(t *testing.T) {
	api, _, _ := apiPedidosCompra(t)

	rec := api.chamar(http.MethodGet, "/api/v1/pedidos-compra/999999", "", usuario.PerfilGestor)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestEmitirPedidoCompraMudaStatus(t *testing.T) {
	api, fornecedorID, pecaID := apiPedidosCompra(t)
	criado := criarPedidoCompra(t, api, corpoPedidoCompraValido(fornecedorID, pecaID))

	rec := api.chamar(http.MethodPost, rotaPedidoCompra(criado)+"/emitir", "", usuario.PerfilGestor)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "Aguardando Entrega", dados(t, rec)["status"])
}

func TestEmitirPedidoCompraForaDeRascunhoResponde409(t *testing.T) {
	api, fornecedorID, pecaID := apiPedidosCompra(t)
	criado := criarPedidoCompra(t, api, corpoPedidoCompraValido(fornecedorID, pecaID))
	rec := api.chamar(http.MethodPost, rotaPedidoCompra(criado)+"/emitir", "", usuario.PerfilGestor)
	require.Equal(t, http.StatusOK, rec.Code)

	rec = api.chamar(http.MethodPost, rotaPedidoCompra(criado)+"/emitir", "", usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestCancelarPedidoCompraMudaStatus(t *testing.T) {
	api, fornecedorID, pecaID := apiPedidosCompra(t)
	criado := criarPedidoCompra(t, api, corpoPedidoCompraValido(fornecedorID, pecaID))

	rec := api.chamar(http.MethodPost, rotaPedidoCompra(criado)+"/cancelar", "", usuario.PerfilGestor)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "Cancelado", dados(t, rec)["status"])
}

func TestPedidosCompraEmAtrasoTrazSoOsVencidos(t *testing.T) {
	api, fornecedorID, pecaID := apiPedidosCompra(t)
	criado := criarPedidoCompra(t, api, corpoPedidoCompraValido(fornecedorID, pecaID))
	_, err := api.pool.Exec(context.Background(),
		`UPDATE pedidos_compra SET data_pedido = CURRENT_DATE - 100, data_entrega_prevista = CURRENT_DATE - 1 WHERE id = $1`,
		int64(criado["id"].(float64)))
	require.NoError(t, err)

	rec := api.chamar(http.MethodGet, "/api/v1/pedidos-compra/em-atraso", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Len(t, lista(t, rec), 1)
}

func criarPedidoCompra(t *testing.T, api *apiProtegida, corpo string) map[string]any {
	t.Helper()
	rec := api.chamar(http.MethodPost, "/api/v1/pedidos-compra", corpo, usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return dados(t, rec)
}

func rotaPedidoCompra(criado map[string]any) string {
	return "/api/v1/pedidos-compra/" + formatarID(criado["id"])
}
