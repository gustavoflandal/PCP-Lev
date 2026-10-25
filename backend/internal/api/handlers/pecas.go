package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/arquivo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/controle"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
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
	fotos   *arquivo.Servico
	servico *peca.Servico
}

// NovoPecaHandler cria o handler de partes/pecas.
// ComFotos liga as miniaturas da foto principal nas respostas.
func (h *PecaHandler) ComFotos(s *arquivo.Servico) *PecaHandler {
	h.fotos = s
	return h
}

func NovoPecaHandler(servico *peca.Servico) *PecaHandler {
	return &PecaHandler{servico: servico}
}

// Registrar publica as rotas do cadastro.
func (h *PecaHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/partes-pecas", autenticacao)

	rotas.GET("", h.Listar, middleware.ExigirPermissao(acesso.PecasVisualizar))
	rotas.GET("/:id", h.Obter, middleware.ExigirPermissao(acesso.PecasVisualizar))
	rotas.POST("", h.Criar, middleware.ExigirPermissao(acesso.PecasIncluir))
	rotas.PUT("/:id", h.Atualizar, middleware.ExigirPermissao(acesso.PecasEditar))
	rotas.DELETE("/:id", h.Excluir, middleware.ExigirPermissao(acesso.PecasInativar))
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
	controle.Flags
	ValidadeMinimaDias int    `json:"validade_minima_dias"`
	MascaraSerie       string `json:"mascara_serie"`
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
		Controle:           r.Flags,
		ValidadeMinimaDias: r.ValidadeMinimaDias,
		MascaraSerie:       r.MascaraSerie,
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
	if err == nil {
		ids := make([]int64, len(itens))
		for i := range itens {
			ids[i] = itens[i].ID
		}
		urls := miniaturas(c, h.fotos, arquivo.EntidadePeca, ids)
		for i := range itens {
			itens[i].FotoURL = urls[itens[i].ID]
		}
	}
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
	if err == nil {
		p.FotoURL = miniaturas(c, h.fotos, arquivo.EntidadePeca, []int64{p.ID})[p.ID]
	}
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
