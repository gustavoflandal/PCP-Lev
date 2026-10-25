package peca_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func servicoComBanco(t *testing.T) (*peca.Servico, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return peca.NovoServico(repository.NovoPecaRepositorio(pool)), pool
}

func params(t *testing.T) consulta.Parametros {
	t.Helper()
	p, err := consulta.Analisar(nil, peca.ColunasOrdenaveis, "codigo")
	require.NoError(t, err)
	return p
}

func TestCriarNormalizaOCodigo(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	dados := dadosValidos()
	dados.Codigo = " con-001 "

	criada, err := servico.Criar(ctx, dados, "gestor01")

	require.NoError(t, err)
	assert.Equal(t, "CON-001", criada.Codigo)
}

func TestCriarRecusaFaixaDeEstoqueInvalida(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	dados := dadosValidos()
	dados.EstoqueMinimo = 600

	_, err := servico.Criar(ctx, dados, "gestor01")

	require.ErrorIs(t, err, peca.ErrFaixaDeEstoqueInvalida)
}

func TestCriarNasceAtivaQuandoNaoInformado(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	criada, err := servico.Criar(ctx, dadosValidos(), "gestor01")

	require.NoError(t, err)
	assert.True(t, criada.Ativo)
}

func TestCriarRecusaCodigoRepetido(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	_, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	_, err = servico.Criar(ctx, dadosValidos(), "gestor01")

	require.ErrorIs(t, err, peca.ErrCodigoDuplicado)
}

func TestAtualizarAlteraAFaixaDeEstoque(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	criada, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	dados := dadosValidos()
	dados.EstoqueMinimo = 100
	dados.EstoqueMaximo = 900

	atualizada, err := servico.Atualizar(ctx, criada.ID, dados, "gestor02")

	require.NoError(t, err)
	assert.Equal(t, 100, atualizada.EstoqueMinimo)
	assert.Equal(t, 900, atualizada.EstoqueMaximo)
}

func TestExcluirDesativaPecaSemMovimentacao(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	criada, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	require.NoError(t, servico.Excluir(ctx, criada.ID, "gestor01"))

	depois, err := servico.BuscarPorID(ctx, criada.ID)
	require.NoError(t, err)
	assert.False(t, depois.Ativo)
}

func TestExcluirBloqueiaPecaComMovimentacao(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	criada, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	_, err = pool.Exec(ctx, `
		INSERT INTO movimentacao_estoque (parte_peca_id, tipo, quantidade, motivo, referencia_numero)
		VALUES ($1, 'Entrada', 100, 'Compra', 'PC-2026-001')`, criada.ID)
	require.NoError(t, err)

	err = servico.Excluir(ctx, criada.ID, "gestor01")

	require.ErrorIs(t, err, peca.ErrPossuiMovimentacao)
}

func TestExcluirPecaInexistente(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	err := servico.Excluir(ctx, 999999, "gestor01")

	require.ErrorIs(t, err, peca.ErrNaoEncontrado)
}

func TestListarDevolveItensETotal(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	for _, codigo := range []string{"CON-001", "PLC-100"} {
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
