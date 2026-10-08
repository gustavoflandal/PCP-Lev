package handlers_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// apiEstoque monta o EstoqueHandler sobre um banco migrado e devolve tambem
// o id de uma peca de apoio ja cadastrada (raw SQL, mesmo padrao de
// criarFornecedorEPecaDeApoio em pedidos_compra_test.go — o handler de Peca
// nao precisa estar registrado so para ter uma FK valida).
func apiEstoque(t *testing.T) (*apiProtegida, int64) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	handler := handlers.NovoEstoqueHandler(estoque.NovoServico(repository.NovoEstoqueRepositorio(pool)))
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())

	pecaID := criarPecaDeApoio(t, api, "HND-001", 5)
	return api, pecaID
}

// criarPecaDeApoio cadastra a peca direto no banco (incluindo o saldo
// zerado, ja que a migration/peca_repo.go real so faz isso via
// PecaRepositorio.Criar) e devolve o id.
func criarPecaDeApoio(t *testing.T, api *apiProtegida, codigo string, estoqueMinimo int) int64 {
	t.Helper()
	ctx := context.Background()

	var pecaID int64
	require.NoError(t, api.pool.QueryRow(ctx,
		`INSERT INTO partes_pecas (codigo, descricao, unidade_medida, estoque_minimo, estoque_maximo, lead_time_compra)
		 VALUES ($1, $2, 'UN', $3, $3 + 100, 7) RETURNING id`,
		codigo, "Peca de teste do handler de estoque", estoqueMinimo).Scan(&pecaID))

	// Saldo nasce em 0 (mesma regra de peca_repo.go.Criar) — com
	// estoque_minimo sempre >= 0, isso e sempre CRITICO de saida (RN5,
	// fronteira inclusiva).
	_, err := api.pool.Exec(ctx,
		`INSERT INTO saldo_estoque (parte_peca_id, quantidade_atual, quantidade_reservada, status) VALUES ($1, 0, 0, 'CRITICO')`,
		pecaID)
	require.NoError(t, err)
	return pecaID
}

func TestListarEstoqueResponde200(t *testing.T) {
	api, _ := apiEstoque(t)

	rec := api.chamar(http.MethodGet, "/api/v1/estoque", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
}

func TestObterEstoqueDeParteInexistenteResponde404(t *testing.T) {
	api, _ := apiEstoque(t)

	rec := api.chamar(http.MethodGet, "/api/v1/estoque/999999", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestCriticosNaoPagina(t *testing.T) {
	api, _ := apiEstoque(t)

	rec := api.chamar(http.MethodGet, "/api/v1/estoque/criticos", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
	itens := lista(t, rec)
	require.NotEmpty(t, itens) // a peca de apoio nasce critica (minimo 5, saldo 0)
}

func TestAjustarComoGestorResponde201(t *testing.T) {
	api, pecaID := apiEstoque(t)

	rec := api.chamar(http.MethodPost, "/api/v1/estoque/ajuste",
		`{"parte_peca_id":`+formatarID(float64(pecaID))+`,"quantidade":10,"motivo":"Inventario"}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, float64(10), dados(t, rec)["quantidade_atual"])
}

func TestAjustarComoOperadorResponde403(t *testing.T) {
	api, pecaID := apiEstoque(t)

	rec := api.chamar(http.MethodPost, "/api/v1/estoque/ajuste",
		`{"parte_peca_id":`+formatarID(float64(pecaID))+`,"quantidade":10,"motivo":"Inventario"}`,
		usuario.PerfilOperador)

	require.Equal(t, http.StatusForbidden, rec.Code)
}

func TestAjustarQueDeixariaSaldoNegativoResponde409(t *testing.T) {
	api, pecaID := apiEstoque(t)

	rec := api.chamar(http.MethodPost, "/api/v1/estoque/ajuste",
		`{"parte_peca_id":`+formatarID(float64(pecaID))+`,"quantidade":-1,"motivo":"Perda"}`,
		usuario.PerfilGestor)

	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestListarMovimentacoesResponde200(t *testing.T) {
	api, _ := apiEstoque(t)

	rec := api.chamar(http.MethodGet, "/api/v1/movimentacoes", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusOK, rec.Code)
}

func TestObterMovimentacaoInexistenteResponde404(t *testing.T) {
	api, _ := apiEstoque(t)

	rec := api.chamar(http.MethodGet, "/api/v1/movimentacoes/999999", "", usuario.PerfilOperador)

	require.Equal(t, http.StatusNotFound, rec.Code)
}
