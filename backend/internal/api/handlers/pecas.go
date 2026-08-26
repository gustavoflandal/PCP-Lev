package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

// errosPeca mapeia os erros do dominio de partes/pecas para o doc 3.
var errosPeca = mapaDeErros{
	{peca.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{peca.ErrCodigoDuplicado, http.StatusConflict, httpx.CodigoConflito},
	{peca.ErrPossuiMovimentacao, http.StatusConflict, httpx.CodigoConflito},
	// Fornecedor inexistente e conflito de referencia, nao erro de forma:
	// o corpo esta bem formado, o cadastro apontado e que nao existe.
	{peca.ErrFornecedorInexistente, http.StatusConflict, httpx.CodigoConflito},
	{peca.ErrCodigoObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{peca.ErrDescricaoCurta, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{peca.ErrUnidadeObrigatoria, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{peca.ErrEstoqueMinimoNegativo, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{peca.ErrFaixaDeEstoqueInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{peca.ErrLeadTimeInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// PecaHandler atende /partes-pecas (RF1.2).
type PecaHandler struct {
	servico *peca.Servico
}

// NovoPecaHandler cria o handler de partes/pecas.
func NovoPecaHandler(servico *peca.Servico) *PecaHandler {
	return &PecaHandler{servico: servico}
}

// Registrar publica as rotas do cadastro.
func (h *PecaHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/partes-pecas", autenticacao)
	gestao := middleware.ExigirPerfil(usuario.PerfilAdmin, usuario.PerfilGestor)

	rotas.GET("", h.Listar)
	rotas.GET("/:id", h.Obter)
	rotas.POST("", h.Criar, gestao)
	rotas.PUT("/:id", h.Atualizar, gestao)
	rotas.DELETE("/:id", h.Excluir, gestao)
}

// pecaRequest e o corpo de POST e PUT.
//
// EstoqueMinimo aceita zero, entao nao pode usar `required` (que rejeita o
// valor zero); a faixa valida e conferida no dominio.
type pecaRequest struct {
	Codigo             string `json:"codigo" validate:"required,max=50"`
	Descricao          string `json:"descricao" validate:"required,min=5,max=255"`
	UnidadeMedida      string `json:"unidade_medida" validate:"required,max=20"`
	EstoqueMinimo      int    `json:"estoque_minimo" validate:"min=0"`
	EstoqueMaximo      int    `json:"estoque_maximo" validate:"required,min=1"`
	FornecedorPadraoID *int64 `json:"fornecedor_padrao_id"`
	LeadTimeCompra     int    `json:"lead_time_compra" validate:"required,min=1"`
	Ativo              *bool  `json:"ativo"`
}

func (r pecaRequest) paraDados() peca.Dados {
	return peca.Dados{
		Codigo:             r.Codigo,
		Descricao:          r.Descricao,
		UnidadeMedida:      r.UnidadeMedida,
		EstoqueMinimo:      r.EstoqueMinimo,
		EstoqueMaximo:      r.EstoqueMaximo,
		FornecedorPadraoID: r.FornecedorPadraoID,
		LeadTimeCompra:     r.LeadTimeCompra,
		Ativo:              r.Ativo,
	}
}

// Criar cadastra uma parte/peca.
func (h *PecaHandler) Criar(c echo.Context) error {
	req, ok := lerPecaRequest(c)
	if !ok {
		return nil
	}

	criada, err := h.servico.Criar(c.Request().Context(), req.paraDados(), autorDaRequisicao(c))
	if err != nil {
		return errosPeca.responder(c, err)
	}
	return httpx.Criado(c, criada)
}

// Listar devolve a pagina de partes/pecas.
func (h *PecaHandler) Listar(c echo.Context) error {
	params, err := consulta.Analisar(c.QueryParams(), peca.ColunasOrdenaveis, "codigo")
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	itens, total, err := h.servico.Listar(c.Request().Context(), params)
	if err != nil {
		return errosPeca.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// Obter devolve uma parte/peca especifica.
func (h *PecaHandler) Obter(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da parte/peca deve ser numerico")
	}

	p, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosPeca.responder(c, err)
	}
	return httpx.OK(c, p)
}

// Atualizar altera uma parte/peca.
func (h *PecaHandler) Atualizar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da parte/peca deve ser numerico")
	}

	req, ok := lerPecaRequest(c)
	if !ok {
		return nil
	}

	atualizada, err := h.servico.Atualizar(c.Request().Context(), id, req.paraDados(), autorDaRequisicao(c))
	if err != nil {
		return errosPeca.responder(c, err)
	}
	return httpx.OK(c, atualizada)
}

// Excluir inativa uma parte/peca.
func (h *PecaHandler) Excluir(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da parte/peca deve ser numerico")
	}

	if err := h.servico.Excluir(c.Request().Context(), id, autorDaRequisicao(c)); err != nil {
		return errosPeca.responder(c, err)
	}
	return httpx.SemConteudo(c)
}

// lerPecaRequest interpreta e valida o corpo; ok=false significa que a
// resposta de erro ja foi escrita.
func lerPecaRequest(c echo.Context) (pecaRequest, bool) {
	var req pecaRequest
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
