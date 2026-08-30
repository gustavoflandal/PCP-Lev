package cotacao_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cotacao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func servicoComBanco(t *testing.T) (*cotacao.Servico, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return cotacao.NovoServico(repository.NovoCotacaoRepositorio(pool)), pool
}

func params(t *testing.T) consulta.Parametros {
	t.Helper()
	p, err := consulta.AnalisarComStatus(nil, cotacao.ColunasOrdenaveis, "numero_cotacao", cotacao.StatusPermitidos)
	require.NoError(t, err)
	return p
}

// criarFornecedorDeTeste cadastra um fornecedor real, necessario porque
// cotacoes.fornecedor_id tem FK para fornecedores.
func criarFornecedorDeTeste(ctx context.Context, t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	servico := fornecedor.NovoServico(repository.NovoFornecedorRepositorio(pool))
	criado, err := servico.Criar(ctx, fornecedor.Dados{
		RazaoSocial: "Componentes Eletronicos LTDA", CNPJ: "11222333000181", LeadTimeMedio: 7,
	}, "gestor01")
	require.NoError(t, err)
	return criado.ID
}

// criarPecaDeTeste cadastra uma parte/peca real, necessario porque
// itens_cotacao.parte_peca_id tem FK para partes_pecas.
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

func dadosDeTeste(fornecedorID, pecaID int64) cotacao.Dados {
	emissao, _ := tempo.DeString("2026-08-25")
	validade, _ := tempo.DeString("2026-09-25")
	preco, _ := dinheiro.DeString("50.00")

	return cotacao.Dados{
		NumeroCotacao: "COT-2026-001",
		FornecedorID:  fornecedorID,
		DataEmissao:   emissao,
		DataValidade:  validade,
		Itens: []cotacao.ItemDados{
			{PartePecaID: pecaID, Quantidade: 100, PrecoUnitario: preco},
		},
	}
}

func TestCriarCalculaValorTotal(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	criada, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")

	require.NoError(t, err)
	assert.Equal(t, "5000.00", criada.ValorTotal.String())
	assert.Equal(t, cotacao.StatusRascunho, criada.Status)
	require.Len(t, criada.Itens, 1)
	assert.Equal(t, "5000.00", criada.Itens[0].Total.String())
}

func TestCriarComFornecedorInexistenteFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	pecaID := criarPecaDeTeste(ctx, t, pool)

	_, err := servico.Criar(ctx, dadosDeTeste(999999, pecaID), "gestor01")

	require.ErrorIs(t, err, cotacao.ErrFornecedorOuPecaInexistente)
}

func TestCriarComNumeroRepetidoFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	_, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)

	_, err = servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")

	require.ErrorIs(t, err, cotacao.ErrNumeroCotacaoDuplicado)
}

func TestBuscarPorIDTrazOsItens(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criada, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)

	encontrada, err := servico.BuscarPorID(ctx, criada.ID)

	require.NoError(t, err)
	require.Len(t, encontrada.Itens, 1)
	assert.Equal(t, pecaID, encontrada.Itens[0].PartePecaID)
}

func TestEnviarMudaStatusParaEnviada(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criada, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)

	enviada, err := servico.Enviar(ctx, criada.ID, "gestor01")

	require.NoError(t, err)
	assert.Equal(t, cotacao.StatusEnviada, enviada.Status)
}

func TestEnviarForaDeRascunhoFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criada, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = servico.Enviar(ctx, criada.ID, "gestor01")
	require.NoError(t, err)

	_, err = servico.Enviar(ctx, criada.ID, "gestor01")

	require.ErrorIs(t, err, cotacao.ErrStatusInvalidoParaAcao)
}

func TestRegistrarRespostaMudaStatusERecalculaValorTotal(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criada, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = servico.Enviar(ctx, criada.ID, "gestor01")
	require.NoError(t, err)

	novoPreco, _ := dinheiro.DeString("48.00")
	respondida, err := servico.RegistrarResposta(ctx, criada.ID, cotacao.RespostaDados{
		DataResposta: tempo.Hoje(),
		Itens:        []cotacao.ItemDados{{PartePecaID: pecaID, PrecoUnitario: novoPreco}},
	}, "gestor01")

	require.NoError(t, err)
	assert.Equal(t, cotacao.StatusRespondida, respondida.Status)
	assert.Equal(t, "4800.00", respondida.ValorTotal.String())
}

func TestRegistrarRespostaForaDeEnviadaFalha(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criada, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)

	_, err = servico.RegistrarResposta(ctx, criada.ID, cotacao.RespostaDados{
		DataResposta: tempo.Hoje(),
		Itens:        []cotacao.ItemDados{{PartePecaID: pecaID, PrecoUnitario: dinheiro.DeCentavos(100)}},
	}, "gestor01")

	require.ErrorIs(t, err, cotacao.ErrStatusInvalidoParaAcao)
}

func TestCancelarMudaStatusParaCancelada(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criada, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)

	require.NoError(t, servico.Cancelar(ctx, criada.ID, "gestor01"))

	depois, err := servico.BuscarPorID(ctx, criada.ID)
	require.NoError(t, err)
	assert.Equal(t, cotacao.StatusCancelada, depois.Status)
}

func TestCancelarDuasVezesFalhaNaSegunda(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criada, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	require.NoError(t, servico.Cancelar(ctx, criada.ID, "gestor01"))

	err = servico.Cancelar(ctx, criada.ID, "gestor01")

	require.ErrorIs(t, err, cotacao.ErrStatusInvalidoParaAcao)
}

func TestListarFiltraPorStatus(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criada, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	_, err = servico.Enviar(ctx, criada.ID, "gestor01")
	require.NoError(t, err)

	dados2 := dadosDeTeste(fornecedorID, pecaID)
	dados2.NumeroCotacao = "COT-2026-002"
	_, err = servico.Criar(ctx, dados2, "gestor01")
	require.NoError(t, err)

	p := params(t)
	enviada := cotacao.StatusEnviada
	p.FiltroStatus = &enviada

	itens, total, err := servico.Listar(ctx, p)

	require.NoError(t, err)
	assert.Equal(t, 1, total)
	require.Len(t, itens, 1)
	assert.Equal(t, "COT-2026-001", itens[0].NumeroCotacao)
}

func TestListarFiltraPelaBusca(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	_, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)

	p := params(t)
	p.Busca = "cot-2026-001"

	itens, total, err := servico.Listar(ctx, p)

	require.NoError(t, err)
	assert.Equal(t, 1, total)
	require.Len(t, itens, 1)
}
