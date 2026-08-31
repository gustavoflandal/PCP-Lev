package handlers_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// apiEstrutura monta o EstruturaHandler sobre um banco migrado e devolve
// tambem o id de um produto e de uma peca de apoio, cadastrados direto no
// banco (mesmo padrao de criarFornecedorEPecaDeApoio em pedidos_compra_test.go).
func apiEstrutura(t *testing.T) (*apiProtegida, int64, int64) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	handler := handlers.NovoEstruturaHandler(estrutura.NovoServico(repository.NovoEstruturaRepositorio(pool)))
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())

	produtoID, pecaID := criarProdutoEPecaDeApoio(t, api)
	return api, produtoID, pecaID
}

func criarProdutoEPecaDeApoio(t *testing.T, api *apiProtegida) (int64, int64) {
	t.Helper()
	ctx := context.Background()

	var produtoID int64
	require.NoError(t, api.pool.QueryRow(ctx,
		`INSERT INTO produtos_acabados (codigo, descricao, unidade_medida, preco_venda, lead_time_producao)
		 VALUES ($1, $2, 'UN', 5000, 15) RETURNING id`,
		"VMS-01", "Painel de velocidade modelo 01").Scan(&produtoID))

	var pecaID int64
	require.NoError(t, api.pool.QueryRow(ctx,
		`INSERT INTO partes_pecas (codigo, descricao, unidade_medida, estoque_minimo, estoque_maximo, lead_time_compra)
		 VALUES ($1, $2, 'UN', 0, 100, 7) RETURNING id`,
		"RES-10K", "Resistor de 10 kOhm").Scan(&pecaID))
	_, err := api.pool.Exec(ctx,
		`INSERT INTO saldo_estoque (parte_peca_id, quantidade_atual, quantidade_reservada, status) VALUES ($1, 0, 0, 'CRITICO')`,
		pecaID)
	require.NoError(t, err)

	return produtoID, pecaID
}

func corpoEstruturaValido(produtoID, pecaID int64, dataInicio string) string {
	return `{
		"produto_acabado_id": ` + formatarID(float64(produtoID)) + `,
		"data_vigencia_inicio": "` + dataInicio + `",
		"itens": [{"parte_peca_id": ` + formatarID(float64(pecaID)) + `, "quantidade": 4}]
	}`
}

func TestCriarEstruturaResponde201(t *testing.T) {
	api, produtoID, pecaID := apiEstrutura(t)

	rec := api.chamar(http.MethodPost, "/api/v1/boms", corpoEstruturaValido(produtoID, pecaID, "2026-09-01"), usuario.PerfilGestor)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, float64(1), dados(t, rec)["versao"])
}

func TestCriarEstruturaComoOperadorResponde403(t *testing.T) {
	api, produtoID, pecaID := apiEstrutura(t)

	rec := api.chamar(http.MethodPost, "/api/v1/boms", corpoEstruturaValido(produtoID, pecaID, "2026-09-01"), usuario.PerfilOperador)

	require.Equal(t, http.StatusForbidden, rec.Code)
}

func TestCriarSegundaDiretoResponde409(t *testing.T) {
	api, produtoID, pecaID := apiEstrutura(t)
	rec := api.chamar(http.MethodPost, "/api/v1/boms", corpoEstruturaValido(produtoID, pecaID, "2026-09-01"), usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code)

	rec = api.chamar(http.MethodPost, "/api/v1/boms", corpoEstruturaValido(produtoID, pecaID, "2026-09-01"), usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestObterEstruturaInexistenteResponde404(t *testing.T) {
	api, _, _ := apiEstrutura(t)

	rec := api.chamar(http.MethodGet, "/api/v1/boms/999999", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestVersionarResponde201EInativaAAnterior(t *testing.T) {
	api, produtoID, pecaID := apiEstrutura(t)
	criarRec := api.chamar(http.MethodPost, "/api/v1/boms", corpoEstruturaValido(produtoID, pecaID, "2026-09-01"), usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, criarRec.Code)
	idAtual := int64(dados(t, criarRec)["id"].(float64))

	corpoNovo := `{"data_vigencia_inicio": "2026-10-01", "itens": [{"parte_peca_id": ` +
		formatarID(float64(pecaID)) + `, "quantidade": 6}]}`
	rec := api.chamar(http.MethodPost, fmt.Sprintf("/api/v1/boms/%d/versionar", idAtual), corpoNovo, usuario.PerfilGestor)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, float64(2), dados(t, rec)["versao"])
}

func TestListarPorProdutoResponde200(t *testing.T) {
	api, produtoID, pecaID := apiEstrutura(t)
	criarRec := api.chamar(http.MethodPost, "/api/v1/boms", corpoEstruturaValido(produtoID, pecaID, "2026-09-01"), usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, criarRec.Code)

	rec := api.chamar(http.MethodGet, fmt.Sprintf("/api/v1/produtos-acabados/%d/boms", produtoID), "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	itens := lista(t, rec)
	require.Len(t, itens, 1)
}
