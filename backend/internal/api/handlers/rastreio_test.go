package handlers_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/arquivo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidovenda"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/producao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/rastreio"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Do recebimento ao campo: nota com lotes e series -> OP consome por FEFO ->
// ficha da unidade mostra serie/lote/nota/fornecedor; o lote leva ao cliente.
func TestRastreabilidadeDoRecebimentoAoCliente(t *testing.T) {
	c := novoCenarioNota(t)
	pool := c.api.pool
	grupo := c.api.echo.Group("/api/v1")
	handlers.NovoPedidoVendaHandler(pedidovenda.NovoServico(repository.NovoPedidoVendaRepositorio(pool))).Registrar(grupo, c.api.autenticacao())
	handlers.NovoProducaoHandler(producao.NovoServico(repository.NovoProducaoRepositorio(pool))).Registrar(grupo, c.api.autenticacao())
	handlers.NovoRastreioHandler(rastreio.NovoServico(repository.NovoRastreioRepositorio(pool))).Registrar(grupo, c.api.autenticacao())
	ctx := t.Context()

	// Entrada: placa em 2 lotes (L-A vence antes) e 3 conectores com serie.
	nota := c.chamar(t, http.MethodPost, "/api/v1/notas-entrada", c.corpo(t, 501, `{"numero":"SN-0001"},{"numero":"SN-0002"},{"numero":"SN-0003"}`),
		usuario.PerfilGestor, http.StatusCreated)
	notaID := formatarID(nota["id"])
	c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+notaID+"/conferir", ``, usuario.PerfilGestor, http.StatusOK)
	c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+notaID+"/efetivar", ``, usuario.PerfilGestor, http.StatusOK)

	// Produto com BOM: 1 placa + 1 conector por unidade.
	var cliente, produto, estrutura int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO clientes (tipo, razao_social, cnpj) VALUES ('ORGAO_PUBLICO', 'DER Rastreio', '45723174000110') RETURNING id`).Scan(&cliente))
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO produtos_acabados (codigo, descricao, unidade_medida, preco_venda) VALUES ('VMS-1', 'Painel VMS', 'UN', 9000) RETURNING id`).Scan(&produto))
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO estrutura_produto (produto_acabado_id, versao, data_vigencia_inicio) VALUES ($1, 1, CURRENT_DATE) RETURNING id`, produto).Scan(&estrutura))
	_, err := pool.Exec(ctx, `INSERT INTO itens_estrutura_produto (estrutura_produto_id, parte_peca_id, quantidade) VALUES ($1, $2, 1), ($1, $3, 1)`,
		estrutura, c.pecaLote, c.pecaSerie)
	require.NoError(t, err)
	centros := map[string]int64{}
	for _, etapa := range []string{"SEPARACAO", "MONTAGEM", "TESTES", "EXPEDICAO"} {
		var id int64
		require.NoError(t, pool.QueryRow(ctx, `INSERT INTO centros_trabalho (codigo, nome, etapa) VALUES ('R-' || $1::varchar, $1::varchar, $1::varchar) RETURNING id`, etapa).Scan(&id))
		centros[etapa] = id
	}
	pedido := c.chamar(t, http.MethodPost, "/api/v1/pedidos-venda", fmt.Sprintf(`{"numero_pedido":"PV-R1","cliente_id":%d,"data_pedido":%q,
		"data_entrega_prometida":%q,"itens":[{"produto_acabado_id":%d,"quantidade":2,"preco_unitario":"9000.00"}]}`,
		cliente, dataFutura(0), dataFutura(20), produto), usuario.PerfilGestor, http.StatusCreated)
	item := formatarID(pedido["itens"].([]any)[0].(map[string]any)["id"])
	op := c.chamar(t, http.MethodPost, "/api/v1/ops", `{"item_pedido_venda_id":`+item+`}`, usuario.PerfilGestor, http.StatusCreated)
	opID := formatarID(op["id"])
	op = c.chamar(t, http.MethodPost, "/api/v1/ops/"+opID+"/liberar", ``, usuario.PerfilGestor, http.StatusOK)

	var loteA, reservadoA int64
	require.NoError(t, pool.QueryRow(ctx, `SELECT id, quantidade_reservada FROM lotes WHERE numero_lote = 'L-A'`).Scan(&loteA, &reservadoA))
	assert.Equal(t, int64(2), reservadoA, "FEFO: o lote que vence antes")
	var reservadas int
	require.NoError(t, pool.QueryRow(ctx, `SELECT count(*) FROM series_componente WHERE status = 'Reservado'`).Scan(&reservadas))
	assert.Equal(t, 2, reservadas)

	for _, etapa := range []string{"SEPARACAO", "MONTAGEM", "TESTES", "EXPEDICAO"} {
		c.chamar(t, http.MethodPost, "/api/v1/ops/"+opID+"/apontamentos", fmt.Sprintf(`{"centro_trabalho_id":%d}`, centros[etapa]), usuario.PerfilGestor, http.StatusOK)
		c.chamar(t, http.MethodPost, "/api/v1/ops/"+opID+"/apontamentos/encerrar", `{}`, usuario.PerfilGestor, http.StatusOK)
		if etapa == "TESTES" {
			for _, s := range op["series"].([]any) {
				c.chamar(t, http.MethodPut, fmt.Sprintf("/api/v1/series/%s/teste", formatarID(s.(map[string]any)["id"])),
					`{"aprovado":true,"resultado":"ok"}`, usuario.PerfilGestor, http.StatusNoContent)
			}
		}
		c.chamar(t, http.MethodPost, "/api/v1/ops/"+opID+"/avancar", ``, usuario.PerfilGestor, http.StatusOK)
	}

	// Laudo de teste anexado a OP entra na ficha; foto da producao nao.
	arquivos := arquivo.NovoServico(repository.NovoArquivoRepositorio(pool), arquivo.NovoAssinador(segredoTeste))
	handlers.NovoArquivoHandler(arquivos).Registrar(grupo, c.api.autenticacao())
	laudo := dados(t, c.api.enviar(usuario.PerfilGestor, "laudo.pdf", []byte("%PDF-1.4\nlaudo\n%%EOF")))["id"]
	for _, categoria := range []string{"Laudo de Teste", "Foto da Produção"} {
		c.chamar(t, http.MethodPost, "/api/v1/anexos", fmt.Sprintf(`{"entidade":"ordem_producao","entidade_id":%s,"arquivo_id":%q,
			"tipo":"ANEXO","categoria":%q,"titulo":"Ensaio final"}`, opID, laudo, categoria), usuario.PerfilGestor, http.StatusCreated)
	}

	// Ficha da primeira unidade: serie do conector, lote da placa, nota, fornecedor.
	primeira := op["series"].([]any)[0].(map[string]any)["numero"].(string)
	ficha := c.chamar(t, http.MethodGet, "/api/v1/rastreabilidade/"+primeira, ``, usuario.PerfilGestor, http.StatusOK)
	instaladas := ficha["series_componentes"].([]any)
	require.Len(t, instaladas, 1)
	assert.Equal(t, "SN-0001", instaladas[0].(map[string]any)["numero"])
	assert.Equal(t, "501/1", instaladas[0].(map[string]any)["nota"])
	assert.Equal(t, "Eletronica Fornecedora", instaladas[0].(map[string]any)["fornecedor_nome"])
	lotes := ficha["lotes_consumidos"].([]any)
	require.Len(t, lotes, 1)
	assert.Equal(t, "L-A", lotes[0].(map[string]any)["numero_lote"])
	assert.Equal(t, "501/1", lotes[0].(map[string]any)["notas"])
	docs := ficha["documentos"].([]any)
	require.Len(t, docs, 1)
	assert.Equal(t, "Laudo de Teste", docs[0].(map[string]any)["categoria"])
	assert.Equal(t, "laudo.pdf", docs[0].(map[string]any)["nome_arquivo"])

	// Do lote ao campo: OP, unidades e cliente.
	rastro := c.chamar(t, http.MethodGet, fmt.Sprintf("/api/v1/lotes/%d/rastreabilidade", loteA), ``, perfilConsulta, http.StatusOK)
	assert.Len(t, rastro["entradas"], 1)
	assert.Len(t, rastro["consumos"], 1)
	unidades := rastro["unidades"].([]any)
	require.Len(t, unidades, 2)
	assert.Equal(t, "DER Rastreio", unidades[0].(map[string]any)["cliente_nome"])

	// Saldo -> origem e kardex com documento.
	origens := c.chamar(t, http.MethodGet, fmt.Sprintf("/api/v1/estoque/%d/origens", c.pecaLote), ``, perfilConsulta, http.StatusOK)
	assert.Equal(t, 8.0, origens["saldo"])
	assert.Equal(t, 8.0, origens["entradas"].([]any)[0].(map[string]any)["quantidade"])
	rec := c.api.chamar(http.MethodGet, fmt.Sprintf("/api/v1/estoque/%d/kardex", c.pecaLote), "", perfilConsulta)
	require.Equal(t, http.StatusOK, rec.Code)
	kardex := lista(t, rec)
	ultimo := kardex[0].(map[string]any)
	assert.Equal(t, "ORDEM_PRODUCAO", ultimo["documento_tipo"])
	assert.Equal(t, "L-A", ultimo["numero_lote"])
	assert.Equal(t, 8.0, ultimo["saldo"])
	assert.NotContains(t, rec.Body.String(), "custo_unitario", "consulta nao ve custo")
}

// Lote vencido nao conta como disponivel: a OP nao libera so com ele.
func TestLiberarOPIgnoraLoteVencido(t *testing.T) {
	c := novoCenarioNota(t)
	pool := c.api.pool
	grupo := c.api.echo.Group("/api/v1")
	handlers.NovoPedidoVendaHandler(pedidovenda.NovoServico(repository.NovoPedidoVendaRepositorio(pool))).Registrar(grupo, c.api.autenticacao())
	handlers.NovoProducaoHandler(producao.NovoServico(repository.NovoProducaoRepositorio(pool))).Registrar(grupo, c.api.autenticacao())
	ctx := t.Context()
	nota := c.chamar(t, http.MethodPost, "/api/v1/notas-entrada", c.corpo(t, 801, `{"numero":"SN-0001"},{"numero":"SN-0002"},{"numero":"SN-0003"}`),
		usuario.PerfilGestor, http.StatusCreated)
	notaID := formatarID(nota["id"])
	c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+notaID+"/conferir", ``, usuario.PerfilGestor, http.StatusOK)
	c.chamar(t, http.MethodPost, "/api/v1/notas-entrada/"+notaID+"/efetivar", ``, usuario.PerfilGestor, http.StatusOK)
	// L-A (6) vence ontem: sobram 4 validas para uma OP de 5.
	_, err := pool.Exec(ctx, `UPDATE lotes SET validade = CURRENT_DATE - 1 WHERE numero_lote = 'L-A'`)
	require.NoError(t, err)

	var cliente, produto, estrutura int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO clientes (tipo, razao_social, cnpj) VALUES ('ORGAO_PUBLICO', 'DER Vencido', '45723174000110') RETURNING id`).Scan(&cliente))
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO produtos_acabados (codigo, descricao, unidade_medida, preco_venda) VALUES ('VMS-V', 'Painel', 'UN', 9000) RETURNING id`).Scan(&produto))
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO estrutura_produto (produto_acabado_id, versao, data_vigencia_inicio) VALUES ($1, 1, CURRENT_DATE) RETURNING id`, produto).Scan(&estrutura))
	_, err = pool.Exec(ctx, `INSERT INTO itens_estrutura_produto (estrutura_produto_id, parte_peca_id, quantidade) VALUES ($1, $2, 1)`, estrutura, c.pecaLote)
	require.NoError(t, err)
	pedido := c.chamar(t, http.MethodPost, "/api/v1/pedidos-venda", fmt.Sprintf(`{"numero_pedido":"PV-V1","cliente_id":%d,"data_pedido":%q,
		"data_entrega_prometida":%q,"itens":[{"produto_acabado_id":%d,"quantidade":5,"preco_unitario":"9000.00"}]}`,
		cliente, dataFutura(0), dataFutura(20), produto), usuario.PerfilGestor, http.StatusCreated)
	item := formatarID(pedido["itens"].([]any)[0].(map[string]any)["id"])
	opID := formatarID(c.chamar(t, http.MethodPost, "/api/v1/ops", `{"item_pedido_venda_id":`+item+`}`, usuario.PerfilGestor, http.StatusCreated)["id"])
	falta := c.chamar(t, http.MethodPost, "/api/v1/ops/"+opID+"/liberar", ``, usuario.PerfilGestor, http.StatusConflict)["erro"].(map[string]any)
	assert.Equal(t, handlers.CodigoMaterialInsuficiente, falta["codigo"])
	assert.Contains(t, fmt.Sprint(falta["detalhes"]), "4")
}
