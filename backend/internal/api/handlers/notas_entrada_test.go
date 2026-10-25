package handlers_test

import (
	"bytes"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/notaentrada"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// chaveValida monta uma chave de acesso de 44 digitos com DV correto.
func chaveValida(numero int) string {
	base := fmt.Sprintf("3126101122233300018155001%09d1%08d", numero, numero)[:43]
	for dv := '0'; dv <= '9'; dv++ {
		if notaentrada.ChaveAcessoValida(base + string(dv)) {
			return base + string(dv)
		}
	}
	panic("sem DV")
}

// cenarioNota: fornecedor, 3 pecas (lote+validade, serie com mascara, simples
// em caixa de 100) e um PC aguardando entrega.
type cenarioNota struct {
	api                         *apiProtegida
	pcID                        int64
	itensPC                     map[string]int64
	pecaLote, pecaSerie, pecaCx int64
}

func novoCenarioNota(t *testing.T) *cenarioNota {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)
	handlers.NovoNotaEntradaHandler(notaentrada.NovoServico(repository.NovoNotaEntradaRepositorio(pool))).
		Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	c := &cenarioNota{api: api, itensPC: map[string]int64{}}
	ctx := t.Context()
	var fornecedor int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO fornecedores (razao_social, cnpj, lead_time_medio)
		VALUES ('Eletronica Fornecedora', '11222333000181', 5) RETURNING id`).Scan(&fornecedor))
	pecas := []struct {
		codigo string
		sql    string
		dest   *int64
	}{
		{"PLACA", "controla_lote, controla_validade, validade_minima_dias) VALUES ($1, 'Placa controladora', 'UN', TRUE, TRUE, 30)", &c.pecaLote},
		{"CONECTOR", "controla_numero_serie, mascara_serie) VALUES ($1, 'Conector serial', 'UN', TRUE, 'SN-\\d{4}')", &c.pecaSerie},
		{"PARAFUSO", "estoque_minimo) VALUES ($1, 'Parafuso M3', 'UN', 10)", &c.pecaCx},
	}
	for _, p := range pecas {
		require.NoError(t, pool.QueryRow(ctx, `INSERT INTO partes_pecas (codigo, descricao, unidade_medida, `+p.sql+` RETURNING id`,
			p.codigo).Scan(p.dest))
		_, err := pool.Exec(ctx, `INSERT INTO saldo_estoque (parte_peca_id, status) VALUES ($1, 'CRITICO')`, *p.dest)
		require.NoError(t, err)
	}
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO pedidos_compra (numero_pc, fornecedor_id, data_pedido, data_entrega_prevista,
		valor_total, status) VALUES ('PC-NF-1', $1, CURRENT_DATE - 10, CURRENT_DATE + 10, 1000, 'Aguardando Entrega') RETURNING id`,
		fornecedor).Scan(&c.pcID))
	for codigo, linha := range map[string][3]any{"PLACA": {c.pecaLote, 10, "50.00"}, "CONECTOR": {c.pecaSerie, 3, "20.00"}, "PARAFUSO": {c.pecaCx, 1000, "0.10"}} {
		var id int64
		require.NoError(t, pool.QueryRow(ctx, `INSERT INTO itens_pedido_compra (pedido_compra_id, parte_peca_id, quantidade_solicitada,
			preco_unitario, total) VALUES ($1, $2, $3::int, $4::numeric, $3::int * $4::numeric) RETURNING id`, c.pcID, linha[0], linha[1], linha[2]).Scan(&id))
		c.itensPC[codigo] = id
	}
	return c
}

func (c *cenarioNota) corpo(t *testing.T, numero int, seriesConector string) string {
	return fmt.Sprintf(`{
	  "pedido_compra_id": %d, "cnpj_emitente": "11.222.333/0001-81", "modelo": "55", "serie": "1", "numero": "%d",
	  "chave_acesso": %q, "data_emissao": %q, "data_entrada": %q, "cfop": "1102",
	  "valor_produtos": "650.00", "valor_frete": "65.00", "valor_total": "715.00",
	  "itens": [
	    {"item_pedido_compra_id": %d, "parte_peca_id": %d, "quantidade_nf": 10, "valor_unitario": 50, "valor_total": "500.00",
	     "quantidade_recebida": 10, "lotes": [{"numero_lote": "L-A", "quantidade": 6, "validade": %q}, {"numero_lote": "L-B", "quantidade": 4, "validade": %q}]},
	    {"item_pedido_compra_id": %d, "parte_peca_id": %d, "quantidade_nf": 3, "valor_unitario": 20, "valor_total": "60.00",
	     "quantidade_recebida": 3, "series": [%s]},
	    {"item_pedido_compra_id": %d, "parte_peca_id": %d, "codigo_fornecedor": "CX-M3", "unidade_nf": "CX", "quantidade_nf": 9,
	     "fator_conversao": 100, "valor_unitario": 10, "valor_total": "90.00", "quantidade_recebida": 900}
	  ]}`, c.pcID, numero, chaveValida(numero), dataFutura(-2), dataFutura(0),
		c.itensPC["PLACA"], c.pecaLote, dataFutura(200), dataFutura(300),
		c.itensPC["CONECTOR"], c.pecaSerie, seriesConector,
		c.itensPC["PARAFUSO"], c.pecaCx)
}

func (c *cenarioNota) chamar(t *testing.T, metodo, rota, corpo string, perfil usuario.Perfil, esperado int) map[string]any {
	t.Helper()
	rec := c.api.chamar(metodo, rota, corpo, perfil)
	require.Equal(t, esperado, rec.Code, "%s %s: %s", metodo, rota, rec.Body.String())
	if rec.Code >= 300 {
		return corpoJSON(t, rec)
	}
	if rec.Code == http.StatusNoContent {
		return nil
	}
	return dados(t, rec)
}

func saldo(t *testing.T, c *cenarioNota, peca int64) (int, float64) {
	t.Helper()
	var q int
	var cmp float64
	require.NoError(t, c.api.pool.QueryRow(t.Context(), `SELECT quantidade_atual, custo_medio::float8 FROM saldo_estoque WHERE parte_peca_id = $1`, peca).Scan(&q, &cmp))
	return q, cmp
}

func TestNotaEntradaRascunhoConferenciaEfetivacaoEEstorno(t *testing.T) {
	c := novoCenarioNota(t)

	// Rascunho com 2 de 3 series: salva, mas a conferencia acusa.
	nota := c.chamar(t, http.MethodPost, "/api/v1/notas-entrada", c.corpo(t, 101, `{"numero":"SN-0001"},{"numero":"SN-0002"}`),
		usuario.Perfil("ALMOXARIFE"), http.StatusCreated)
	id := formatarID(nota["id"])
	assert.Equal(t, "Rascunho", nota["status"])
	erro := c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/conferir", ``, usuario.Perfil("ALMOXARIFE"), http.StatusConflict)["erro"].(map[string]any)
	assert.Equal(t, handlers.CodigoPendencias, erro["codigo"])
	assert.Contains(t, fmt.Sprint(erro["detalhes"]), "2 de 3 series")

	// Serie fora da mascara tambem e pendencia; corrigida, a nota confere.
	c.chamar(t, http.MethodPut, "/api/v1/notas-entrada/"+id, c.corpo(t, 101, `{"numero":"SN-0001"},{"numero":"SN-0002"},{"numero":"X-9"}`),
		usuario.Perfil("ALMOXARIFE"), http.StatusOK)
	erro = c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/conferir", ``, usuario.Perfil("ALMOXARIFE"), http.StatusConflict)["erro"].(map[string]any)
	assert.Contains(t, fmt.Sprint(erro["detalhes"]), "fora do formato")
	c.chamar(t, http.MethodPut, "/api/v1/notas-entrada/"+id, c.corpo(t, 101, `{"numero":"SN-0001"},{"numero":"SN-0002"},{"numero":"SN-0003"}`),
		usuario.Perfil("ALMOXARIFE"), http.StatusOK)
	nota = c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/conferir", ``, usuario.Perfil("ALMOXARIFE"), http.StatusOK)
	assert.Equal(t, "Conferida", nota["status"])

	// Rascunho nao move estoque; a efetivacao move tudo de uma vez.
	q, _ := saldo(t, c, c.pecaLote)
	assert.Zero(t, q)
	nota = c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/efetivar", ``, usuario.Perfil("ALMOXARIFE"), http.StatusOK)
	assert.Equal(t, "Efetivada", nota["status"])

	q, cmp := saldo(t, c, c.pecaLote)
	assert.Equal(t, 10, q)
	// 500 + rateio do frete (65 x 500/650 = 50) = 550 / 10 = 55,00.
	assert.InDelta(t, 55.0, cmp, 0.001)
	q, cmp = saldo(t, c, c.pecaCx)
	assert.Equal(t, 900, q, "9 caixas x 100 (de-para/fator)")
	assert.InDelta(t, 0.11, cmp, 0.0001, "(90 + rateio do frete 9) / 900")

	var lotes, series int
	require.NoError(t, c.api.pool.QueryRow(t.Context(), `SELECT count(*) FROM lotes WHERE parte_peca_id = $1 AND quantidade_atual > 0`, c.pecaLote).Scan(&lotes))
	require.NoError(t, c.api.pool.QueryRow(t.Context(), `SELECT count(*) FROM series_componente WHERE parte_peca_id = $1 AND status = 'Em Estoque'`, c.pecaSerie).Scan(&series))
	assert.Equal(t, 2, lotes)
	assert.Equal(t, 3, series)
	var statusPC string
	require.NoError(t, c.api.pool.QueryRow(t.Context(), `SELECT status FROM pedidos_compra WHERE id = $1`, c.pcID).Scan(&statusPC))
	assert.Equal(t, "Recebido Parcial", statusPC, "parafuso: 900 de 1000")
	var docs int
	require.NoError(t, c.api.pool.QueryRow(t.Context(), `SELECT count(*) FROM movimentacao_estoque WHERE documento_tipo = 'NOTA_ENTRADA' AND documento_id = $1`,
		nota["id"]).Scan(&docs))
	assert.Equal(t, 4, docs, "um movimento por lote + 1 por item sem lote")

	// Nota efetivada e imutavel; a mesma chave nao entra de novo.
	c.chamar(t, http.MethodPut, "/api/v1/notas-entrada/"+id, c.corpo(t, 101, `{"numero":"SN-0001"}`), usuario.PerfilGestor, http.StatusConflict)
	c.chamar(t, http.MethodPost, "/api/v1/notas-entrada", c.corpo(t, 101, `{"numero":"SN-0009"}`), usuario.PerfilGestor, http.StatusConflict)

	// Estorno: sem permissao (almoxarife) nao; com material intacto, volta tudo.
	c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/estornar", `{"motivo":"nota lancada no pedido errado"}`, usuario.Perfil("ALMOXARIFE"), http.StatusForbidden)
	nota = c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/estornar", `{"motivo":"nota lancada no pedido errado"}`, usuario.PerfilGestor, http.StatusOK)
	assert.Equal(t, "Estornada", nota["status"])
	q, _ = saldo(t, c, c.pecaLote)
	assert.Zero(t, q)
	require.NoError(t, c.api.pool.QueryRow(t.Context(), `SELECT count(*) FROM series_componente WHERE parte_peca_id = $1`, c.pecaSerie).Scan(&series))
	assert.Zero(t, series)
	require.NoError(t, c.api.pool.QueryRow(t.Context(), `SELECT status FROM pedidos_compra WHERE id = $1`, c.pcID).Scan(&statusPC))
	assert.Equal(t, "Aguardando Entrega", statusPC)
}

func TestNotaEntradaEstornoBloqueadoComMaterialReservado(t *testing.T) {
	c := novoCenarioNota(t)
	id := formatarID(c.chamar(t, http.MethodPost, "/api/v1/notas-entrada", c.corpo(t, 202, `{"numero":"SN-0001"},{"numero":"SN-0002"},{"numero":"SN-0003"}`),
		usuario.PerfilGestor, http.StatusCreated)["id"])
	c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/conferir", ``, usuario.PerfilGestor, http.StatusOK)
	c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/efetivar", ``, usuario.PerfilGestor, http.StatusOK)
	_, err := c.api.pool.Exec(t.Context(), `UPDATE saldo_estoque SET quantidade_reservada = 1 WHERE parte_peca_id = $1`, c.pecaCx)
	require.NoError(t, err)

	c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/estornar", `{"motivo":"teste de bloqueio do estorno"}`, usuario.PerfilGestor, http.StatusConflict)
}

func TestNotaEntradaDivergenciaDePrecoBloqueiaOuExigeAprovacao(t *testing.T) {
	c := novoCenarioNota(t)
	caro := strings.Replace(c.corpo(t, 303, `{"numero":"SN-0001"},{"numero":"SN-0002"},{"numero":"SN-0003"}`),
		`"valor_unitario": 50, "valor_total": "500.00"`, `"valor_unitario": 60, "valor_total": "600.00"`, 1)
	caro = strings.Replace(caro, `"valor_produtos": "650.00", "valor_frete": "65.00", "valor_total": "715.00"`,
		`"valor_produtos": "750.00", "valor_frete": "65.00", "valor_total": "815.00"`, 1)
	id := formatarID(c.chamar(t, http.MethodPost, "/api/v1/notas-entrada", caro, usuario.PerfilGestor, http.StatusCreated)["id"])
	erro := c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/conferir", ``, usuario.PerfilGestor, http.StatusConflict)["erro"].(map[string]any)
	assert.Contains(t, fmt.Sprint(erro["detalhes"]), "[BLOQUEIO] preco unitario")

	_, err := c.api.pool.Exec(t.Context(), `UPDATE configuracao_negocio SET divergencia_preco_acao = 'APROVAR', tolerancia_preco_pct = 5`)
	require.NoError(t, err)
	c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/conferir", ``, usuario.PerfilGestor, http.StatusOK)
	erro = c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/efetivar", ``, usuario.Perfil("ALMOXARIFE"), http.StatusConflict)["erro"].(map[string]any)
	assert.Contains(t, erro["mensagem"], "aprove divergencias")
	nota := c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/efetivar", ``, usuario.PerfilGestor, http.StatusOK)
	assert.Equal(t, "gestor01", nota["divergencia_aprovada_por"])
}

func TestNotaEntradaRegrasDeCabecalhoEBonificacao(t *testing.T) {
	c := novoCenarioNota(t)
	corpo := c.corpo(t, 404, `{"numero":"SN-0001"},{"numero":"SN-0002"},{"numero":"SN-0003"}`)
	errado := strings.Replace(corpo, `"cnpj_emitente": "11.222.333/0001-81"`, `"cnpj_emitente": "45723174000110"`, 1)
	errado = strings.Replace(errado, `"cfop": "1102"`, `"cfop": "5102"`, 1)
	id := formatarID(c.chamar(t, http.MethodPost, "/api/v1/notas-entrada", errado, usuario.PerfilGestor, http.StatusCreated)["id"])
	pend := c.api.chamar(http.MethodGet, "/api/v1/notas-entrada/"+id+"/pendencias", "", perfilConsulta)
	require.Equal(t, http.StatusOK, pend.Code)
	texto := pend.Body.String()
	assert.Contains(t, texto, "CNPJ do emitente")
	assert.Contains(t, texto, "CFOP")

	// Chave com DV errado nem salva.
	ruim := strings.Replace(corpo, chaveValida(404), chaveValida(404)[:43]+"0", 1)
	if ruim != corpo {
		c.chamar(t, http.MethodPost, "/api/v1/notas-entrada", strings.Replace(ruim, `"numero": "404"`, `"numero": "405"`, 1), usuario.PerfilGestor, http.StatusBadRequest)
	}

	// Item fora do PC so como bonificacao, com justificativa.
	bonus := strings.Replace(corpo, fmt.Sprintf(`{"item_pedido_compra_id": %d, "parte_peca_id": %d, "codigo_fornecedor"`, c.itensPC["PARAFUSO"], c.pecaCx),
		fmt.Sprintf(`{"bonificacao": true, "justificativa_bonificacao": "brinde da promocao", "parte_peca_id": %d, "codigo_fornecedor"`, c.pecaCx), 1)
	bonus = strings.Replace(bonus, `"numero": "404"`, `"numero": "406"`, 1)
	bonus = strings.Replace(bonus, chaveValida(404), chaveValida(406), 1)
	id = formatarID(c.chamar(t, http.MethodPost, "/api/v1/notas-entrada", bonus, usuario.PerfilGestor, http.StatusCreated)["id"])
	c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/conferir", ``, usuario.PerfilGestor, http.StatusOK)
	c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/efetivar", ``, usuario.PerfilGestor, http.StatusOK)
	var recebidaPC int
	require.NoError(t, c.api.pool.QueryRow(t.Context(), `SELECT quantidade_recebida FROM itens_pedido_compra WHERE id = $1`, c.itensPC["PARAFUSO"]).Scan(&recebidaPC))
	assert.Zero(t, recebidaPC, "bonificacao nao mexe no saldo do PC")
}

func TestNotaEntradaDeParaPorFornecedor(t *testing.T) {
	c := novoCenarioNota(t)
	var fornecedor int64
	require.NoError(t, c.api.pool.QueryRow(t.Context(), `SELECT fornecedor_id FROM pedidos_compra WHERE id = $1`, c.pcID).Scan(&fornecedor))
	rota := fmt.Sprintf("/api/v1/fornecedores/%d/de-para", fornecedor)
	salvo := c.chamar(t, http.MethodPost, rota, fmt.Sprintf(`{"parte_peca_id":%d,"codigo_fornecedor":"CX-M3","unidade_fornecedor":"CX","fator_conversao":100}`, c.pecaCx),
		usuario.PerfilGestor, http.StatusOK)
	assert.Equal(t, "PARAFUSO", salvo["peca_codigo"])
	// Mesmo codigo: atualiza (nao duplica).
	c.chamar(t, http.MethodPost, rota, fmt.Sprintf(`{"parte_peca_id":%d,"codigo_fornecedor":"CX-M3","fator_conversao":50}`, c.pecaCx), usuario.PerfilGestor, http.StatusOK)
	rec := c.api.chamar(http.MethodGet, rota, "", perfilConsulta)
	require.Equal(t, http.StatusOK, rec.Code)
	itens := lista(t, rec)
	require.Len(t, itens, 1)
	assert.Equal(t, 50.0, itens[0].(map[string]any)["fator_conversao"])
}

func TestAjusteDeItemRastreadoExigeLoteESeries(t *testing.T) {
	c := novoCenarioNota(t)
	handlers.NovoEstoqueHandler(estoque.NovoServico(repository.NovoEstoqueRepositorio(c.api.pool))).
		Registrar(c.api.echo.Group("/api/v1"), c.api.autenticacao())
	ajustar := func(corpo string, esperado int) {
		t.Helper()
		rec := c.api.chamar(http.MethodPost, "/api/v1/estoque/ajuste", corpo, usuario.PerfilGestor)
		require.Equal(t, esperado, rec.Code, rec.Body.String())
	}
	// Inventario de abertura de item com lote: sem lote, recusado.
	ajustar(fmt.Sprintf(`{"parte_peca_id":%d,"quantidade":5,"motivo":"Inventario de abertura"}`, c.pecaLote), http.StatusBadRequest)
	ajustar(fmt.Sprintf(`{"parte_peca_id":%d,"quantidade":5,"motivo":"Inventario de abertura","lote":{"numero_lote":"INV-1","validade":%q}}`,
		c.pecaLote, dataFutura(100)), http.StatusCreated)
	ajustar(fmt.Sprintf(`{"parte_peca_id":%d,"quantidade":-6,"motivo":"Perda","lote":{"numero_lote":"INV-1"}}`, c.pecaLote), http.StatusConflict)

	// Item com serie: uma serie por unidade, no formato; a saida sucateia.
	ajustar(fmt.Sprintf(`{"parte_peca_id":%d,"quantidade":2,"motivo":"Inventario de abertura","series":["SN-0100"]}`, c.pecaSerie), http.StatusBadRequest)
	ajustar(fmt.Sprintf(`{"parte_peca_id":%d,"quantidade":2,"motivo":"Inventario de abertura","series":["SN-0100","SN-0101"]}`, c.pecaSerie), http.StatusCreated)
	ajustar(fmt.Sprintf(`{"parte_peca_id":%d,"quantidade":-1,"motivo":"Avaria","series":["SN-0101"]}`, c.pecaSerie), http.StatusCreated)
	var status string
	require.NoError(t, c.api.pool.QueryRow(t.Context(), `SELECT status FROM series_componente WHERE numero = 'SN-0101'`).Scan(&status))
	assert.Equal(t, "Sucateado", status)
}

const xmlNFeExemplo = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
 <NFe><infNFe Id="NFe%s" versao="4.00">
  <ide><mod>55</mod><serie>1</serie><nNF>777</nNF><dhEmi>%sT09:30:00-03:00</dhEmi></ide>
  <emit><CNPJ>11222333000181</CNPJ><xNome>Eletronica Fornecedora</xNome></emit>
  <det nItem="1"><prod><cProd>CX-M3</cProd><xProd>PARAFUSO M3 CX C/100</xProd><CFOP>5102</CFOP><uCom>CX</uCom>
   <qCom>2.0000</qCom><vUnCom>10.0000</vUnCom><vProd>20.00</vProd></prod></det>
  <det nItem="2"><prod><cProd>PL-778</cProd><xProd>PLACA CONTROLADORA</xProd><CFOP>5102</CFOP><uCom>UN</uCom>
   <qCom>4.0000</qCom><vUnCom>50.0000</vUnCom><vProd>200.00</vProd>
   <rastro><nLote>LX-1</nLote><qLote>4.000</qLote><dFab>2026-09-01</dFab><dVal>2027-09-01</dVal></rastro></prod></det>
  <total><ICMSTot><vProd>220.00</vProd><vFrete>11.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vIPI>0.00</vIPI><vST>0.00</vST><vNF>231.00</vNF></ICMSTot></total>
 </infNFe></NFe>
 <protNFe><infProt><chNFe>%s</chNFe></infProt></protNFe>
</nfeProc>`

func TestNotaEntradaImportaXMLComDeParaMemorizado(t *testing.T) {
	c := novoCenarioNota(t)
	var fornecedor int64
	require.NoError(t, c.api.pool.QueryRow(t.Context(), `SELECT fornecedor_id FROM pedidos_compra WHERE id = $1`, c.pcID).Scan(&fornecedor))
	c.chamar(t, http.MethodPost, fmt.Sprintf("/api/v1/fornecedores/%d/de-para", fornecedor),
		fmt.Sprintf(`{"parte_peca_id":%d,"codigo_fornecedor":"CX-M3","unidade_fornecedor":"CX","fator_conversao":100}`, c.pecaCx), usuario.PerfilGestor, http.StatusOK)

	chave := chaveValida(777)
	conteudo := fmt.Sprintf(xmlNFeExemplo, chave, dataFutura(-1), chave)
	importar := func() *httptest.ResponseRecorder {
		var corpo bytes.Buffer
		w := multipart.NewWriter(&corpo)
		require.NoError(t, w.WriteField("pedido_compra_id", fmt.Sprint(c.pcID)))
		parte, _ := w.CreateFormFile("arquivo", "nfe.xml")
		_, _ = parte.Write([]byte(conteudo))
		require.NoError(t, w.Close())
		req := httptest.NewRequest(http.MethodPost, "/api/v1/notas-entrada/importar-xml", &corpo)
		req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
		req.Header.Set(echo.HeaderAuthorization, "Bearer "+c.api.tokenDe(usuario.PerfilGestor))
		rec := httptest.NewRecorder()
		c.api.echo.ServeHTTP(rec, req)
		return rec
	}
	rec := importar()
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	previa := dados(t, rec)
	assert.Equal(t, chave, previa["chave_acesso"])
	assert.Equal(t, "777", previa["numero"])
	assert.Equal(t, "1102", previa["cfop"], "CFOP de saida do emitente vira o de entrada")
	assert.Equal(t, 1.0, previa["nao_reconhecidos"], "a placa nao tem de-para ainda")
	itens := previa["itens"].([]any)
	parafuso := itens[0].(map[string]any)
	assert.Equal(t, "PARAFUSO", parafuso["peca_codigo"])
	assert.Equal(t, 200.0, parafuso["quantidade_recebida"], "2 caixas x 100")
	assert.Equal(t, float64(c.itensPC["PARAFUSO"]), parafuso["item_pedido_compra_id"])
	placa := itens[1].(map[string]any)
	assert.Nil(t, placa["parte_peca_id"])
	assert.Equal(t, "LX-1", placa["lotes"].([]any)[0].(map[string]any)["numero_lote"])

	// Vincular a mao memoriza: a proxima leitura ja reconhece.
	c.chamar(t, http.MethodPost, fmt.Sprintf("/api/v1/fornecedores/%d/de-para", fornecedor),
		fmt.Sprintf(`{"parte_peca_id":%d,"codigo_fornecedor":"PL-778"}`, c.pecaLote), usuario.PerfilGestor, http.StatusOK)
	rec = importar()
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, 0.0, dados(t, rec)["nao_reconhecidos"])

	// Emitente diferente do fornecedor do PC: recusado.
	conteudo = strings.Replace(conteudo, "<CNPJ>11222333000181</CNPJ>", "<CNPJ>45723174000110</CNPJ>", 1)
	assert.Equal(t, http.StatusConflict, importar().Code)
}

func TestNotaEntradaConfereChaveEValores(t *testing.T) {
	c := novoCenarioNota(t)
	series := `{"numero":"SN-0001"},{"numero":"SN-0002"},{"numero":"SN-0003"}`
	pendencias := func(corpo string) string {
		id := formatarID(c.chamar(t, http.MethodPost, "/api/v1/notas-entrada", corpo, usuario.PerfilGestor, http.StatusCreated)["id"])
		erro := c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/conferir", ``, usuario.PerfilGestor, http.StatusConflict)["erro"].(map[string]any)
		return fmt.Sprint(erro["detalhes"])
	}

	// Chave de outra nota (numero no cabecalho diferente do da chave).
	outra := strings.Replace(c.corpo(t, 601, series), `"numero": "601"`, `"numero": "602"`, 1)
	assert.Contains(t, pendencias(outra), "chave de acesso nao corresponde")

	// Soma dos itens diferente do total de produtos.
	soma := strings.Replace(c.corpo(t, 603, series), `"valor_produtos": "650.00"`, `"valor_produtos": "700.00"`, 1)
	assert.Contains(t, pendencias(soma), "soma dos itens")

	// Linha com total que nao bate com quantidade x unitario.
	linha := strings.Replace(c.corpo(t, 604, series), `"valor_unitario": 50, "valor_total": "500.00"`, `"valor_unitario": 50, "valor_total": "450.00"`, 1)
	linha = strings.Replace(linha, `"valor_produtos": "650.00"`, `"valor_produtos": "600.00"`, 1)
	assert.Contains(t, pendencias(linha), "nao confere com quantidade x unitario")
}

func TestNotaEntradaEfetivacaoRespeitaPedidoEVersao(t *testing.T) {
	c := novoCenarioNota(t)
	series := `{"numero":"SN-0001"},{"numero":"SN-0002"},{"numero":"SN-0003"}`
	id := formatarID(c.chamar(t, http.MethodPost, "/api/v1/notas-entrada", c.corpo(t, 701, series), usuario.PerfilGestor, http.StatusCreated)["id"])

	// Conferencia sobre versao velha (outra pessoa editou no meio) e recusada.
	repo := repository.NovoNotaEntradaRepositorio(c.api.pool)
	require.ErrorIs(t, repo.MarcarConferida(t.Context(), mustID(t, id), 0, "gestor01"), notaentrada.ErrAlteradaNoMeio)

	// PC encerrado depois da conferencia: a efetivacao recusa.
	c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/conferir", ``, usuario.PerfilGestor, http.StatusOK)
	_, err := c.api.pool.Exec(t.Context(), `UPDATE pedidos_compra SET status = 'Concluido', motivo_encerramento = 'saldo cancelado' WHERE id = $1`, c.pcID)
	require.NoError(t, err)
	erro := c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+id+"/efetivar", ``, usuario.PerfilGestor, http.StatusConflict)["erro"].(map[string]any)
	assert.Contains(t, fmt.Sprint(erro["detalhes"]), "pedido de compra")
	q, _ := saldo(t, c, c.pecaLote)
	assert.Zero(t, q)
}

func mustID(t *testing.T, id string) int64 {
	t.Helper()
	var n int64
	_, err := fmt.Sscan(id, &n)
	require.NoError(t, err)
	return n
}
