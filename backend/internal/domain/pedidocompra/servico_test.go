package pedidocompra_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func servicoComBanco(t *testing.T) (*pedidocompra.Servico, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	estoqueServico := estoque.NovoServico(repository.NovoEstoqueRepositorio(pool))
	return pedidocompra.NovoServico(repository.NovoPedidoCompraRepositorio(pool), estoqueServico), pool
}

func params(t *testing.T) consulta.Parametros {
	t.Helper()
	p, err := consulta.AnalisarComStatus(nil, pedidocompra.ColunasOrdenaveis, "numero_pc", pedidocompra.StatusPermitidos)
	require.NoError(t, err)
	return p
}

func criarFornecedorDeTeste(ctx context.Context, t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	servico := fornecedor.NovoServico(repository.NovoFornecedorRepositorio(pool))
	criado, err := servico.Criar(ctx, fornecedor.Dados{
		RazaoSocial: "Componentes Eletronicos LTDA", CNPJ: "11222333000181", LeadTimeMedio: 7,
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

func dadosDeTeste(fornecedorID, pecaID int64) pedidocompra.Dados {
	pedido, _ := tempo.DeString("2026-08-25")
	entrega, _ := tempo.DeString("2026-09-25")
	preco, _ := dinheiro.DeString("50.00")

	return pedidocompra.Dados{
		NumeroPC:            "PC-2026-001",
		FornecedorID:        fornecedorID,
		DataPedido:          pedido,
		DataEntregaPrevista: entrega,
		CondicaoPagamento:   "30 dias",
		Itens: []pedidocompra.ItemDados{
			{PartePecaID: pecaID, QuantidadeSolicitada: 100, PrecoUnitario: preco},
		},
	}
}

func TestCriarCalculaValorTotal(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")

	require.NoError(t, err)
	assert.Equal(t, "5000.00", criado.ValorTotal.String())
	assert.Equal(t, pedidocompra.StatusRascunho, criado.Status)
}

func TestCriarComFornecedorInexistenteFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	_, err := servico.Criar(ctx, dadosDeTeste(999999, pecaID), "gestor01")

	require.ErrorIs(t, err, pedidocompra.ErrFornecedorOuPecaInexistente)
}

func TestCriarComNumeroRepetidoFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	_, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)

	_, err = servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")

	require.ErrorIs(t, err, pedidocompra.ErrNumeroPCDuplicado)
}

func TestEmitirVaiDiretoParaAguardandoEntrega(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)

	emitido, err := servico.Emitir(ctx, criado.ID, "gestor01")

	require.NoError(t, err)
	assert.Equal(t, pedidocompra.StatusAguardandoEntrega, emitido.Status)
}

func TestEmitirForaDeRascunhoFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = servico.Emitir(ctx, criado.ID, "gestor01")
	require.NoError(t, err)

	_, err = servico.Emitir(ctx, criado.ID, "gestor01")

	require.ErrorIs(t, err, pedidocompra.ErrStatusInvalidoParaAcao)
}

func TestCancelarMudaStatusParaCancelado(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)

	require.NoError(t, servico.Cancelar(ctx, criado.ID, "gestor01"))

	depois, err := servico.BuscarPorID(ctx, criado.ID)
	require.NoError(t, err)
	assert.Equal(t, pedidocompra.StatusCancelado, depois.Status)
}

func TestCancelarPedidoConcluidoFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `UPDATE pedidos_compra SET status = 'Concluido' WHERE id = $1`, criado.ID)
	require.NoError(t, err)

	err = servico.Cancelar(ctx, criado.ID, "gestor01")

	require.ErrorIs(t, err, pedidocompra.ErrStatusInvalidoParaAcao)
}

func TestListarFiltraPorStatus(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = servico.Emitir(ctx, criado.ID, "gestor01")
	require.NoError(t, err)

	dados2 := dadosDeTeste(fornecedorID, pecaID)
	dados2.NumeroPC = "PC-2026-002"
	_, err = servico.Criar(ctx, dados2, "gestor01")
	require.NoError(t, err)

	p := params(t)
	aguardandoEntrega := pedidocompra.StatusAguardandoEntrega
	p.FiltroStatus = &aguardandoEntrega

	itens, total, err := servico.Listar(ctx, p)

	require.NoError(t, err)
	assert.Equal(t, 1, total)
	require.Len(t, itens, 1)
	assert.Equal(t, "PC-2026-001", itens[0].NumeroPC)
}

func TestRegistrarRecebimentoParcialNaoFechaOPedido(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = servico.Emitir(ctx, criado.ID, "gestor01")
	require.NoError(t, err)

	recebido, err := servico.RegistrarRecebimento(ctx, criado.ID,
		[]pedidocompra.ItemRecebimentoDados{{PartePecaID: pecaID, QuantidadeRecebida: 40}}, "gestor01")

	require.NoError(t, err)
	assert.Equal(t, pedidocompra.StatusRecebidoParcial, recebido.Status)
}

func TestRegistrarRecebimentoSomaSobreOAnterior(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = servico.Emitir(ctx, criado.ID, "gestor01")
	require.NoError(t, err)
	_, err = servico.RegistrarRecebimento(ctx, criado.ID,
		[]pedidocompra.ItemRecebimentoDados{{PartePecaID: pecaID, QuantidadeRecebida: 40}}, "gestor01")
	require.NoError(t, err)

	concluido, err := servico.RegistrarRecebimento(ctx, criado.ID,
		[]pedidocompra.ItemRecebimentoDados{{PartePecaID: pecaID, QuantidadeRecebida: 60}}, "gestor01")

	require.NoError(t, err)
	assert.Equal(t, pedidocompra.StatusConcluido, concluido.Status)
	assert.False(t, concluido.DataEntregaReal.IsZero())
}

func TestRegistrarRecebimentoAcimaDoSolicitadoFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = servico.Emitir(ctx, criado.ID, "gestor01")
	require.NoError(t, err)

	_, err = servico.RegistrarRecebimento(ctx, criado.ID,
		[]pedidocompra.ItemRecebimentoDados{{PartePecaID: pecaID, QuantidadeRecebida: 200}}, "gestor01")

	require.ErrorIs(t, err, pedidocompra.ErrQuantidadeRecebidaExcedeSolicitada)
}

func TestRegistrarRecebimentoForaDeAguardandoEntregaFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01") // fica em Rascunho
	require.NoError(t, err)

	_, err = servico.RegistrarRecebimento(ctx, criado.ID, nil, "gestor01")

	require.ErrorIs(t, err, pedidocompra.ErrStatusInvalidoParaAcao)
}

func TestRegistrarRecebimentoDaEntradaNoEstoque(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = servico.Emitir(ctx, criado.ID, "gestor01")
	require.NoError(t, err)

	_, err = servico.RegistrarRecebimento(ctx, criado.ID,
		[]pedidocompra.ItemRecebimentoDados{{PartePecaID: pecaID, QuantidadeRecebida: 30}}, "gestor01")
	require.NoError(t, err)

	estoqueRepo := repository.NovoEstoqueRepositorio(pool)
	saldo, err := estoqueRepo.BuscarSaldo(ctx, pecaID)
	require.NoError(t, err)
	assert.Equal(t, 30, saldo.QuantidadeAtual)
}

func TestEmAtrasoTrazSoOsVencidosENaoTerminais(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	vencido, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	// data_pedido tambem precisa ir para o passado: o CHECK exige
	// data_entrega_prevista > data_pedido, e o fixture usa uma data fixa que
	// pode ser posterior a CURRENT_DATE - 5 dependendo de quando o teste roda.
	_, err = pool.Exec(ctx,
		`UPDATE pedidos_compra SET data_pedido = CURRENT_DATE - 100, data_entrega_prevista = CURRENT_DATE - 5 WHERE id = $1`,
		vencido.ID)
	require.NoError(t, err)

	dentroDoPrazo := dadosDeTeste(fornecedorID, pecaID)
	dentroDoPrazo.NumeroPC = "PC-2026-002"
	_, err = servico.Criar(ctx, dentroDoPrazo, "gestor01")
	require.NoError(t, err)

	vencidoMasConcluido := dadosDeTeste(fornecedorID, pecaID)
	vencidoMasConcluido.NumeroPC = "PC-2026-003"
	concluido, err := servico.Criar(ctx, vencidoMasConcluido, "gestor01")
	require.NoError(t, err)
	_, err = pool.Exec(ctx,
		`UPDATE pedidos_compra SET data_pedido = CURRENT_DATE - 100, data_entrega_prevista = CURRENT_DATE - 5, status = 'Concluido' WHERE id = $1`,
		concluido.ID)
	require.NoError(t, err)

	emAtraso, err := servico.EmAtraso(ctx)

	require.NoError(t, err)
	require.Len(t, emAtraso, 1)
	assert.Equal(t, "PC-2026-001", emAtraso[0].NumeroPC)
}
