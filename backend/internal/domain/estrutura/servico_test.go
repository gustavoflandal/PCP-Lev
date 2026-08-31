package estrutura_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

func servicoComBanco(t *testing.T) (*estrutura.Servico, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return estrutura.NovoServico(repository.NovoEstruturaRepositorio(pool)), pool
}

func criarProdutoDeTeste(ctx context.Context, t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	servico := produto.NovoServico(repository.NovoProdutoRepositorio(pool))
	preco, _ := dinheiro.DeString("5000.00")
	criado, err := servico.Criar(ctx, produto.Dados{
		Codigo: "VMS-01", Descricao: "Painel de velocidade modelo 01", UnidadeMedida: "UN",
		PrecoVenda: preco, LeadTimeProducao: 15,
	}, "gestor01")
	require.NoError(t, err)
	return criado.ID
}

func criarPecaDeTeste(ctx context.Context, t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	servico := peca.NovoServico(repository.NovoPecaRepositorio(pool))
	criada, err := servico.Criar(ctx, peca.Dados{
		Codigo: "RES-10K", Descricao: "Resistor de 10 kOhm", UnidadeMedida: "UN",
		EstoqueMinimo: 0, EstoqueMaximo: 100, LeadTimeCompra: 7,
	}, "gestor01")
	require.NoError(t, err)
	return criada.ID
}

func dadosDeTeste(pecaID int64, dataInicio string) estrutura.Dados {
	inicio, _ := tempo.DeString(dataInicio)
	return estrutura.Dados{
		DataVigenciaInicio: inicio,
		Itens:              []estrutura.ItemDados{{PartePecaID: pecaID, Quantidade: 4}},
	}
}

func TestCriarPrimeiraVersao(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	dados := dadosDeTeste(pecaID, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID

	criada, err := servico.Criar(ctx, dados, "gestor01")

	require.NoError(t, err)
	require.Equal(t, 1, criada.Versao)
	require.True(t, criada.Ativo)
}

func TestCriarSegundaDiretoFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	dados := dadosDeTeste(pecaID, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID
	_, err := servico.Criar(ctx, dados, "gestor01")
	require.NoError(t, err)

	_, err = servico.Criar(ctx, dados, "gestor01")

	require.ErrorIs(t, err, estrutura.ErrJaPossuiEstruturaAtiva)
}

func TestVersionarTrocaAAtiva(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	dados := dadosDeTeste(pecaID, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID
	primeira, err := servico.Criar(ctx, dados, "gestor01")
	require.NoError(t, err)

	segunda, err := servico.Versionar(ctx, primeira.ID, dadosDeTeste(pecaID, "2026-10-01"), "gestor01")

	require.NoError(t, err)
	require.Equal(t, 2, segunda.Versao)
	require.True(t, segunda.Ativo)

	antiga, err := servico.BuscarPorID(ctx, primeira.ID)
	require.NoError(t, err)
	require.False(t, antiga.Ativo)
	require.False(t, antiga.DataVigenciaFim.IsZero())
}

func TestVersionarUmaJaSuperadaFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	dados := dadosDeTeste(pecaID, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID
	primeira, err := servico.Criar(ctx, dados, "gestor01")
	require.NoError(t, err)
	_, err = servico.Versionar(ctx, primeira.ID, dadosDeTeste(pecaID, "2026-10-01"), "gestor01")
	require.NoError(t, err)

	_, err = servico.Versionar(ctx, primeira.ID, dadosDeTeste(pecaID, "2026-11-01"), "gestor01")

	require.ErrorIs(t, err, estrutura.ErrStatusInvalidoParaAcao)
}

func TestVersionarComVigenciaAnteriorFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	dados := dadosDeTeste(pecaID, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID
	primeira, err := servico.Criar(ctx, dados, "gestor01")
	require.NoError(t, err)

	_, err = servico.Versionar(ctx, primeira.ID, dadosDeTeste(pecaID, "2026-08-01"), "gestor01")

	require.ErrorIs(t, err, estrutura.ErrVigenciaAnteriorAAtual)
}

func TestPecaInexistenteFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)

	dados := dadosDeTeste(999999, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID

	_, err := servico.Criar(ctx, dados, "gestor01")

	require.ErrorIs(t, err, estrutura.ErrPartePecaInexistente)
}

func TestListarPorProdutoTrazHistoricoMaisRecentePrimeiro(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	produtoID := criarProdutoDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	dados := dadosDeTeste(pecaID, "2026-09-01")
	dados.ProdutoAcabadoID = produtoID
	primeira, err := servico.Criar(ctx, dados, "gestor01")
	require.NoError(t, err)
	_, err = servico.Versionar(ctx, primeira.ID, dadosDeTeste(pecaID, "2026-10-01"), "gestor01")
	require.NoError(t, err)

	historico, err := servico.ListarPorProduto(ctx, produtoID)

	require.NoError(t, err)
	require.Len(t, historico, 2)
	require.Equal(t, 2, historico[0].Versao)
	require.Equal(t, 1, historico[1].Versao)
}
