package handlers

import (
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cliente"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidovenda"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
)

// ParametroIntegracao descreve um parametro de uma rota da API de integracao.
type ParametroIntegracao struct {
	Nome      string `json:"nome"`
	Onde      string `json:"onde"` // "caminho" ou "consulta"
	Descricao string `json:"descricao"`
}

// EndpointIntegracao documenta uma rota da API publica de integracao; a tela
// "APIs Integracao" renderiza esta lista.
type EndpointIntegracao struct {
	Metodo     string                `json:"metodo"`
	Caminho    string                `json:"caminho"`
	Recurso    string                `json:"recurso"`
	Descricao  string                `json:"descricao"`
	Parametros []ParametroIntegracao `json:"parametros"`
	Exemplo    string                `json:"exemplo"`
}

func parametrosDeListagem(colunas []string, extras ...ParametroIntegracao) []ParametroIntegracao {
	base := []ParametroIntegracao{
		{"pagina", "consulta", "Número da página, a partir de 1 (padrão 1)."},
		{"limite", "consulta", "Registros por página, de 1 a 200 (padrão 50)."},
		{"busca", "consulta", "Texto livre para filtrar."},
		{"ordenar_por", "consulta", "Coluna de ordenação: " + strings.Join(colunas, ", ") + "."},
		{"ordem", "consulta", "asc (padrão) ou desc."},
	}
	return append(base, extras...)
}

var parametroID = ParametroIntegracao{"id", "caminho", "Identificador numérico do registro."}

var filtroAtivo = ParametroIntegracao{"filtro_ativo", "consulta", "true para so ativos, false para so inativos; sem o parametro traz todos."}

func filtroStatus(status []string) ParametroIntegracao {
	return ParametroIntegracao{"status", "consulta", "Filtra pela situação: " + strings.Join(status, ", ") + "."}
}

// CatalogoIntegracao lista as rotas de /api/integracao/v1. Os valores aceitos
// em ordenar_por e status saem dos proprios dominios, entao a documentacao
// acompanha o codigo.
func CatalogoIntegracao() []EndpointIntegracao {
	const listaVazia = `{"sucesso":true,"dados":[ … ],"paginacao":{"pagina":1,"limite":50,"total":120,"total_paginas":3}}`
	return []EndpointIntegracao{
		{"GET", PrefixoAPIIntegracao + "/clientes", "Clientes", "Lista os clientes.",
			parametrosDeListagem(cliente.ColunasOrdenaveis, filtroAtivo,
				ParametroIntegracao{"tipo", "consulta", "Filtra pelo tipo: " + strings.Join(cliente.TiposValidos, ", ") + "."}),
			listaVazia},
		{"GET", PrefixoAPIIntegracao + "/clientes/{id}", "Clientes", "Um cliente pelo identificador.",
			[]ParametroIntegracao{parametroID},
			`{"sucesso":true,"dados":{"id":7,"tipo":"INTEGRADOR","razao_social":"Cliente Exemplo Ltda","cnpj":"11222333000181","ativo":true}}`},
		{"GET", PrefixoAPIIntegracao + "/fornecedores", "Fornecedores", "Lista os fornecedores.",
			parametrosDeListagem(fornecedor.ColunasOrdenaveis, filtroAtivo), listaVazia},
		{"GET", PrefixoAPIIntegracao + "/fornecedores/{id}", "Fornecedores", "Um fornecedor pelo identificador.",
			[]ParametroIntegracao{parametroID},
			`{"sucesso":true,"dados":{"id":3,"razao_social":"Fornecedor Exemplo SA","cnpj":"11222333000181","lead_time_medio":10,"ativo":true}}`},
		{"GET", PrefixoAPIIntegracao + "/produtos-acabados", "Produtos acabados", "Lista os produtos acabados, com a versão vigente da estrutura (BOM).",
			parametrosDeListagem(produto.ColunasOrdenaveis, filtroAtivo), listaVazia},
		{"GET", PrefixoAPIIntegracao + "/produtos-acabados/{id}", "Produtos acabados", "Um produto acabado pelo identificador.",
			[]ParametroIntegracao{parametroID},
			`{"sucesso":true,"dados":{"id":1,"codigo":"VMS-01","descricao":"Painel de mensagem variavel","unidade_medida":"UN","preco_venda":"15000.00","ativo":true}}`},
		{"GET", PrefixoAPIIntegracao + "/produtos-acabados/{id}/estruturas", "Estruturas (BOM)", "Todas as versões da estrutura do produto, da mais recente para a mais antiga, com os itens.",
			[]ParametroIntegracao{{"id", "caminho", "Identificador do produto acabado."}},
			`{"sucesso":true,"dados":[{"id":20,"versao":2,"ativo":true,"data_vigencia_inicio":"2026-10-01","itens":[{"parte_peca_id":4,"quantidade":6}]}]}`},
		{"GET", PrefixoAPIIntegracao + "/estruturas/{id}", "Estruturas (BOM)", "Uma versão da estrutura pelo identificador, com os itens.",
			[]ParametroIntegracao{{"id", "caminho", "Identificador da versão da estrutura."}},
			`{"sucesso":true,"dados":{"id":20,"versao":2,"ativo":true,"itens":[{"parte_peca_id":4,"quantidade":6}]}}`},
		{"GET", PrefixoAPIIntegracao + "/partes-pecas", "Partes e peças", "Lista as partes e peças.",
			parametrosDeListagem(peca.ColunasOrdenaveis, filtroAtivo), listaVazia},
		{"GET", PrefixoAPIIntegracao + "/partes-pecas/{id}", "Partes e peças", "Uma parte/peça pelo identificador.",
			[]ParametroIntegracao{parametroID},
			`{"sucesso":true,"dados":{"id":4,"codigo":"RES-10K","descricao":"Resistor 10k","unidade_medida":"UN","ativo":true}}`},
		{"GET", PrefixoAPIIntegracao + "/estoque", "Estoque", "Saldo por parte/peça (sem custo).",
			parametrosDeListagem(estoque.ColunasOrdenaveis, filtroStatus(estoque.StatusPermitidos)), listaVazia},
		{"GET", PrefixoAPIIntegracao + "/estoque/{parte_peca_id}", "Estoque", "Saldo de uma parte/peça (sem custo).",
			[]ParametroIntegracao{{"parte_peca_id", "caminho", "Identificador da parte/peça."}},
			`{"sucesso":true,"dados":{"parte_peca_id":4,"codigo":"RES-10K","quantidade_atual":250,"quantidade_reservada":40,"disponivel":210,"status":"OK"}}`},
		{"GET", PrefixoAPIIntegracao + "/pedidos-venda", "Pedidos de venda", "Lista os pedidos de venda.",
			parametrosDeListagem(pedidovenda.ColunasOrdenaveis, filtroStatus(pedidovenda.StatusPermitidos)), listaVazia},
		{"GET", PrefixoAPIIntegracao + "/pedidos-venda/{id}", "Pedidos de venda", "Um pedido de venda com os itens e as ordens de produção.",
			[]ParametroIntegracao{parametroID},
			`{"sucesso":true,"dados":{"id":12,"status":"ABERTO","itens":[ … ]}}`},
		{"GET", PrefixoAPIIntegracao + "/pedidos-compra", "Pedidos de compra", "Lista os pedidos de compra.",
			parametrosDeListagem(pedidocompra.ColunasOrdenaveis, filtroStatus(pedidocompra.StatusPermitidos)), listaVazia},
		{"GET", PrefixoAPIIntegracao + "/pedidos-compra/{id}", "Pedidos de compra", "Um pedido de compra com os itens.",
			[]ParametroIntegracao{parametroID},
			`{"sucesso":true,"dados":{"id":31,"numero_pc":"PC-0031","status":"EMITIDO","itens":[ … ]}}`},
	}
}
