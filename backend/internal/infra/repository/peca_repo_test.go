package repository_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func repoPeca(t *testing.T) (*repository.PecaRepositorio, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return repository.NovoPecaRepositorio(pool), pool
}

func pp(codigo, descricao string) *peca.PartePeca {
	return &peca.PartePeca{
		Codigo:         codigo,
		Descricao:      descricao,
		UnidadeMedida:  "und",
		EstoqueMinimo:  50,
		EstoqueMaximo:  500,
		LeadTimeCompra: 7,
		Ativo:          true,
	}
}

func criarFornecedorDeApoio(t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	var id int64
	err := pool.QueryRow(context.Background(), `
		INSERT INTO fornecedores (razao_social, cnpj, lead_time_medio)
		VALUES ('Componentes Eletronicos LTDA', '11222333000181', 7) RETURNING id`).Scan(&id)
	require.NoError(t, err)
	return id
}

func TestCriarPecaAbreOSaldoDeEstoqueZerado(t *testing.T) {
	ctx := context.Background()
	repo, pool := repoPeca(t)

	nova := pp("CON-001", "Conector RCA macho")
	require.NoError(t, repo.Criar(ctx, nova, "gestor01"))

	// RF2.1: toda peca precisa de uma linha de saldo para ser movimentada.
	var atual, reservada int
	var status string
	err := pool.QueryRow(ctx,
		`SELECT quantidade_atual, quantidade_reservada, status FROM saldo_estoque WHERE parte_peca_id = $1`,
		nova.ID).Scan(&atual, &reservada, &status)

	require.NoError(t, err, "o saldo deve nascer junto com a peca")
	assert.Zero(t, atual)
	assert.Zero(t, reservada)
	assert.Equal(t, "CRITICO", status, "saldo zero com minimo 50 ja nasce critico (RN5)")
}

func TestCriarPecaComCodigoRepetidoEhRecusado(t *testing.T) {
	ctx := context.Background()
	repo, _ := repoPeca(t)
	require.NoError(t, repo.Criar(ctx, pp("CON-001", "Conector RCA macho"), "gestor01"))

	err := repo.Criar(ctx, pp("CON-001", "Outro conector qualquer"), "gestor01")

	require.ErrorIs(t, err, peca.ErrCodigoDuplicado)
}

func TestCriarPecaComCodigoRepetidoNaoDeixaSaldoOrfao(t *testing.T) {
	ctx := context.Background()
	repo, pool := repoPeca(t)
	require.NoError(t, repo.Criar(ctx, pp("CON-001", "Conector RCA macho"), "gestor01"))

	_ = repo.Criar(ctx, pp("CON-001", "Outro conector qualquer"), "gestor01")

	var saldos int
	require.NoError(t, pool.QueryRow(ctx, `SELECT count(*) FROM saldo_estoque`).Scan(&saldos))
	assert.Equal(t, 1, saldos, "a transacao deve desfazer o saldo da peca recusada")
}

func TestCriarPecaComFornecedorInexistenteEhRecusado(t *testing.T) {
	ctx := context.Background()
	repo, _ := repoPeca(t)

	nova := pp("CON-001", "Conector RCA macho")
	fantasma := int64(999999)
	nova.FornecedorPadraoID = &fantasma

	err := repo.Criar(ctx, nova, "gestor01")

	require.ErrorIs(t, err, peca.ErrFornecedorInexistente)
}

func TestCriarPecaComFornecedorPadrao(t *testing.T) {
	ctx := context.Background()
	repo, pool := repoPeca(t)
	fornecedorID := criarFornecedorDeApoio(t, pool)

	nova := pp("CON-001", "Conector RCA macho")
	nova.FornecedorPadraoID = &fornecedorID
	require.NoError(t, repo.Criar(ctx, nova, "gestor01"))

	salva, err := repo.BuscarPorID(ctx, nova.ID)
	require.NoError(t, err)
	require.NotNil(t, salva.FornecedorPadraoID)
	assert.Equal(t, fornecedorID, *salva.FornecedorPadraoID)
}

func TestBuscarPecaInexistente(t *testing.T) {
	ctx := context.Background()
	repo, _ := repoPeca(t)

	_, err := repo.BuscarPorID(ctx, 999999)

	require.ErrorIs(t, err, peca.ErrNaoEncontrado)
}

func TestAtualizarPecaGravaOsNovosDados(t *testing.T) {
	ctx := context.Background()
	repo, _ := repoPeca(t)
	p := pp("CON-001", "Conector RCA macho")
	require.NoError(t, repo.Criar(ctx, p, "gestor01"))

	p.EstoqueMinimo = 80
	p.Descricao = "Conector RCA macho dourado"
	require.NoError(t, repo.Atualizar(ctx, p, "gestor02"))

	salva, err := repo.BuscarPorID(ctx, p.ID)
	require.NoError(t, err)
	assert.Equal(t, 80, salva.EstoqueMinimo)
	assert.Equal(t, "Conector RCA macho dourado", salva.Descricao)
}

func TestAtualizarPecaInexistente(t *testing.T) {
	ctx := context.Background()
	repo, _ := repoPeca(t)
	fantasma := pp("CON-999", "Peca inexistente")
	fantasma.ID = 999999

	err := repo.Atualizar(ctx, fantasma, "gestor01")

	require.ErrorIs(t, err, peca.ErrNaoEncontrado)
}

func TestListarPecasComBuscaEPaginacao(t *testing.T) {
	ctx := context.Background()
	repo, _ := repoPeca(t)
	require.NoError(t, repo.Criar(ctx, pp("CON-001", "Conector RCA macho"), "gestor01"))
	require.NoError(t, repo.Criar(ctx, pp("PLC-100", "Placa controladora"), "gestor01"))

	params := paramsPadrao(t)
	params.Busca = "placa"

	itens, total, err := repo.Listar(ctx, params)

	require.NoError(t, err)
	assert.Equal(t, 1, total)
	require.Len(t, itens, 1)
	assert.Equal(t, "PLC-100", itens[0].Codigo)
}

func TestDesativarPeca(t *testing.T) {
	ctx := context.Background()
	repo, _ := repoPeca(t)
	p := pp("CON-001", "Conector RCA macho")
	require.NoError(t, repo.Criar(ctx, p, "gestor01"))

	require.NoError(t, repo.Desativar(ctx, p.ID, "gestor01"))

	salva, err := repo.BuscarPorID(ctx, p.ID)
	require.NoError(t, err)
	assert.False(t, salva.Ativo)
}

func TestPossuiMovimentacaoDetectaPecaJaMovimentada(t *testing.T) {
	ctx := context.Background()
	repo, pool := repoPeca(t)
	p := pp("CON-001", "Conector RCA macho")
	require.NoError(t, repo.Criar(ctx, p, "gestor01"))

	semMovimento, err := repo.PossuiMovimentacao(ctx, p.ID)
	require.NoError(t, err)
	assert.False(t, semMovimento)

	_, err = pool.Exec(ctx, `
		INSERT INTO movimentacao_estoque (parte_peca_id, tipo, quantidade, motivo, referencia_numero)
		VALUES ($1, 'Entrada', 100, 'Compra', 'PC-2026-001')`, p.ID)
	require.NoError(t, err)

	comMovimento, err := repo.PossuiMovimentacao(ctx, p.ID)
	require.NoError(t, err)
	assert.True(t, comMovimento)
}
