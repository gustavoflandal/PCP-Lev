package produto_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func servicoComBanco(t *testing.T) (*produto.Servico, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return produto.NovoServico(repository.NovoProdutoRepositorio(pool)), pool
}

func params(t *testing.T) consulta.Parametros {
	t.Helper()
	p, err := consulta.Analisar(nil, produto.ColunasOrdenaveis, "codigo")
	require.NoError(t, err)
	return p
}

func TestCriarNormalizaOCodigoAntesDeGravar(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	dados := dadosValidos()
	dados.Codigo = "  vms-01  "

	criado, err := servico.Criar(ctx, dados, "gestor01")

	require.NoError(t, err)
	assert.Equal(t, "VMS-01", criado.Codigo)
}

func TestCriarRecusaDadosInvalidos(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	dados := dadosValidos()
	dados.Descricao = "VMS"

	_, err := servico.Criar(ctx, dados, "gestor01")

	require.ErrorIs(t, err, produto.ErrDescricaoCurta)
}

func TestCriarRecusaCodigoJaCadastrado(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	_, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	_, err = servico.Criar(ctx, dadosValidos(), "gestor01")

	require.ErrorIs(t, err, produto.ErrCodigoDuplicado)
}

func TestCriarNasceAtivoQuandoNaoInformado(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	criado, err := servico.Criar(ctx, dadosValidos(), "gestor01")

	require.NoError(t, err)
	assert.True(t, criado.Ativo)
}

func TestAtualizarAlteraOsCamposInformados(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	criado, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	dados := dadosValidos()
	dados.PrecoVenda = dinheiro.DeCentavos(620050)

	atualizado, err := servico.Atualizar(ctx, criado.ID, dados, "gestor02")

	require.NoError(t, err)
	assert.Equal(t, "6200.50", atualizado.PrecoVenda.String())
}

func TestAtualizarPreservaASituacaoQuandoAtivoNaoEInformado(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	criado, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)
	require.NoError(t, servico.Excluir(ctx, criado.ID, "gestor01"))

	atualizado, err := servico.Atualizar(ctx, criado.ID, dadosValidos(), "gestor02")

	require.NoError(t, err)
	assert.False(t, atualizado.Ativo, "editar dados nao deve reativar o produto")
}

func TestAtualizarReativaQuandoAtivoEInformado(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	criado, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)
	require.NoError(t, servico.Excluir(ctx, criado.ID, "gestor01"))

	dados := dadosValidos()
	sim := true
	dados.Ativo = &sim

	atualizado, err := servico.Atualizar(ctx, criado.ID, dados, "gestor02")

	require.NoError(t, err)
	assert.True(t, atualizado.Ativo)
}

func TestAtualizarProdutoInexistente(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	_, err := servico.Atualizar(ctx, 999999, dadosValidos(), "gestor01")

	require.ErrorIs(t, err, produto.ErrNaoEncontrado)
}

func TestExcluirDesativaOProdutoSemVendas(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	criado, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	require.NoError(t, servico.Excluir(ctx, criado.ID, "gestor01"))

	depois, err := servico.BuscarPorID(ctx, criado.ID)
	require.NoError(t, err)
	assert.False(t, depois.Ativo)
}

func TestExcluirBloqueiaProdutoComHistoricoDeVendas(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	criado, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	_, err = pool.Exec(ctx, `
		INSERT INTO pedidos_venda (numero_pedido, cliente_nome, data_pedido, data_entrega_prometida, valor_total)
		VALUES ('PV-2026-001', 'Prefeitura', CURRENT_DATE, CURRENT_DATE + 30, 5000.00)`)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `
		INSERT INTO itens_pedido_venda (pedido_venda_id, produto_acabado_id, quantidade, preco_unitario, total)
		SELECT id, $1, 1, 5000.00, 5000.00 FROM pedidos_venda WHERE numero_pedido = 'PV-2026-001'`, criado.ID)
	require.NoError(t, err)

	err = servico.Excluir(ctx, criado.ID, "gestor01")

	require.ErrorIs(t, err, produto.ErrPossuiVendas)
}

func TestExcluirProdutoInexistente(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	err := servico.Excluir(ctx, 999999, "gestor01")

	require.ErrorIs(t, err, produto.ErrNaoEncontrado)
}

func TestListarDevolveOsItensEOTotal(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	for _, codigo := range []string{"VMS-01", "R-200"} {
		dados := dadosValidos()
		dados.Codigo = codigo
		_, err := servico.Criar(ctx, dados, "gestor01")
		require.NoError(t, err)
	}

	itens, total, err := servico.Listar(ctx, params(t))

	require.NoError(t, err)
	assert.Len(t, itens, 2)
	assert.Equal(t, 2, total)
}

func TestColunasOrdenaveisNaoExpoemColunasSensiveis(t *testing.T) {
	assert.NotContains(t, produto.ColunasOrdenaveis, "created_by")
	assert.Contains(t, produto.ColunasOrdenaveis, "codigo")
}
