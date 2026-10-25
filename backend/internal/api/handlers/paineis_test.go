package handlers_test

import (
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/painel"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Cenario dos paineis, com os numeros esperados conferidos a mao. Datas
// relativas a hoje (CURRENT_DATE) para o teste nao envelhecer.
const sqlCenarioPaineis = `
INSERT INTO fornecedores (id, razao_social, cnpj, lead_time_medio) VALUES
  (9001, 'Forn A', '11222333000181', 5), (9002, 'Forn B', '45723174000110', 5);
INSERT INTO pedidos_compra (id, numero_pc, fornecedor_id, data_pedido, data_entrega_prevista, valor_total, status) VALUES
  (9101, 'PNL-1', 9001, CURRENT_DATE - 20, CURRENT_DATE - 5, 100, 'Aguardando Entrega'),
  (9102, 'PNL-2', 9002, CURRENT_DATE - 3, CURRENT_DATE + 10, 200, 'Emitido'),
  (9103, 'PNL-3', 9001, CURRENT_DATE - 30, CURRENT_DATE - 10, 300, 'Concluido'),
  (9104, 'PNL-4', 9002, CURRENT_DATE - 40, CURRENT_DATE - 20, 400, 'Concluido'),
  (9105, 'PNL-5', 9002, CURRENT_DATE - 2, CURRENT_DATE + 20, 50, 'Rascunho');
INSERT INTO notas_fiscais_entrada (pedido_compra_id, fornecedor_id, cnpj_emitente, modelo, serie, numero, data_emissao,
  data_entrada, cfop, status, valor_total, efetivada_em) VALUES
  (9103, 9001, '11222333000181', '01', '1', '901', CURRENT_DATE - 12, CURRENT_DATE - 12, '1102', 'Efetivada', 300, CURRENT_DATE - 12),
  (9104, 9002, '45723174000110', '01', '1', '902', CURRENT_DATE - 15, CURRENT_DATE - 15, '1102', 'Efetivada', 400, CURRENT_DATE - 15),
  (9101, 9001, '11222333000181', '01', '1', '903', CURRENT_DATE - 1, CURRENT_DATE - 1, '1102', 'Rascunho', 100, NULL);

INSERT INTO partes_pecas (id, codigo, descricao, unidade_medida, controla_lote, controla_validade) VALUES
  (9201, 'PNL-PECA', 'Peca do painel', 'UN', TRUE, TRUE);
INSERT INTO saldo_estoque (parte_peca_id, quantidade_atual, status, custo_medio) VALUES (9201, 10, 'CRITICO', 5);
INSERT INTO lotes (parte_peca_id, numero_lote, validade, quantidade_atual) VALUES
  (9201, 'L-VENC', CURRENT_DATE - 2, 5), (9201, 'L-20D', CURRENT_DATE + 20, 5), (9201, 'L-ZERO', CURRENT_DATE + 5, 0);

INSERT INTO produtos_acabados (id, codigo, descricao, unidade_medida, preco_venda) VALUES (9301, 'PNL-RADAR', 'Radar', 'UN', 1000);
INSERT INTO estrutura_produto (id, produto_acabado_id, versao, data_vigencia_inicio) VALUES (9311, 9301, 1, CURRENT_DATE);
INSERT INTO clientes (id, tipo, razao_social, cnpj) VALUES (9401, 'ORGAO_PUBLICO', 'Cliente X', '45723174000110');
INSERT INTO pedidos_venda (id, numero_pedido, cliente_id, data_pedido, data_entrega_prometida, data_entrega_real, valor_total, status) VALUES
  (9501, 'PNL-PV1', 9401, CURRENT_DATE - 30, CURRENT_DATE - 5, CURRENT_DATE - 6, 1000, 'Entregue'),
  (9502, 'PNL-PV2', 9401, CURRENT_DATE - 30, CURRENT_DATE - 10, CURRENT_DATE - 8, 500, 'Entregue'),
  (9503, 'PNL-PV3', 9401, CURRENT_DATE - 20, CURRENT_DATE - 1, NULL, 700, 'Em Producao'),
  (9504, 'PNL-PV4', 9401, CURRENT_DATE - 2, CURRENT_DATE + 10, NULL, 300, 'Aberto');
INSERT INTO itens_pedido_venda (id, pedido_venda_id, produto_acabado_id, quantidade, preco_unitario, total) VALUES
  (9601, 9503, 9301, 1, 700, 700), (9602, 9503, 9301, 1, 700, 700), (9603, 9503, 9301, 1, 700, 700),
  (9604, 9503, 9301, 1, 700, 700);
INSERT INTO ordens_producao (id, numero_op, item_pedido_venda_id, produto_acabado_id, quantidade, estrutura_produto_id,
  data_conclusao_prevista, status, etapa_atual, data_liberacao, data_conclusao_real) VALUES
  (9701, 'PNL-OP1', 9601, 9301, 1, 9311, CURRENT_DATE - 1, 'Aberta', 'Separacao', NULL, NULL),
  (9702, 'PNL-OP2', 9602, 9301, 1, 9311, CURRENT_DATE + 5, 'Liberada', 'Montagem', CURRENT_DATE - 2, NULL),
  (9703, 'PNL-OP3', 9603, 9301, 3, 9311, CURRENT_DATE + 1, 'Concluida', 'Expedicao', CURRENT_DATE - 10, CURRENT_DATE - 4),
  -- Liberada as 18h e concluida no mesmo dia: lead time 0, nunca negativo.
  (9704, 'PNL-OP4', 9604, 9301, 1, 9311, CURRENT_DATE + 1, 'Concluida', 'Expedicao', CURRENT_DATE + interval '18 hours', CURRENT_DATE);
INSERT INTO centros_trabalho (id, codigo, nome, etapa) VALUES (9801, 'PNL-MON', 'Bancada PNL', 'MONTAGEM');
INSERT INTO apontamento_producao (ordem_producao_id, etapa, tempo_inicio, tempo_fim, duracao_minutos, centro_trabalho_id) VALUES
  (9703, 'Montagem', CURRENT_DATE - 6, CURRENT_DATE - 6 + interval '2 hours', 120, 9801);
INSERT INTO numeros_serie (id, numero, ordem_producao_id, produto_acabado_id, status, testado_em) VALUES
  (9901, 'PNL-S1', 9703, 9301, 'Aprovado', CURRENT_DATE - 4),
  (9902, 'PNL-S2', 9703, 9301, 'Reprovado', CURRENT_DATE - 4),
  (9903, 'PNL-S3', 9703, 9301, 'Em Estoque', CURRENT_DATE - 3);
INSERT INTO metrologia_serie (numero_serie_id, numero_aprovacao_modelo, data_verificacao, numero_lacre, validade) VALUES
  (9901, 'INM-1', CURRENT_DATE - 300, 'L1', CURRENT_DATE + 10),
  (9903, 'INM-1', CURRENT_DATE - 400, 'L3', CURRENT_DATE - 1);
`

func apiPaineis(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)
	handlers.NovoPainelHandler(painel.NovoServico(repository.NovoPainelRepositorio(pool))).Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	_, err := pool.Exec(t.Context(), sqlCenarioPaineis)
	require.NoError(t, err)
	return api
}

func pontosDe(t *testing.T, v any) map[string]float64 {
	t.Helper()
	m := map[string]float64{}
	for _, p := range v.([]any) {
		ponto := p.(map[string]any)
		m[ponto["rotulo"].(string)] = ponto["valor"].(float64)
	}
	return m
}

func painelDe(t *testing.T, api *apiProtegida, rota string, perfil usuario.Perfil) map[string]any {
	t.Helper()
	rec := api.chamar(http.MethodGet, rota, "", perfil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	return dados(t, rec)
}

func TestPainelDeCompras(t *testing.T) {
	api := apiPaineis(t)
	c := painelDe(t, api, "/api/v1/paineis/compras?dias=90", usuario.PerfilGestor)
	assert.Equal(t, 2.0, c["em_aberto"])
	assert.Equal(t, 300.0, c["valor_em_aberto"])
	assert.Equal(t, 1.0, c["em_atraso"])
	assert.InDelta(t, 21.5, c["lead_time_medio_dias"], 0.01, "(18 + 25) / 2")
	assert.InDelta(t, 50.0, c["recebido_no_prazo_pct"], 0.01)
	assert.Equal(t, map[string]float64{"Forn A": 1}, pontosDe(t, c["atrasos_por_fornecedor"]))
	assert.Equal(t, map[string]float64{"Forn B": 25, "Forn A": 18}, pontosDe(t, c["lead_time_por_fornecedor"]))
	total := 0.0
	for _, v := range pontosDe(t, c["comprado_por_mes"]) {
		total += v
	}
	assert.Equal(t, 1000.0, total, "rascunho fica fora do comprado")
	assert.GreaterOrEqual(t, len(c["comprado_por_mes"].([]any)), 6, "no minimo 6 meses")
}

func TestPainelDeEstoqueEscondeCustoSemPermissao(t *testing.T) {
	api := apiPaineis(t)
	e := painelDe(t, api, "/api/v1/paineis/estoque", usuario.PerfilGestor)
	assert.Equal(t, 50.0, e["valor_em_estoque"])
	assert.Equal(t, 1.0, e["itens_criticos"])
	assert.Equal(t, 1.0, e["notas_pendentes"])
	assert.Equal(t, 1.0, e["lotes_vencidos"])
	assert.Equal(t, 1.0, e["lotes_a_vencer_30"])
	assert.Equal(t, map[string]float64{"Vencidos": 1, "Até 30 dias": 1, "31 a 60 dias": 0, "61 a 90 dias": 0},
		pontosDe(t, e["lotes_por_vencimento"]))

	almox := painelDe(t, api, "/api/v1/paineis/estoque", usuario.Perfil("ALMOXARIFE"))
	assert.Nil(t, almox["valor_em_estoque"], "sem producao.custos")
	assert.NotContains(t, almox, "top_valor_em_estoque")
}

func TestPainelDeProducao(t *testing.T) {
	api := apiPaineis(t)
	p := painelDe(t, api, "/api/v1/paineis/producao", usuario.PerfilGestor)
	assert.Equal(t, 1.0, p["abertas"])
	assert.Equal(t, 1.0, p["liberadas"])
	assert.Equal(t, 2.0, p["concluidas_periodo"])
	assert.Equal(t, 1.0, p["em_atraso"])
	assert.InDelta(t, 3.0, p["lead_time_medio_dias"], 0.01, "(6 + 0) / 2: mesmo dia conta 0")
	assert.InDelta(t, 2.0, p["horas_apontadas"], 0.01)
	assert.Equal(t, map[string]float64{"Aberta": 1, "Separacao": 0, "Montagem": 1, "Testes": 0, "Expedicao": 0},
		pontosDe(t, p["por_etapa"]))
	assert.Equal(t, map[string]float64{"Bancada PNL": 2}, pontosDe(t, p["horas_por_centro"]))
	assert.Equal(t, map[string]float64{"PNL-RADAR": 1}, pontosDe(t, p["atraso_por_produto"]))
}

func TestPainelDeVendas(t *testing.T) {
	api := apiPaineis(t)
	v := painelDe(t, api, "/api/v1/paineis/vendas", usuario.PerfilGestor)
	assert.Equal(t, 1000.0, v["carteira"], "em producao 700 + aberto 300")
	assert.Equal(t, 1.0, v["em_atraso"])
	assert.Equal(t, 1500.0, v["entregue_periodo"])
	assert.InDelta(t, 50.0, v["otd_pct"], 0.01)
	assert.Equal(t, map[string]float64{"Cliente X": 1500}, pontosDe(t, v["principais_clientes"]))
}

func TestPainelDeQualidade(t *testing.T) {
	api := apiPaineis(t)
	q := painelDe(t, api, "/api/v1/paineis/qualidade", usuario.PerfilGestor)
	assert.Equal(t, 3.0, q["testadas"])
	assert.Equal(t, 2.0, q["aprovadas"])
	assert.Equal(t, 1.0, q["reprovadas"])
	assert.InDelta(t, 66.67, q["taxa_aprovacao_pct"], 0.01)
	assert.Equal(t, 1.0, q["metrologia_vencida"])
	assert.Equal(t, 1.0, q["metrologia_a_vencer_30"])
	assert.Equal(t, map[string]float64{"PNL-RADAR": 1}, pontosDe(t, q["reprovacoes_por_produto"]))
}

func TestPaineisRespeitamAPermissaoDeCadaSetor(t *testing.T) {
	api := apiPaineis(t)
	operador := usuario.Perfil("OPERADOR")
	assert.Equal(t, http.StatusForbidden, api.chamar(http.MethodGet, "/api/v1/paineis/compras", "", operador).Code)
	assert.Equal(t, http.StatusOK, api.chamar(http.MethodGet, "/api/v1/paineis/producao", "", operador).Code)

	// Painel inicial: so os blocos dos modulos que o perfil ve.
	ini := painelDe(t, api, "/api/v1/paineis/inicio", operador)
	assert.Contains(t, ini, "producao")
	assert.NotContains(t, ini, "compras")
	assert.NotContains(t, ini, "vendas")
	producao := ini["producao"].(map[string]any)
	assert.Equal(t, 1.0, producao["ops_em_atraso"])
	assert.Equal(t, 1.0, producao["metrologia_a_vencer_30"])

	gestor := painelDe(t, api, "/api/v1/paineis/inicio", usuario.PerfilGestor)
	assert.Equal(t, 1.0, gestor["compras"].(map[string]any)["pcs_em_atraso"])
	assert.Equal(t, 1.0, gestor["notas"].(map[string]any)["pendentes"])
	assert.Equal(t, 1.0, gestor["vendas"].(map[string]any)["em_producao"])
}
