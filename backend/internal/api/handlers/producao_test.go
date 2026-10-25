package handlers_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidovenda"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/producao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// cenarioProducao: cliente, PA (radar, com metrologia) com BOM de 2 pecas,
// estoque e um centro de trabalho por etapa.
type cenarioProducao struct {
	api                     *apiProtegida
	clienteID, produtoID    int64
	pecaPlaca, pecaGabinete int64
	centros                 map[string]int64
}

func novoCenarioProducao(t *testing.T, exigeMetrologia bool) *cenarioProducao {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)
	grupo := api.echo.Group("/api/v1")
	handlers.NovoPedidoVendaHandler(pedidovenda.NovoServico(repository.NovoPedidoVendaRepositorio(pool))).Registrar(grupo, api.autenticacao())
	handlers.NovoProducaoHandler(producao.NovoServico(repository.NovoProducaoRepositorio(pool))).Registrar(grupo, api.autenticacao())

	c := &cenarioProducao{api: api, centros: map[string]int64{}}
	ctx := t.Context()
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO clientes (tipo, razao_social, cnpj) VALUES ('ORGAO_PUBLICO', 'DER Teste', '11222333000181') RETURNING id`).Scan(&c.clienteID))
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO produtos_acabados (codigo, descricao, unidade_medida, preco_venda, exige_metrologia)
		VALUES ('RAD-200', 'Radar fixo R-200', 'UN', 15000, $1) RETURNING id`, exigeMetrologia).Scan(&c.produtoID))
	for codigo, destino := range map[string]*int64{"PLACA-01": &c.pecaPlaca, "GAB-01": &c.pecaGabinete} {
		require.NoError(t, pool.QueryRow(ctx, `INSERT INTO partes_pecas (codigo, descricao, unidade_medida, estoque_minimo)
			VALUES ($1::varchar, $1::varchar || ' componente', 'UN', 1) RETURNING id`, codigo).Scan(destino))
	}
	// Saldo: placa 10 a R$ 100 (CMP), gabinete so 1 a R$ 50 -- falta para 2 radares.
	_, err := pool.Exec(ctx, `INSERT INTO saldo_estoque (parte_peca_id, quantidade_atual, status, custo_medio) VALUES
		($1, 10, 'OK', 100), ($2, 1, 'CRITICO', 50)`, c.pecaPlaca, c.pecaGabinete)
	require.NoError(t, err)
	var estrutura int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO estrutura_produto (produto_acabado_id, versao, data_vigencia_inicio)
		VALUES ($1, 1, CURRENT_DATE) RETURNING id`, c.produtoID).Scan(&estrutura))
	_, err = pool.Exec(ctx, `INSERT INTO itens_estrutura_produto (estrutura_produto_id, parte_peca_id, quantidade) VALUES ($1, $2, 2), ($1, $3, 1)`,
		estrutura, c.pecaPlaca, c.pecaGabinete)
	require.NoError(t, err)
	for _, etapa := range []string{"SEPARACAO", "MONTAGEM", "TESTES", "EXPEDICAO"} {
		var id int64
		require.NoError(t, pool.QueryRow(ctx, `INSERT INTO centros_trabalho (codigo, nome, etapa, custo_hora) VALUES ('CT-' || $1::varchar, 'CT-' || $1::varchar, $1::varchar, 60) RETURNING id`,
			etapa).Scan(&id))
		c.centros[etapa] = id
	}
	return c
}

func (c *cenarioProducao) criarPedido(t *testing.T, quantidade int) (pedidoID, itemID string) {
	t.Helper()
	rec := c.api.chamar(http.MethodPost, "/api/v1/pedidos-venda", fmt.Sprintf(`{
		"numero_pedido":"PV-001","cliente_id":%d,"data_pedido":%q,"data_entrega_prometida":%q,
		"itens":[{"produto_acabado_id":%d,"quantidade":%d,"preco_unitario":"15000.00"}]}`,
		c.clienteID, dataFutura(0), dataFutura(30), c.produtoID, quantidade), usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	pedido := dados(t, rec)
	assert.Equal(t, "Aberto", pedido["status"])
	assert.Equal(t, "DER Teste", pedido["cliente_nome"])
	item := pedido["itens"].([]any)[0].(map[string]any)
	return formatarID(pedido["id"]), formatarID(item["id"])
}

func (c *cenarioProducao) op(t *testing.T, metodo, rota, corpo string, esperado int) map[string]any {
	t.Helper()
	rec := c.api.chamar(metodo, rota, corpo, usuario.PerfilGestor)
	require.Equal(t, esperado, rec.Code, "%s %s: %s", metodo, rota, rec.Body.String())
	if rec.Code == http.StatusNoContent {
		return nil
	}
	if rec.Code >= 300 {
		return corpoJSON(t, rec)
	}
	return dados(t, rec)
}

// trabalhar faz um apontamento completo na etapa e avanca.
func (c *cenarioProducao) trabalhar(t *testing.T, opID, etapa string) map[string]any {
	t.Helper()
	c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/apontamentos", fmt.Sprintf(`{"centro_trabalho_id":%d}`, c.centros[etapa]), http.StatusOK)
	c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/apontamentos/encerrar", `{}`, http.StatusOK)
	return c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/avancar", ``, http.StatusOK)
}

func TestProducaoFluxoCompleto(t *testing.T) {
	c := novoCenarioProducao(t, true)
	pool := c.api.pool
	pedidoID, itemID := c.criarPedido(t, 2)

	op := c.op(t, http.MethodPost, "/api/v1/ops", `{"item_pedido_venda_id":`+itemID+`}`, http.StatusCreated)
	opID := formatarID(op["id"])
	assert.Equal(t, "Aberta", op["status"])
	assert.Regexp(t, `^OP-\d{4}-\d{5}$`, op["numero_op"])
	c.op(t, http.MethodPost, "/api/v1/ops", `{"item_pedido_venda_id":`+itemID+`}`, http.StatusConflict)

	// Falta gabinete: 409 com a lista, nada reservado.
	falta := c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/liberar", ``, http.StatusConflict)["erro"].(map[string]any)
	assert.Equal(t, handlers.CodigoMaterialInsuficiente, falta["codigo"])
	detalhes := falta["detalhes"].([]any)
	require.Len(t, detalhes, 1)
	assert.Equal(t, "GAB-01", detalhes[0].(map[string]any)["campo"])
	var reservada int
	require.NoError(t, pool.QueryRow(t.Context(), `SELECT quantidade_reservada FROM saldo_estoque WHERE parte_peca_id = $1`, c.pecaPlaca).Scan(&reservada))
	assert.Zero(t, reservada, "tudo ou nada")

	_, err := pool.Exec(t.Context(), `UPDATE saldo_estoque SET quantidade_atual = 5 WHERE parte_peca_id = $1`, c.pecaGabinete)
	require.NoError(t, err)
	op = c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/liberar", ``, http.StatusOK)
	assert.Equal(t, "Liberada", op["status"])
	assert.Equal(t, "Separacao", op["etapa_atual"])
	series := op["series"].([]any)
	require.Len(t, series, 2)
	assert.Regexp(t, `^RAD-200-\d{4}-00001$`, series[0].(map[string]any)["numero"])
	require.NoError(t, pool.QueryRow(t.Context(), `SELECT quantidade_reservada FROM saldo_estoque WHERE parte_peca_id = $1`, c.pecaPlaca).Scan(&reservada))
	assert.Equal(t, 4, reservada)

	// Avancar sem apontamento: recusado. Centro de outra etapa: recusado.
	c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/avancar", ``, http.StatusConflict)
	c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/apontamentos", fmt.Sprintf(`{"centro_trabalho_id":%d}`, c.centros["MONTAGEM"]), http.StatusBadRequest)

	kanban := c.api.chamar(http.MethodGet, "/api/v1/kanban", "", usuario.Perfil("OPERADOR"))
	require.Equal(t, http.StatusOK, kanban.Code)
	assert.Len(t, lista(t, kanban), 1, "OP liberada aparece no Kanban")

	op = c.trabalhar(t, opID, "SEPARACAO")
	assert.Equal(t, "Montagem", op["etapa_atual"])
	var atual, reservadaDepois int
	require.NoError(t, pool.QueryRow(t.Context(), `SELECT quantidade_atual, quantidade_reservada FROM saldo_estoque WHERE parte_peca_id = $1`,
		c.pecaPlaca).Scan(&atual, &reservadaDepois))
	assert.Equal(t, 6, atual, "consumo na saida da Separacao")
	assert.Zero(t, reservadaDepois)

	op = c.trabalhar(t, opID, "MONTAGEM")
	assert.Equal(t, "Testes", op["etapa_atual"])

	// Testes: sem aprovacao nao avanca; reprovar exige resultado.
	c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/apontamentos", fmt.Sprintf(`{"centro_trabalho_id":%d}`, c.centros["TESTES"]), http.StatusOK)
	c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/apontamentos/encerrar", `{}`, http.StatusOK)
	c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/avancar", ``, http.StatusConflict)
	serie1 := formatarID(series[0].(map[string]any)["id"])
	serie2 := formatarID(series[1].(map[string]any)["id"])
	c.op(t, http.MethodPut, "/api/v1/series/"+serie1+"/teste", `{"aprovado":false,"resultado":""}`, http.StatusBadRequest)
	for _, s := range []string{serie1, serie2} {
		c.op(t, http.MethodPut, "/api/v1/series/"+s+"/teste", `{"aprovado":true,"resultado":"Leitura de velocidade conforme"}`, http.StatusNoContent)
	}
	assert.Contains(t, c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/avancar", ``, http.StatusConflict)["erro"].(map[string]any)["mensagem"],
		"metrologia", "radar exige metrologia")
	for i, s := range []string{serie1, serie2} {
		c.op(t, http.MethodPut, "/api/v1/series/"+s+"/metrologia", fmt.Sprintf(`{"numero_aprovacao_modelo":"INMETRO-123",
			"data_verificacao":%q,"numero_lacre":"L-%d","validade":%q}`, dataFutura(0), i, dataFutura(10)), http.StatusNoContent)
	}
	op = c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/avancar", ``, http.StatusOK)
	assert.Equal(t, "Expedicao", op["etapa_atual"])

	op = c.trabalhar(t, opID, "EXPEDICAO")
	assert.Equal(t, "Concluida", op["status"])
	var saldoPA int
	require.NoError(t, pool.QueryRow(t.Context(), `SELECT quantidade_atual FROM saldo_produto_acabado WHERE produto_acabado_id = $1`, c.produtoID).Scan(&saldoPA))
	assert.Equal(t, 2, saldoPA)

	// Custo: orcado = 4 x 100 + 2 x 50 = 500; apontamentos de 1 min a R$ 60/h.
	custo := op["custo"].(map[string]any)
	assert.Equal(t, 500.0, custo["material_orcado"])
	assert.Equal(t, 500.0, custo["material_realizado"])
	assert.Equal(t, false, custo["incompleto"])

	pedido := c.op(t, http.MethodGet, "/api/v1/pedidos-venda/"+pedidoID, ``, http.StatusOK)
	assert.Equal(t, "Pronto para Envio", pedido["status"])
	pedido = c.op(t, http.MethodPost, "/api/v1/pedidos-venda/"+pedidoID+"/entregar", ``, http.StatusOK)
	assert.Equal(t, "Entregue", pedido["status"])
	require.NoError(t, pool.QueryRow(t.Context(), `SELECT quantidade_atual FROM saldo_produto_acabado WHERE produto_acabado_id = $1`, c.produtoID).Scan(&saldoPA))
	assert.Zero(t, saldoPA)

	// Rastreabilidade da unidade.
	numero := series[0].(map[string]any)["numero"].(string)
	ficha := c.op(t, http.MethodGet, "/api/v1/rastreabilidade/"+numero, ``, http.StatusOK)
	assert.Equal(t, "Expedido", ficha["serie"].(map[string]any)["status"])
	assert.Equal(t, "INMETRO-123", ficha["serie"].(map[string]any)["metrologia"].(map[string]any)["numero_aprovacao_modelo"])
	assert.Len(t, ficha["componentes"], 2)
	assert.Len(t, ficha["apontamentos"], 4)

	venc := c.api.chamar(http.MethodGet, "/api/v1/metrologia/vencimentos?dias=30", "", perfilConsulta)
	require.Equal(t, http.StatusOK, venc.Code, venc.Body.String())
	assert.Len(t, lista(t, venc), 2)
}

func TestProducaoCancelarOPDevolveReservaEPedidoVoltaAAberto(t *testing.T) {
	c := novoCenarioProducao(t, false)
	_, err := c.api.pool.Exec(t.Context(), `UPDATE saldo_estoque SET quantidade_atual = 10`)
	require.NoError(t, err)
	pedidoID, itemID := c.criarPedido(t, 1)
	opID := formatarID(c.op(t, http.MethodPost, "/api/v1/ops", `{"item_pedido_venda_id":`+itemID+`}`, http.StatusCreated)["id"])
	c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/liberar", ``, http.StatusOK)

	op := c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/cancelar", ``, http.StatusOK)
	assert.Equal(t, "Cancelada", op["status"])
	var reservada int
	require.NoError(t, c.api.pool.QueryRow(t.Context(), `SELECT sum(quantidade_reservada) FROM saldo_estoque`).Scan(&reservada))
	assert.Zero(t, reservada)
	assert.Equal(t, "Aberto", c.op(t, http.MethodGet, "/api/v1/pedidos-venda/"+pedidoID, ``, http.StatusOK)["status"])

	// O item pode gerar outra OP.
	c.op(t, http.MethodPost, "/api/v1/ops", `{"item_pedido_venda_id":`+itemID+`}`, http.StatusCreated)
}

func TestProducaoPermissoesEValidacoesDoPedido(t *testing.T) {
	c := novoCenarioProducao(t, false)
	_, itemID := c.criarPedido(t, 1)

	assert.Equal(t, http.StatusForbidden,
		c.api.chamar(http.MethodPost, "/api/v1/ops", `{"item_pedido_venda_id":`+itemID+`}`, usuario.Perfil("OPERADOR")).Code)
	assert.Equal(t, http.StatusOK, c.api.chamar(http.MethodGet, "/api/v1/kanban", "", usuario.Perfil("OPERADOR")).Code)
	assert.Equal(t, http.StatusForbidden, c.api.chamar(http.MethodGet, "/api/v1/pedidos-venda", "", usuario.Perfil("OPERADOR")).Code)

	rec := c.api.chamar(http.MethodPost, "/api/v1/pedidos-venda", fmt.Sprintf(`{"numero_pedido":"PV-001","cliente_id":%d,
		"data_pedido":%q,"data_entrega_prometida":%q,"itens":[{"produto_acabado_id":%d,"quantidade":1,"preco_unitario":"10.00"}]}`,
		c.clienteID, dataFutura(0), dataFutura(5), c.produtoID), usuario.Perfil("VENDAS"))
	assert.Equal(t, http.StatusConflict, rec.Code, "numero duplicado")
	rec = c.api.chamar(http.MethodPost, "/api/v1/pedidos-venda", fmt.Sprintf(`{"numero_pedido":"PV-002","cliente_id":%d,
		"data_pedido":%q,"data_entrega_prometida":%q,"itens":[]}`, c.clienteID, dataFutura(0), dataFutura(5)), usuario.PerfilGestor)
	assert.Equal(t, http.StatusBadRequest, rec.Code, "sem itens")
}

func TestProducaoCustoSoComPermissaoEApontamentoSoDoProprioOperador(t *testing.T) {
	c := novoCenarioProducao(t, false)
	_, err := c.api.pool.Exec(t.Context(), `UPDATE saldo_estoque SET quantidade_atual = 10`)
	require.NoError(t, err)
	_, itemID := c.criarPedido(t, 1)
	opID := formatarID(c.op(t, http.MethodPost, "/api/v1/ops", `{"item_pedido_venda_id":`+itemID+`}`, http.StatusCreated)["id"])
	c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/liberar", ``, http.StatusOK)

	rec := c.api.chamar(http.MethodGet, "/api/v1/ops/"+opID, "", perfilConsulta)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.NotContains(t, rec.Body.String(), "custo", "sem producao.custos, nenhum valor de custo")
	assert.Contains(t, c.op(t, http.MethodGet, "/api/v1/ops/"+opID, ``, http.StatusOK), "custo")

	// O operador abre; outro operador nao encerra; o gestor (pode cancelar OP) destrava.
	operador := c.api.usuarioDe(usuario.Perfil("OPERADOR"))
	rec = c.api.chamarComo(operador, http.MethodPost, "/api/v1/ops/"+opID+"/apontamentos", fmt.Sprintf(`{"centro_trabalho_id":%d}`, c.centros["SEPARACAO"]))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	almox := c.api.usuarioDe(usuario.Perfil("ALMOXARIFE"))
	rec = c.api.chamarComo(almox, http.MethodPost, "/api/v1/ops/"+opID+"/apontamentos/encerrar", `{}`)
	assert.Equal(t, http.StatusConflict, rec.Code, "apontamento de outra pessoa")
	c.op(t, http.MethodPost, "/api/v1/ops/"+opID+"/apontamentos/encerrar", `{}`, http.StatusOK)
}
