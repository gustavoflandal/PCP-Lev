package fornecedor_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func servicoComBanco(t *testing.T) (*fornecedor.Servico, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return fornecedor.NovoServico(repository.NovoFornecedorRepositorio(pool)), pool
}

func params(t *testing.T) consulta.Parametros {
	t.Helper()
	p, err := consulta.Analisar(nil, fornecedor.ColunasOrdenaveis, "razao_social")
	require.NoError(t, err)
	return p
}

// outroCNPJValido permite cadastrar um segundo fornecedor sem colidir no
// indice unico de CNPJ.
const outroCNPJValido = "45723174000110"

func TestCriarGuardaOCNPJSoComDigitos(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	dados := dadosValidos()
	dados.CNPJ = "11.222.333/0001-81"

	criado, err := servico.Criar(ctx, dados, "gestor01")

	require.NoError(t, err)
	assert.Equal(t, "11222333000181", criado.CNPJ)
}

func TestCriarNasceAtivoQuandoNaoInformado(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	criado, err := servico.Criar(ctx, dadosValidos(), "gestor01")

	require.NoError(t, err)
	assert.True(t, criado.Ativo)
}

func TestCriarRecusaCNPJInvalido(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	dados := dadosValidos()
	dados.CNPJ = "11222333000182"

	_, err := servico.Criar(ctx, dados, "gestor01")

	require.ErrorIs(t, err, fornecedor.ErrCNPJInvalido)
}

func TestCriarRecusaCNPJRepetido(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	_, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	// Mesmo documento, agora pontuado: a duplicidade tem que ser detectada
	// pelos digitos, nao pelo texto informado.
	repetido := dadosValidos()
	repetido.CNPJ = "11.222.333/0001-81"

	_, err = servico.Criar(ctx, repetido, "gestor01")

	require.ErrorIs(t, err, fornecedor.ErrCNPJDuplicado)
}

func TestAtualizarAlteraContatoELeadTime(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	criado, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	dados := dadosValidos()
	dados.ContatoNome = "Maria Souza"
	dados.ContatoEmail = "Maria@Componentes.com.BR"
	dados.LeadTimeMedio = 21

	atualizado, err := servico.Atualizar(ctx, criado.ID, dados, "gestor02")

	require.NoError(t, err)
	assert.Equal(t, "Maria Souza", atualizado.ContatoNome)
	assert.Equal(t, "maria@componentes.com.br", atualizado.ContatoEmail)
	assert.Equal(t, 21, atualizado.LeadTimeMedio)
}

func TestAtualizarFornecedorInexistente(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	_, err := servico.Atualizar(ctx, 999999, dadosValidos(), "gestor01")

	require.ErrorIs(t, err, fornecedor.ErrNaoEncontrado)
}

func TestExcluirDesativaFornecedorSemPedidos(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	criado, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	require.NoError(t, servico.Excluir(ctx, criado.ID, "gestor01"))

	depois, err := servico.BuscarPorID(ctx, criado.ID)
	require.NoError(t, err)
	assert.False(t, depois.Ativo)
}

func TestExcluirBloqueiaFornecedorComPedidoPendente(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	criado, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	inserirPedido(t, pool, criado.ID, "PC-2026-001", "Aguardando Entrega")

	err = servico.Excluir(ctx, criado.ID, "gestor01")

	require.ErrorIs(t, err, fornecedor.ErrPossuiPedidosPendentes)
}

func TestExcluirLiberaFornecedorComPedidoEncerrado(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	criado, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	// Pedido concluido e historico, nao pendencia: nao pode travar o cadastro.
	inserirPedido(t, pool, criado.ID, "PC-2026-002", "Concluido")

	require.NoError(t, servico.Excluir(ctx, criado.ID, "gestor01"))
}

func TestExcluirFornecedorInexistente(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)

	err := servico.Excluir(ctx, 999999, "gestor01")

	require.ErrorIs(t, err, fornecedor.ErrNaoEncontrado)
}

func TestListarDevolveItensETotal(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	criarDois(ctx, t, servico)

	itens, total, err := servico.Listar(ctx, params(t))

	require.NoError(t, err)
	assert.Len(t, itens, 2)
	assert.Equal(t, 2, total)
}

func TestListarFiltraPelaBusca(t *testing.T) {
	ctx := context.Background()
	servico, _ := servicoComBanco(t)
	criarDois(ctx, t, servico)

	p := params(t)
	p.Busca = "radares"

	itens, total, err := servico.Listar(ctx, p)

	require.NoError(t, err)
	require.Len(t, itens, 1)
	assert.Equal(t, 1, total)
	assert.Equal(t, "Radares do Sul LTDA", itens[0].RazaoSocial)
}

func criarDois(ctx context.Context, t *testing.T, servico *fornecedor.Servico) {
	t.Helper()

	_, err := servico.Criar(ctx, dadosValidos(), "gestor01")
	require.NoError(t, err)

	segundo := dadosValidos()
	segundo.RazaoSocial = "Radares do Sul LTDA"
	segundo.CNPJ = outroCNPJValido
	_, err = servico.Criar(ctx, segundo, "gestor01")
	require.NoError(t, err)
}

func inserirPedido(t *testing.T, pool *pgxpool.Pool, fornecedorID int64, numero, status string) {
	t.Helper()

	_, err := pool.Exec(context.Background(), `
		INSERT INTO pedidos_compra
			(numero_pc, fornecedor_id, data_pedido, data_entrega_prevista, valor_total, status)
		VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + 10, 1500.00, $3)`,
		numero, fornecedorID, status)
	require.NoError(t, err)
}
