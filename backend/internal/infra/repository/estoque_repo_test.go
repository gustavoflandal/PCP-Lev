package repository_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

func criarPeca(t *testing.T, pool *pgxpool.Pool, codigo string, estoqueMinimo int) *peca.PartePeca {
	t.Helper()
	repo := repository.NovoPecaRepositorio(pool)
	p := &peca.PartePeca{
		Codigo: codigo, Descricao: "Peca de teste do estoque", UnidadeMedida: "und",
		EstoqueMinimo: estoqueMinimo, EstoqueMaximo: estoqueMinimo + 100, LeadTimeCompra: 7, Ativo: true,
	}
	require.NoError(t, repo.Criar(context.Background(), p, "teste"))
	return p
}

func TestAplicarMovimentoSomaEEntraOK(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	p := criarPeca(t, pool, "EST-001", 5)
	repo := repository.NovoEstoqueRepositorio(pool)

	saldo, err := repo.AplicarMovimento(context.Background(), p.ID, 10, estoque.TipoEntrada, estoque.MotivoCompra, nil, "", "teste")

	require.NoError(t, err)
	require.Equal(t, 10, saldo.QuantidadeAtual)
	require.Equal(t, estoque.StatusOK, saldo.Status)
}

func TestAplicarMovimentoNegativoQueDeixariaSaldoNegativoFalha(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	p := criarPeca(t, pool, "EST-002", 5)
	repo := repository.NovoEstoqueRepositorio(pool)

	_, err := repo.AplicarMovimento(context.Background(), p.ID, -1, estoque.TipoAjuste, estoque.MotivoAjuste, nil, "estorno", "teste")

	require.ErrorIs(t, err, estoque.ErrSaldoInsuficienteParaAjuste)
}

func TestAplicarMovimentoRecalculaStatusCritico(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	p := criarPeca(t, pool, "EST-003", 5)
	repo := repository.NovoEstoqueRepositorio(pool)

	_, err := repo.AplicarMovimento(context.Background(), p.ID, 10, estoque.TipoEntrada, estoque.MotivoCompra, nil, "", "teste")
	require.NoError(t, err)

	saldo, err := repo.AplicarMovimento(context.Background(), p.ID, -8, estoque.TipoAjuste, estoque.MotivoAjuste, nil, "saida", "teste")
	require.NoError(t, err)
	require.Equal(t, 2, saldo.QuantidadeAtual)
	require.Equal(t, estoque.StatusCritico, saldo.Status)
}

func TestAplicarMovimentoComPartePecaInexistenteFalha(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoEstoqueRepositorio(pool)

	_, err := repo.AplicarMovimento(context.Background(), 999999, 10, estoque.TipoEntrada, estoque.MotivoCompra, nil, "", "teste")

	require.ErrorIs(t, err, estoque.ErrPartePecaInexistente)
}

func TestAplicarMovimentoGravaReferenciaEMotivo(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	p := criarPeca(t, pool, "EST-004", 5)
	repo := repository.NovoEstoqueRepositorio(pool)
	ref := "PC-2026-001"

	_, err := repo.AplicarMovimento(context.Background(), p.ID, 20, estoque.TipoEntrada, estoque.MotivoCompra, &ref, "", "teste")
	require.NoError(t, err)

	movs, total, err := repo.ListarMovimentacoes(context.Background(), consulta.Parametros{Pagina: 1, Limite: 10, OrdenarPor: "data_hora", Ordem: consulta.Decrescente})
	require.NoError(t, err)
	require.Equal(t, 1, total)
	require.Equal(t, "PC-2026-001", *movs[0].ReferenciaNumero)
	require.Equal(t, estoque.MotivoCompra, movs[0].Motivo)
}

func TestListarSaldoFiltraPorStatus(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	criarPeca(t, pool, "EST-005", 100) // nasce critico (saldo 0 <= minimo 100)
	repo := repository.NovoEstoqueRepositorio(pool)
	statusCritico := estoque.StatusCritico

	itens, total, err := repo.ListarSaldo(context.Background(), consulta.Parametros{
		Pagina: 1, Limite: 50, OrdenarPor: "codigo", Ordem: consulta.Crescente, FiltroStatus: &statusCritico,
	})

	require.NoError(t, err)
	require.GreaterOrEqual(t, total, 1)
	for _, item := range itens {
		require.Equal(t, estoque.StatusCritico, item.Status)
	}
}

func TestListarCriticosNaoPagina(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	criarPeca(t, pool, "EST-006", 100)
	repo := repository.NovoEstoqueRepositorio(pool)

	itens, err := repo.ListarCriticos(context.Background())

	require.NoError(t, err)
	require.NotEmpty(t, itens)
}

func TestBuscarSaldoDeParteInexistenteFalha(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoEstoqueRepositorio(pool)

	_, err := repo.BuscarSaldo(context.Background(), 999999)

	require.ErrorIs(t, err, estoque.ErrNaoEncontrado)
}
