package necessidadecompra_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/necessidadecompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func servicoComBanco(t *testing.T) (*necessidadecompra.Servico, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return necessidadecompra.NovoServico(repository.NovoNecessidadeCompraRepositorio(pool)), pool
}

func criarPecaComMinimo(ctx context.Context, t *testing.T, pool *pgxpool.Pool, codigo string, minimo int, fornecedorID *int64) int64 {
	t.Helper()
	servico := peca.NovoServico(repository.NovoPecaRepositorio(pool))
	dados := peca.Dados{
		Codigo: codigo, Descricao: "Peca de teste " + codigo, UnidadeMedida: "UN",
		EstoqueMinimo: minimo, EstoqueMaximo: minimo + 100, LeadTimeCompra: 7,
	}
	if fornecedorID != nil {
		dados.FornecedorPadraoID = fornecedorID
	}
	criada, err := servico.Criar(ctx, dados, "gestor01")
	require.NoError(t, err)
	return criada.ID
}

func criarFornecedorDeTeste(ctx context.Context, t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	servico := fornecedor.NovoServico(repository.NovoFornecedorRepositorio(pool))
	criado, err := servico.Criar(ctx, fornecedor.Dados{
		RazaoSocial: "Fornecedor de Teste LTDA", CNPJ: "11222333000181", LeadTimeMedio: 10,
	}, "gestor01")
	require.NoError(t, err)
	return criado.ID
}

func TestListarTrazPecaAbaixoDoMinimo(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	// peca.Servico.Criar ja abre o saldo zerado -- com minimo 5, ja nasce
	// abaixo do minimo (0 < 5).
	criarPecaComMinimo(ctx, t, pool, "PP-ABAIXO", 5, nil)

	itens, err := servico.Listar(ctx)

	require.NoError(t, err)
	require.Len(t, itens, 1)
	assert.Equal(t, "PP-ABAIXO", itens[0].Codigo)
	assert.Equal(t, 5, itens[0].Necessidade)
	assert.Nil(t, itens[0].FornecedorPadraoID)
}

func TestListarNaoTrazPecaAcimaDoMinimo(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	pecaID := criarPecaComMinimo(ctx, t, pool, "PP-ACIMA", 5, nil)

	estoqueServico := estoque.NovoServico(repository.NovoEstoqueRepositorio(pool))
	_, err := estoqueServico.Ajustar(ctx, estoque.AjusteDados{
		PartePecaID: pecaID, Quantidade: 10, Motivo: "Ajuste",
	}, "gestor01")
	require.NoError(t, err)

	itens, err := servico.Listar(ctx)

	require.NoError(t, err)
	assert.Empty(t, itens)
}

func TestListarNaoTrazPecaInativa(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	pecaID := criarPecaComMinimo(ctx, t, pool, "PP-INATIVA", 5, nil)

	pecaServico := peca.NovoServico(repository.NovoPecaRepositorio(pool))
	require.NoError(t, pecaServico.Excluir(ctx, pecaID, "gestor01"))

	itens, err := servico.Listar(ctx)

	require.NoError(t, err)
	assert.Empty(t, itens)
}

func TestListarNaoTrazFornecedorPadraoInativo(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	criarPecaComMinimo(ctx, t, pool, "PP-FORN-INATIVO", 5, &fornecedorID)

	fornecedorServico := fornecedor.NovoServico(repository.NovoFornecedorRepositorio(pool))
	require.NoError(t, fornecedorServico.Excluir(ctx, fornecedorID, "gestor01"))

	itens, err := servico.Listar(ctx)

	require.NoError(t, err)
	require.Len(t, itens, 1)
	assert.Nil(t, itens[0].FornecedorPadraoID, "fornecedor inativo nao deve aparecer -- a peca cai no grupo sem fornecedor padrao")
	assert.Nil(t, itens[0].FornecedorPadraoNome)
}

func TestListarTrazFornecedorPadraoQuandoExiste(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	criarPecaComMinimo(ctx, t, pool, "PP-COM-FORN", 5, &fornecedorID)

	itens, err := servico.Listar(ctx)

	require.NoError(t, err)
	require.Len(t, itens, 1)
	require.NotNil(t, itens[0].FornecedorPadraoID)
	assert.Equal(t, fornecedorID, *itens[0].FornecedorPadraoID)
	require.NotNil(t, itens[0].FornecedorPadraoNome)
	assert.Equal(t, "Fornecedor de Teste LTDA", *itens[0].FornecedorPadraoNome)
}
