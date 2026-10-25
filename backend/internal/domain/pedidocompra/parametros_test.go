package pedidocompra_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Testes dos parametros de negocio aplicados ao pedido de compra (spec
// 2026-10-24-parametros-negocio). O pedido de dadosDeTeste vale 100 x 50,00
// = 5.000,00.

func configurarNegocio(ctx context.Context, t *testing.T, pool *pgxpool.Pool, set string) {
	t.Helper()
	_, err := pool.Exec(ctx, `UPDATE configuracao_negocio SET `+set+` WHERE id = 1`)
	require.NoError(t, err)
}

// cotacaoRespondida grava direto no banco uma cotacao com a peca, emitida ha
// `diasAtras` dias (negativo = no futuro), no status informado. As datas saem
// de tempo.Hoje() -- o mesmo relogio (UTC) que o Servico usa para a janela;
// CURRENT_DATE do Postgres (America/Sao_Paulo) ja e o dia seguinte entre 21h
// e 24h, e a fronteira dos 90 dias quebraria nesse horario.
func cotacaoRespondida(ctx context.Context, t *testing.T, pool *pgxpool.Pool, numero string, fornecedorID, pecaID int64, diasAtras int, status string) {
	t.Helper()
	hoje := tempo.Hoje().Time
	emissao := tempo.Data{Time: hoje.AddDate(0, 0, -diasAtras)}
	validade := tempo.Data{Time: hoje.AddDate(0, 0, 30+max(0, -diasAtras))}
	var id int64
	err := pool.QueryRow(ctx, `
		INSERT INTO cotacoes (numero_cotacao, fornecedor_id, data_emissao, data_validade, status)
		VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		numero, fornecedorID, emissao, validade, status).Scan(&id)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `
		INSERT INTO itens_cotacao (cotacao_id, parte_peca_id, quantidade, preco_unitario, total)
		VALUES ($1, $2, 10, 1.00, 10.00)`, id, pecaID)
	require.NoError(t, err)
}

// outroFornecedor cria um segundo fornecedor (CNPJ diferente do de
// criarFornecedorDeTeste) -- o minimo de cotacoes conta fornecedores distintos.
func outroFornecedor(ctx context.Context, t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	var id int64
	err := pool.QueryRow(ctx, `
		INSERT INTO fornecedores (razao_social, cnpj, lead_time_medio)
		VALUES ('Outro Fornecedor LTDA', '11444777000161', 7) RETURNING id`).Scan(&id)
	require.NoError(t, err)
	return id
}

func pedidoEmRascunho(ctx context.Context, t *testing.T, servico *pedidocompra.Servico, pool *pgxpool.Pool) (*pedidocompra.PedidoCompra, int64, int64) {
	t.Helper()
	fornecedorID := criarFornecedorDeTeste(ctx, t, pool)
	pecaID := criarPecaDeTeste(ctx, t, pool)
	criado, err := servico.Criar(ctx, dadosDeTeste(fornecedorID, pecaID), "gestor01")
	require.NoError(t, err)
	return criado, fornecedorID, pecaID
}

func TestEmitirAcimaDaAlcadaDoGestorExigeAdministrador(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	configurarNegocio(ctx, t, pool, `limite_emissao_gestor = 4999.99`)
	criado, _, _ := pedidoEmRascunho(ctx, t, servico, pool)

	_, err := servico.Emitir(ctx, criado.ID, "gestor01", false)
	require.ErrorIs(t, err, pedidocompra.ErrAcimaDaAlcada)

	emitido, err := servico.Emitir(ctx, criado.ID, "admin", true)
	require.NoError(t, err)
	assert.Equal(t, pedidocompra.StatusAguardandoEntrega, emitido.Status)
}

func TestEmitirNoLimiteDaAlcadaPassaParaOGestor(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	configurarNegocio(ctx, t, pool, `limite_emissao_gestor = 5000.00`)
	criado, _, _ := pedidoEmRascunho(ctx, t, servico, pool)

	_, err := servico.Emitir(ctx, criado.ID, "gestor01", false)

	assert.NoError(t, err, "o limite e inclusivo")
}

func TestEmitirExigeMinimoDeCotacoesRespondidasRecentes(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	configurarNegocio(ctx, t, pool, `cotacoes_minimas = 2, valor_exige_cotacoes = 5000`)
	criado, fornecedorID, pecaID := pedidoEmRascunho(ctx, t, servico, pool)

	// Nao contam: enviada (sem resposta), cancelada e respondida ha 91 dias.
	cotacaoRespondida(ctx, t, pool, "COT-A", fornecedorID, pecaID, 1, "Enviada")
	cotacaoRespondida(ctx, t, pool, "COT-B", fornecedorID, pecaID, 1, "Cancelada")
	cotacaoRespondida(ctx, t, pool, "COT-C", fornecedorID, pecaID, 91, "Respondida")
	// Conta: um fornecedor.
	cotacaoRespondida(ctx, t, pool, "COT-D", fornecedorID, pecaID, 10, "Respondida")

	_, err := servico.Emitir(ctx, criado.ID, "gestor01", false)
	require.ErrorIs(t, err, pedidocompra.ErrCotacoesInsuficientes)
	assert.Contains(t, err.Error(), "RES-10K (1 de 2)", "a mensagem lista a peca e quanto falta")

	// Segundo fornecedor, no limite da janela (exatamente 90 dias).
	cotacaoRespondida(ctx, t, pool, "COT-E", outroFornecedor(ctx, t, pool), pecaID, 90, "Respondida")
	_, err = servico.Emitir(ctx, criado.ID, "gestor01", false)
	assert.NoError(t, err, "dois fornecedores com cotacao respondida dentro da janela de 90 dias")
}

func TestEmitirContaFornecedoresDistintosNaoCotacoes(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	configurarNegocio(ctx, t, pool, `cotacoes_minimas = 2, valor_exige_cotacoes = 0`)
	criado, fornecedorID, pecaID := pedidoEmRascunho(ctx, t, servico, pool)

	// Tres cotacoes do MESMO fornecedor nao comparam preco nenhum.
	cotacaoRespondida(ctx, t, pool, "COT-1", fornecedorID, pecaID, 1, "Respondida")
	cotacaoRespondida(ctx, t, pool, "COT-2", fornecedorID, pecaID, 2, "Respondida")
	cotacaoRespondida(ctx, t, pool, "COT-3", fornecedorID, pecaID, 3, "Respondida")

	_, err := servico.Emitir(ctx, criado.ID, "gestor01", false)

	require.ErrorIs(t, err, pedidocompra.ErrCotacoesInsuficientes)
	assert.Contains(t, err.Error(), "RES-10K (1 de 2)")
}

func TestEmitirIgnoraCotacaoComDataDeEmissaoNoFuturo(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	configurarNegocio(ctx, t, pool, `cotacoes_minimas = 1, valor_exige_cotacoes = 0`)
	criado, fornecedorID, pecaID := pedidoEmRascunho(ctx, t, servico, pool)
	cotacaoRespondida(ctx, t, pool, "COT-F", fornecedorID, pecaID, -30, "Respondida")

	_, err := servico.Emitir(ctx, criado.ID, "gestor01", false)

	assert.ErrorIs(t, err, pedidocompra.ErrCotacoesInsuficientes, "uma data futura contaria para sempre")
}

func TestEmitirAbaixoDoValorNaoExigeCotacoes(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	configurarNegocio(ctx, t, pool, `cotacoes_minimas = 3, valor_exige_cotacoes = 5000.01`)
	criado, _, _ := pedidoEmRascunho(ctx, t, servico, pool)

	_, err := servico.Emitir(ctx, criado.ID, "gestor01", false)

	assert.NoError(t, err, "pedido de 5.000,00 abaixo do gatilho de 5.000,01")
}

func TestEmitirRecusaSeOValorMudouDepoisDaConferencia(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	criado, _, _ := pedidoEmRascunho(ctx, t, servico, pool)

	// Simula a edicao concorrente: entre a leitura do Servico e a escrita, o
	// valor total do pedido muda. A gravacao condicionada nao pode emitir.
	repo := repository.NovoPedidoCompraRepositorio(pool)
	_, err := pool.Exec(ctx, `UPDATE pedidos_compra SET valor_total = 50000 WHERE id = $1`, criado.ID)
	require.NoError(t, err)

	err = repo.Emitir(ctx, criado.ID, criado.ValorTotal, pedidocompra.StatusAguardandoEntrega, "gestor01")

	assert.ErrorIs(t, err, pedidocompra.ErrStatusInvalidoParaAcao)
}

func TestAtualizarRecusaPedidoQueJaSaiuDeRascunho(t *testing.T) {
	ctx := context.Background()
	servico, pool := servicoComBanco(t)
	criado, _, _ := pedidoEmRascunho(ctx, t, servico, pool)
	_, err := pool.Exec(ctx, `UPDATE pedidos_compra SET status = 'Aguardando Entrega' WHERE id = $1`, criado.ID)
	require.NoError(t, err)

	// Direto no repositorio: o Servico confere o status antes, mas a corrida
	// e justamente entre essa conferencia e o UPDATE.
	err = repository.NovoPedidoCompraRepositorio(pool).Atualizar(ctx, criado, "gestor01")

	assert.ErrorIs(t, err, pedidocompra.ErrStatusInvalidoParaAcao)
}
