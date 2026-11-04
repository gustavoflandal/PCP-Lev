package handlers

import (
	"net/http"
	"slices"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/arquivo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cliente"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/integracao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidovenda"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/documento"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

// PrefixoAPIIntegracao e a raiz da API publica consumida pelo ERP.
const PrefixoAPIIntegracao = "/api/integracao/v1"

var errosChaveAPI = mapaDeErros{
	{integracao.ErrNaoEncontrada, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{integracao.ErrJaRevogada, http.StatusConflict, httpx.CodigoConflito},
	{integracao.ErrNomeObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{integracao.ErrDescricaoLonga, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// IntegracaoHandler atende a gestao das chaves de API e a documentacao das
// APIs de integracao (telas "APIs Integracao"): rotas com JWT e permissao.
type IntegracaoHandler struct {
	servico *integracao.Servico
}

// NovoIntegracaoHandler cria o handler de gestao.
func NovoIntegracaoHandler(servico *integracao.Servico) *IntegracaoHandler {
	return &IntegracaoHandler{servico: servico}
}

// Registrar publica as rotas de gestao sob /integracao.
func (h *IntegracaoHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/integracao", autenticacao, middleware.ExigirPermissao(acesso.IntegracaoGerenciar))
	rotas.GET("/chaves", h.Listar)
	rotas.POST("/chaves", h.Criar)
	rotas.DELETE("/chaves/:id", h.Revogar)
	rotas.GET("/endpoints", h.Endpoints)
}

type chaveAPIRequest struct {
	Nome      string `json:"nome"`
	Descricao string `json:"descricao"`
}

// Listar devolve as chaves (nunca o segredo).
func (h *IntegracaoHandler) Listar(c echo.Context) error {
	chaves, err := h.servico.Listar(c.Request().Context())
	if err != nil {
		return errosChaveAPI.responder(c, err)
	}
	return httpx.OK(c, chaves)
}

// Criar gera uma chave; o segredo vem so nesta resposta.
func (h *IntegracaoHandler) Criar(c echo.Context) error {
	var req chaveAPIRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	criada, err := h.servico.Criar(c.Request().Context(), req.Nome, req.Descricao, autorDaRequisicao(c))
	if err != nil {
		return errosChaveAPI.responder(c, err)
	}
	// Segredo nao pode ficar em cache de proxy ou do navegador.
	c.Response().Header().Set(echo.HeaderCacheControl, "no-store")
	return httpx.Criado(c, criada)
}

// Revogar desativa a chave.
func (h *IntegracaoHandler) Revogar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da chave deve ser numerico")
	}
	if err := h.servico.Revogar(c.Request().Context(), id, autorDaRequisicao(c)); err != nil {
		return errosChaveAPI.responder(c, err)
	}
	return httpx.SemConteudo(c)
}

// Endpoints devolve a documentacao das APIs de integracao.
func (h *IntegracaoHandler) Endpoints(c echo.Context) error {
	return httpx.OK(c, CatalogoIntegracao())
}

// IntegracaoPublicaHandler e a API de consulta do ERP: somente leitura,
// autenticada por chave (X-API-Key). Reaproveita os servicos de dominio das
// telas, entao regras e formato dos dados sao os mesmos do sistema.
type IntegracaoPublicaHandler struct {
	clientes      *cliente.Servico
	fornecedores  *fornecedor.Servico
	produtos      *produto.Servico
	pecas         *peca.Servico
	estoque       *estoque.Servico
	pedidosVenda  *pedidovenda.Servico
	pedidosCompra *pedidocompra.Servico
	estruturas    *estrutura.Servico
	arquivos      *arquivo.Servico
}

// ServicosIntegracao reune os servicos consultados pela API publica.
type ServicosIntegracao struct {
	Clientes      *cliente.Servico
	Fornecedores  *fornecedor.Servico
	Produtos      *produto.Servico
	Pecas         *peca.Servico
	Estoque       *estoque.Servico
	PedidosVenda  *pedidovenda.Servico
	PedidosCompra *pedidocompra.Servico
	Estruturas    *estrutura.Servico
	// Arquivos e opcional: sem ele, qtd_fotos e qtd_documentos saem zerados.
	Arquivos *arquivo.Servico
}

// NovoIntegracaoPublicaHandler cria o handler da API publica.
func NovoIntegracaoPublicaHandler(s ServicosIntegracao) *IntegracaoPublicaHandler {
	return &IntegracaoPublicaHandler{
		clientes: s.Clientes, fornecedores: s.Fornecedores, produtos: s.Produtos, pecas: s.Pecas,
		estoque: s.Estoque, pedidosVenda: s.PedidosVenda, pedidosCompra: s.PedidosCompra,
		estruturas: s.Estruturas, arquivos: s.Arquivos,
	}
}

// Registrar publica as rotas em /api/integracao/v1 (fora do grupo /api/v1 de
// JWT). Todas GET: o ERP so consulta.
func (h *IntegracaoPublicaHandler) Registrar(e *echo.Echo, autenticacaoPorChave echo.MiddlewareFunc) {
	r := e.Group(PrefixoAPIIntegracao, autenticacaoPorChave)
	r.GET("/clientes", h.listarClientes)
	r.GET("/clientes/:id", h.obterCliente)
	r.GET("/fornecedores", h.listarFornecedores)
	r.GET("/fornecedores/:id", h.obterFornecedor)
	r.GET("/produtos-acabados", h.listarProdutos)
	r.GET("/produtos-acabados/:id", h.obterProduto)
	r.GET("/produtos-acabados/:id/estruturas", h.estruturasDoProduto)
	r.GET("/estruturas/:id", h.obterEstrutura)
	r.GET("/partes-pecas", h.listarPecas)
	r.GET("/partes-pecas/:id", h.obterPeca)
	r.GET("/estoque", h.listarEstoque)
	r.GET("/estoque/:parte_peca_id", h.obterSaldo)
	r.GET("/pedidos-venda", h.listarPedidosVenda)
	r.GET("/pedidos-venda/:id", h.obterPedidoVenda)
	r.GET("/pedidos-compra", h.listarPedidosCompra)
	r.GET("/pedidos-compra/:id", h.obterPedidoCompra)
}

func (h *IntegracaoPublicaHandler) listarClientes(c echo.Context) error {
	params, err := consulta.Analisar(c.QueryParams(), cliente.ColunasOrdenaveis, "razao_social")
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}
	if pareceCNPJ.MatchString(params.Busca) {
		params.Busca = documento.ApenasDigitos(params.Busca)
	}
	tipo := c.QueryParam("tipo")
	if tipo != "" && !slices.Contains(cliente.TiposValidos, tipo) {
		return erroRequisicaoInvalida(c, "tipo invalido")
	}
	itens, total, err := h.clientes.Listar(c.Request().Context(), params, tipo)
	if err != nil {
		return errosCliente.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

func (h *IntegracaoPublicaHandler) obterCliente(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do cliente deve ser numerico")
	}
	cl, err := h.clientes.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosCliente.responder(c, err)
	}
	return httpx.OK(c, cl)
}

func (h *IntegracaoPublicaHandler) listarFornecedores(c echo.Context) error {
	params, err := consulta.Analisar(c.QueryParams(), fornecedor.ColunasOrdenaveis, "razao_social")
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}
	itens, total, err := h.fornecedores.Listar(c.Request().Context(), params)
	if err != nil {
		return errosFornecedor.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

func (h *IntegracaoPublicaHandler) obterFornecedor(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do fornecedor deve ser numerico")
	}
	f, err := h.fornecedores.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosFornecedor.responder(c, err)
	}
	return httpx.OK(c, f)
}

func (h *IntegracaoPublicaHandler) listarProdutos(c echo.Context) error {
	params, err := consulta.Analisar(c.QueryParams(), produto.ColunasOrdenaveis, "codigo")
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}
	itens, total, err := h.produtos.Listar(c.Request().Context(), params)
	if err != nil {
		return errosProduto.responder(c, err)
	}
	ids := make([]int64, len(itens))
	for i := range itens {
		ids[i] = itens[i].ID
	}
	midia := contagemMidia(c, h.arquivos, arquivo.EntidadeProduto, ids)
	for i := range itens {
		itens[i].QtdFotos = midia[itens[i].ID].Fotos
		itens[i].QtdDocumentos = midia[itens[i].ID].Documentos
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

func (h *IntegracaoPublicaHandler) obterProduto(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do produto deve ser numerico")
	}
	p, err := h.produtos.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosProduto.responder(c, err)
	}
	return httpx.OK(c, p)
}

func (h *IntegracaoPublicaHandler) estruturasDoProduto(c echo.Context) error {
	produtoID, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do produto deve ser numerico")
	}
	historico, err := h.estruturas.ListarPorProduto(c.Request().Context(), produtoID)
	if err != nil {
		return errosEstrutura.responder(c, err)
	}
	return httpx.OK(c, historico)
}

func (h *IntegracaoPublicaHandler) obterEstrutura(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da estrutura deve ser numerico")
	}
	e, err := h.estruturas.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosEstrutura.responder(c, err)
	}
	return httpx.OK(c, e)
}

func (h *IntegracaoPublicaHandler) listarPecas(c echo.Context) error {
	params, err := consulta.Analisar(c.QueryParams(), peca.ColunasOrdenaveis, "codigo")
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}
	itens, total, err := h.pecas.Listar(c.Request().Context(), params)
	if err != nil {
		return errosPeca.responder(c, err)
	}
	ids := make([]int64, len(itens))
	for i := range itens {
		ids[i] = itens[i].ID
	}
	midia := contagemMidia(c, h.arquivos, arquivo.EntidadePeca, ids)
	for i := range itens {
		itens[i].QtdFotos = midia[itens[i].ID].Fotos
		itens[i].QtdDocumentos = midia[itens[i].ID].Documentos
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

func (h *IntegracaoPublicaHandler) obterPeca(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da parte/peca deve ser numerico")
	}
	p, err := h.pecas.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosPeca.responder(c, err)
	}
	return httpx.OK(c, p)
}

func (h *IntegracaoPublicaHandler) listarEstoque(c echo.Context) error {
	params, err := consulta.AnalisarComStatus(c.QueryParams(), estoque.ColunasOrdenaveis, "codigo", estoque.StatusPermitidos)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}
	itens, total, err := h.estoque.ListarSaldo(c.Request().Context(), params)
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	// Custo e informacao sensivel (producao.custos): nao sai pela integracao.
	for i := range itens {
		itens[i].CustoMedio = 0
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

func (h *IntegracaoPublicaHandler) obterSaldo(c echo.Context) error {
	id, err := idDaRotaComNome(c, "parte_peca_id")
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da parte/peca deve ser numerico")
	}
	saldo, err := h.estoque.BuscarSaldo(c.Request().Context(), id)
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	saldo.CustoMedio = 0
	return httpx.OK(c, saldo)
}

func (h *IntegracaoPublicaHandler) listarPedidosVenda(c echo.Context) error {
	params, err := consulta.AnalisarComStatus(c.QueryParams(), pedidovenda.ColunasOrdenaveis, "data_entrega_prometida", pedidovenda.StatusPermitidos)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}
	itens, total, err := h.pedidosVenda.Listar(c.Request().Context(), params)
	if err != nil {
		return errosPedidoVenda.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

func (h *IntegracaoPublicaHandler) obterPedidoVenda(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do pedido deve ser numerico")
	}
	p, err := h.pedidosVenda.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosPedidoVenda.responder(c, err)
	}
	return httpx.OK(c, p)
}

func (h *IntegracaoPublicaHandler) listarPedidosCompra(c echo.Context) error {
	params, err := consulta.AnalisarComStatus(c.QueryParams(), pedidocompra.ColunasOrdenaveis, "numero_pc", pedidocompra.StatusPermitidos)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}
	itens, total, err := h.pedidosCompra.Listar(c.Request().Context(), params)
	if err != nil {
		return errosPedidoCompra.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

func (h *IntegracaoPublicaHandler) obterPedidoCompra(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do pedido de compra deve ser numerico")
	}
	p, err := h.pedidosCompra.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosPedidoCompra.responder(c, err)
	}
	return httpx.OK(c, p)
}
