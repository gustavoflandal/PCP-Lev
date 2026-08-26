package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

// errosProduto mapeia os erros do dominio de produtos para o contrato do doc 3.
var errosProduto = mapaDeErros{
	{produto.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{produto.ErrCodigoDuplicado, http.StatusConflict, httpx.CodigoConflito},
	{produto.ErrPossuiVendas, http.StatusConflict, httpx.CodigoConflito},
	{produto.ErrCodigoObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{produto.ErrDescricaoCurta, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{produto.ErrUnidadeObrigatoria, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{produto.ErrPrecoInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{produto.ErrLeadTimeInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// ProdutoHandler atende /produtos-acabados (RF1.1).
type ProdutoHandler struct {
	servico *produto.Servico
}

// NovoProdutoHandler cria o handler de produtos acabados.
func NovoProdutoHandler(servico *produto.Servico) *ProdutoHandler {
	return &ProdutoHandler{servico: servico}
}

// Registrar publica as rotas do cadastro.
//
// Consulta e liberada a qualquer usuario autenticado — o operador precisa ver
// o cadastro no chao de fabrica. Escrita fica com gestor e administrador.
func (h *ProdutoHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/produtos-acabados", autenticacao)
	gestao := middleware.ExigirPerfil(usuario.PerfilAdmin, usuario.PerfilGestor)

	rotas.GET("", h.Listar)
	rotas.GET("/:id", h.Obter)
	rotas.POST("", h.Criar, gestao)
	rotas.PUT("/:id", h.Atualizar, gestao)
	rotas.DELETE("/:id", h.Excluir, gestao)
}

// produtoRequest e o corpo de POST e PUT.
type produtoRequest struct {
	Codigo           string            `json:"codigo" validate:"required,max=50"`
	Descricao        string            `json:"descricao" validate:"required,min=5,max=255"`
	UnidadeMedida    string            `json:"unidade_medida" validate:"required,max=20"`
	PrecoVenda       dinheiro.Dinheiro `json:"preco_venda" validate:"required,gt=0"`
	LeadTimeProducao int               `json:"lead_time_producao" validate:"required,min=1"`
	Ativo            *bool             `json:"ativo"`
}

func (r produtoRequest) paraDados() produto.Dados {
	return produto.Dados{
		Codigo:           r.Codigo,
		Descricao:        r.Descricao,
		UnidadeMedida:    r.UnidadeMedida,
		PrecoVenda:       r.PrecoVenda,
		LeadTimeProducao: r.LeadTimeProducao,
		Ativo:            r.Ativo,
	}
}

// Criar cadastra um produto acabado.
func (h *ProdutoHandler) Criar(c echo.Context) error {
	req, ok := lerProdutoRequest(c)
	if !ok {
		return nil
	}

	criado, err := h.servico.Criar(c.Request().Context(), req.paraDados(), autorDaRequisicao(c))
	if err != nil {
		return errosProduto.responder(c, err)
	}
	return httpx.Criado(c, criado)
}

// Listar devolve a pagina de produtos acabados.
func (h *ProdutoHandler) Listar(c echo.Context) error {
	params, err := consulta.Analisar(c.QueryParams(), produto.ColunasOrdenaveis, "codigo")
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	itens, total, err := h.servico.Listar(c.Request().Context(), params)
	if err != nil {
		return errosProduto.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// Obter devolve um produto acabado especifico.
func (h *ProdutoHandler) Obter(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do produto deve ser numerico")
	}

	p, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosProduto.responder(c, err)
	}
	return httpx.OK(c, p)
}

// Atualizar altera um produto acabado.
func (h *ProdutoHandler) Atualizar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do produto deve ser numerico")
	}

	req, ok := lerProdutoRequest(c)
	if !ok {
		return nil
	}

	atualizado, err := h.servico.Atualizar(c.Request().Context(), id, req.paraDados(), autorDaRequisicao(c))
	if err != nil {
		return errosProduto.responder(c, err)
	}
	return httpx.OK(c, atualizado)
}

// Excluir inativa um produto acabado.
func (h *ProdutoHandler) Excluir(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do produto deve ser numerico")
	}

	if err := h.servico.Excluir(c.Request().Context(), id, autorDaRequisicao(c)); err != nil {
		return errosProduto.responder(c, err)
	}
	return httpx.SemConteudo(c)
}

// lerProdutoRequest interpreta e valida o corpo.
//
// Devolve ok=false quando a resposta de erro ja foi escrita — o handler deve
// entao retornar imediatamente, sem produzir um segundo corpo.
func lerProdutoRequest(c echo.Context) (produtoRequest, bool) {
	var req produtoRequest
	if err := c.Bind(&req); err != nil {
		_ = erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
		return req, false
	}
	if problemas := httpx.Validar(req); problemas != nil {
		_ = httpx.ErroValidacao(c, problemas)
		return req, false
	}
	return req, true
}
