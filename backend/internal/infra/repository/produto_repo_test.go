package repository_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func repoProduto(t *testing.T) *repository.ProdutoRepositorio {
	t.Helper()
	return repository.NovoProdutoRepositorio(testsupport.BancoMigrado(t))
}

func pa(codigo, descricao string) *produto.ProdutoAcabado {
	return &produto.ProdutoAcabado{
		Codigo:           codigo,
		Descricao:        descricao,
		UnidadeMedida:    "und",
		PrecoVenda:       dinheiro.DeCentavos(500000),
		LeadTimeProducao: 10,
		Ativo:            true,
	}
}

func paramsPadrao(t *testing.T) consulta.Parametros {
	t.Helper()
	p, err := consulta.Analisar(nil, []string{"codigo"}, "codigo")
	require.NoError(t, err)
	return p
}

func TestCriarProdutoDevolveIDEPreservaOPreco(t *testing.T) {
	ctx := context.Background()
	repo := repoProduto(t)

	novo := pa("VMS-01", "Painel de Velocidade VMS Serie 01")
	require.NoError(t, repo.Criar(ctx, novo, "gestor01"))

	assert.NotZero(t, novo.ID)
	salvo, err := repo.BuscarPorID(ctx, novo.ID)
	require.NoError(t, err)
	assert.Equal(t, "5000.00", salvo.PrecoVenda.String())
	require.NotNil(t, salvo.CreatedBy)
	assert.Equal(t, "gestor01", *salvo.CreatedBy)
}

func TestCriarProdutoComCodigoRepetidoEhRecusado(t *testing.T) {
	ctx := context.Background()
	repo := repoProduto(t)
	require.NoError(t, repo.Criar(ctx, pa("VMS-01", "Painel de Velocidade"), "gestor01"))

	err := repo.Criar(ctx, pa("VMS-01", "Outro painel qualquer"), "gestor01")

	require.ErrorIs(t, err, produto.ErrCodigoDuplicado)
}

func TestBuscarPorIDInexistenteDevolveNaoEncontrado(t *testing.T) {
	ctx := context.Background()

	_, err := repoProduto(t).BuscarPorID(ctx, 999999)

	require.ErrorIs(t, err, produto.ErrNaoEncontrado)
}

func TestAtualizarProdutoGravaOsNovosDados(t *testing.T) {
	ctx := context.Background()
	repo := repoProduto(t)
	p := pa("VMS-01", "Painel de Velocidade")
	require.NoError(t, repo.Criar(ctx, p, "gestor01"))

	p.Descricao = "Painel de Velocidade VMS Serie 02"
	p.PrecoVenda = dinheiro.DeCentavos(620050)
	require.NoError(t, repo.Atualizar(ctx, p, "gestor02"))

	salvo, err := repo.BuscarPorID(ctx, p.ID)
	require.NoError(t, err)
	assert.Equal(t, "Painel de Velocidade VMS Serie 02", salvo.Descricao)
	assert.Equal(t, "6200.50", salvo.PrecoVenda.String())
	require.NotNil(t, salvo.UpdatedBy)
	assert.Equal(t, "gestor02", *salvo.UpdatedBy)
}

func TestAtualizarProdutoInexistenteDevolveNaoEncontrado(t *testing.T) {
	ctx := context.Background()
	fantasma := pa("VMS-99", "Produto inexistente")
	fantasma.ID = 999999

	err := repoProduto(t).Atualizar(ctx, fantasma, "gestor01")

	require.ErrorIs(t, err, produto.ErrNaoEncontrado)
}

func TestListarPaginaEContaOTotal(t *testing.T) {
	ctx := context.Background()
	repo := repoProduto(t)
	for _, c := range []string{"VMS-01", "VMS-02", "R-200"} {
		require.NoError(t, repo.Criar(ctx, pa(c, "Produto "+c), "gestor01"))
	}

	params := paramsPadrao(t)
	params.Limite = 2

	itens, total, err := repo.Listar(ctx, params)

	require.NoError(t, err)
	assert.Len(t, itens, 2)
	assert.Equal(t, 3, total)
	assert.Equal(t, "R-200", itens[0].Codigo, "ordenacao padrao por codigo crescente")
}

func TestListarFiltraPorSituacao(t *testing.T) {
	ctx := context.Background()
	repo := repoProduto(t)
	ativo := pa("VMS-01", "Painel ativo")
	require.NoError(t, repo.Criar(ctx, ativo, "gestor01"))
	inativo := pa("VMS-02", "Painel inativo")
	inativo.Ativo = false
	require.NoError(t, repo.Criar(ctx, inativo, "gestor01"))

	params := paramsPadrao(t)
	sim := true
	params.FiltroAtivo = &sim

	itens, total, err := repo.Listar(ctx, params)

	require.NoError(t, err)
	assert.Equal(t, 1, total)
	require.Len(t, itens, 1)
	assert.Equal(t, "VMS-01", itens[0].Codigo)
}

func TestListarBuscaPorCodigoOuDescricaoIgnorandoCaixa(t *testing.T) {
	ctx := context.Background()
	repo := repoProduto(t)
	require.NoError(t, repo.Criar(ctx, pa("VMS-01", "Painel de velocidade"), "gestor01"))
	require.NoError(t, repo.Criar(ctx, pa("R-200", "Radar de transito"), "gestor01"))

	params := paramsPadrao(t)
	params.Busca = "radar"

	itens, total, err := repo.Listar(ctx, params)

	require.NoError(t, err)
	assert.Equal(t, 1, total)
	require.Len(t, itens, 1)
	assert.Equal(t, "R-200", itens[0].Codigo)
}

func TestDesativarMarcaComoInativoSemApagarORegistro(t *testing.T) {
	ctx := context.Background()
	repo := repoProduto(t)
	p := pa("VMS-01", "Painel de velocidade")
	require.NoError(t, repo.Criar(ctx, p, "gestor01"))

	require.NoError(t, repo.Desativar(ctx, p.ID, "gestor01"))

	salvo, err := repo.BuscarPorID(ctx, p.ID)
	require.NoError(t, err, "o registro continua existindo apos o soft delete")
	assert.False(t, salvo.Ativo)
}

func TestDesativarProdutoInexistenteDevolveNaoEncontrado(t *testing.T) {
	ctx := context.Background()

	err := repoProduto(t).Desativar(ctx, 999999, "gestor01")

	require.ErrorIs(t, err, produto.ErrNaoEncontrado)
}

func TestPossuiVendasDetectaProdutoUsadoEmPedido(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoProdutoRepositorio(pool)
	p := pa("VMS-01", "Painel de velocidade")
	require.NoError(t, repo.Criar(ctx, p, "gestor01"))

	semVendas, err := repo.PossuiVendas(ctx, p.ID)
	require.NoError(t, err)
	assert.False(t, semVendas)

	_, err = pool.Exec(ctx, `
		INSERT INTO pedidos_venda (numero_pedido, cliente_nome, data_pedido, data_entrega_prometida, valor_total)
		VALUES ('PV-2026-001', 'Prefeitura', CURRENT_DATE, CURRENT_DATE + 30, 5000.00)`)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `
		INSERT INTO itens_pedido_venda (pedido_venda_id, produto_acabado_id, quantidade, preco_unitario, total)
		SELECT id, $1, 1, 5000.00, 5000.00 FROM pedidos_venda WHERE numero_pedido = 'PV-2026-001'`, p.ID)
	require.NoError(t, err)

	comVendas, err := repo.PossuiVendas(ctx, p.ID)
	require.NoError(t, err)
	assert.True(t, comVendas)
}

func TestListarSemEstruturaDevolveEstruturaAtivaNula(t *testing.T) {
	ctx := context.Background()
	repo := repoProduto(t)
	require.NoError(t, repo.Criar(ctx, pa("VMS-01", "Painel sem BOM"), "gestor01"))

	itens, _, err := repo.Listar(ctx, paramsPadrao(t))

	require.NoError(t, err)
	require.Len(t, itens, 1)
	assert.Nil(t, itens[0].EstruturaAtiva)
}

func TestListarComEstruturaAtivaTrazVersaoEVigencia(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoProdutoRepositorio(pool)
	p := pa("VMS-01", "Painel com BOM")
	require.NoError(t, repo.Criar(ctx, p, "gestor01"))

	pecaRepo := repository.NovoPecaRepositorio(pool)
	peca1 := &peca.PartePeca{Codigo: "RES-10K", Descricao: "Resistor de 10 kOhm", UnidadeMedida: "und", EstoqueMinimo: 0, EstoqueMaximo: 100, LeadTimeCompra: 7, Ativo: true}
	require.NoError(t, pecaRepo.Criar(ctx, peca1, "gestor01"))

	estruturaRepo := repository.NovoEstruturaRepositorio(pool)
	inicio, _ := tempo.DeString("2026-09-01")
	e := &estrutura.Estrutura{
		ProdutoAcabadoID: p.ID, Versao: 1, DataVigenciaInicio: inicio, Ativo: true,
		Itens: []estrutura.Item{{PartePecaID: peca1.ID, Quantidade: 4}},
	}
	require.NoError(t, estruturaRepo.Criar(ctx, e, "gestor01"))

	itens, _, err := repo.Listar(ctx, paramsPadrao(t))

	require.NoError(t, err)
	require.Len(t, itens, 1)
	require.NotNil(t, itens[0].EstruturaAtiva)
	assert.Equal(t, 1, itens[0].EstruturaAtiva.Versao)
}
