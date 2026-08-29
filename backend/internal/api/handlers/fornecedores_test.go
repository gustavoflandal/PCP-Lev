package handlers_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const corpoFornecedorValido = `{
	"razao_social": "Componentes Eletronicos LTDA",
	"cnpj": "11.222.333/0001-81",
	"contato_nome": "Joao Silva",
	"contato_email": "Joao@Componentes.com.BR",
	"contato_telefone": "(11) 99999-9999",
	"endereco": "Rua das Pecas, 100, Sao Paulo - SP",
	"lead_time_medio": 7,
	"condicao_pagamento": "30 dias"
}`

func apiFornecedores(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	handler := handlers.NovoFornecedorHandler(
		fornecedor.NovoServico(repository.NovoFornecedorRepositorio(pool)),
	)
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	return api
}

func criarFornecedor(t *testing.T, api *apiProtegida, corpo string) map[string]any {
	t.Helper()
	rec := api.chamar(http.MethodPost, "/api/v1/fornecedores", corpo, usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return dados(t, rec)
}

func rotaFornecedor(criado map[string]any) string {
	return "/api/v1/fornecedores/" + formatarID(criado["id"])
}

func TestCriarFornecedorResponde201ComCNPJNormalizado(t *testing.T) {
	api := apiFornecedores(t)

	rec := api.chamar(http.MethodPost, "/api/v1/fornecedores", corpoFornecedorValido, usuario.PerfilGestor)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	criado := dados(t, rec)
	assert.Equal(t, "11222333000181", criado["cnpj"], "o CNPJ e guardado so com digitos")
	assert.Equal(t, "11999999999", criado["contato_telefone"])
	assert.Equal(t, "joao@componentes.com.br", criado["contato_email"])
	assert.Equal(t, true, criado["ativo"])
}

func TestCriarFornecedorComCNPJInvalidoResponde400(t *testing.T) {
	api := apiFornecedores(t)

	rec := api.chamar(http.MethodPost, "/api/v1/fornecedores",
		`{"razao_social":"Componentes Eletronicos LTDA","cnpj":"11222333000182","lead_time_medio":7}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, "ERRO_VALIDACAO", codigoErro(t, rec))
	assert.Contains(t, mensagemErro(t, rec), "CNPJ")
}

func TestCriarFornecedorSemRazaoSocialResponde400ComOCampo(t *testing.T) {
	api := apiFornecedores(t)

	rec := api.chamar(http.MethodPost, "/api/v1/fornecedores",
		`{"cnpj":"11222333000181","lead_time_medio":7}`, usuario.PerfilGestor)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	detalhes := corpoJSON(t, rec)["erro"].(map[string]any)["detalhes"].([]any)
	assert.Equal(t, "razao_social", detalhes[0].(map[string]any)["campo"])
}

func TestCriarFornecedorComEmailInvalidoResponde400(t *testing.T) {
	api := apiFornecedores(t)

	rec := api.chamar(http.MethodPost, "/api/v1/fornecedores",
		`{"razao_social":"Componentes Eletronicos LTDA","cnpj":"11222333000181","contato_email":"joao-arroba","lead_time_medio":7}`,
		usuario.PerfilGestor)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestCriarFornecedorSemContatoEhAceito(t *testing.T) {
	api := apiFornecedores(t)

	criado := criarFornecedor(t, api,
		`{"razao_social":"Componentes Eletronicos LTDA","cnpj":"11222333000181","lead_time_medio":7}`)

	assert.Empty(t, criado["contato_email"])
	assert.Empty(t, criado["contato_telefone"])
}

func TestCriarFornecedorComCNPJRepetidoResponde409(t *testing.T) {
	api := apiFornecedores(t)
	criarFornecedor(t, api, corpoFornecedorValido)

	rec := api.chamar(http.MethodPost, "/api/v1/fornecedores", corpoFornecedorValido, usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
	assert.Contains(t, mensagemErro(t, rec), "CNPJ")
}

func TestCriarFornecedorNegadoParaOperador(t *testing.T) {
	api := apiFornecedores(t)

	rec := api.chamar(http.MethodPost, "/api/v1/fornecedores", corpoFornecedorValido, usuario.PerfilOperador)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestListarFornecedoresComPaginacao(t *testing.T) {
	api := apiFornecedores(t)
	criarFornecedor(t, api, corpoFornecedorValido)
	criarFornecedor(t, api,
		`{"razao_social":"Radares do Sul LTDA","cnpj":"45723174000110","lead_time_medio":15}`)

	rec := api.chamar(http.MethodGet, "/api/v1/fornecedores", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Len(t, lista(t, rec), 2)
	assert.Equal(t, float64(2), corpoJSON(t, rec)["paginacao"].(map[string]any)["total"])
}

func TestObterFornecedorPorID(t *testing.T) {
	api := apiFornecedores(t)
	criado := criarFornecedor(t, api, corpoFornecedorValido)

	rec := api.chamar(http.MethodGet, rotaFornecedor(criado), "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "Componentes Eletronicos LTDA", dados(t, rec)["razao_social"])
}

func TestObterFornecedorInexistenteResponde404(t *testing.T) {
	api := apiFornecedores(t)

	rec := api.chamar(http.MethodGet, "/api/v1/fornecedores/999999", "", usuario.PerfilGestor)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestAtualizarFornecedor(t *testing.T) {
	api := apiFornecedores(t)
	criado := criarFornecedor(t, api, corpoFornecedorValido)

	rec := api.chamar(http.MethodPut, rotaFornecedor(criado),
		`{"razao_social":"Componentes Eletronicos LTDA","cnpj":"11222333000181","contato_nome":"Maria Souza","lead_time_medio":21,"condicao_pagamento":"45 dias"}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusOK, rec.Code)
	atualizado := dados(t, rec)
	assert.Equal(t, "Maria Souza", atualizado["contato_nome"])
	assert.Equal(t, float64(21), atualizado["lead_time_medio"])
}

func TestExcluirFornecedorResponde204(t *testing.T) {
	api := apiFornecedores(t)
	criado := criarFornecedor(t, api, corpoFornecedorValido)

	rec := api.chamar(http.MethodDelete, rotaFornecedor(criado), "", usuario.PerfilGestor)

	require.Equal(t, http.StatusNoContent, rec.Code)
}

func TestExcluirFornecedorComPedidoPendenteResponde409(t *testing.T) {
	api := apiFornecedores(t)
	criado := criarFornecedor(t, api, corpoFornecedorValido)
	id := int64(criado["id"].(float64))

	_, err := api.pool.Exec(context.Background(), `
		INSERT INTO pedidos_compra
			(numero_pc, fornecedor_id, data_pedido, data_entrega_prevista, valor_total, status)
		VALUES ('PC-2026-001', $1, CURRENT_DATE, CURRENT_DATE + 10, 1500.00, 'Emitido')`, id)
	require.NoError(t, err)

	rec := api.chamar(http.MethodDelete, rotaFornecedor(criado), "", usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
	assert.Contains(t, mensagemErro(t, rec), "pedidos de compra")
}
