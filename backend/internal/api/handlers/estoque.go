package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

var errosEstoque = mapaDeErros{
	{estoque.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{estoque.ErrMovimentacaoNaoEncontrada, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{estoque.ErrSaldoInsuficienteParaAjuste, http.StatusConflict, httpx.CodigoConflito},
	{estoque.ErrPartePecaInexistente, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estoque.ErrPartePecaObrigatoria, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estoque.ErrQuantidadeAjusteObrigatoria, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estoque.ErrMotivoAjusteObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// EstoqueHandler atende /estoque e /movimentacoes (RF2).
type EstoqueHandler struct {
	servico *estoque.Servico
}

// NovoEstoqueHandler cria o handler de estoque.
func NovoEstoqueHandler(servico *estoque.Servico) *EstoqueHandler {
	return &EstoqueHandler{servico: servico}
}

// Registrar publica as rotas do modulo.
func (h *EstoqueHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	gestao := middleware.ExigirPerfil(usuario.PerfilAdmin, usuario.PerfilGestor)

	estoqueRotas := grupo.Group("/estoque", autenticacao)
	// /criticos antes de /:parte_peca_id: rota estatica, nao pode ser
	// capturada pelo parametro.
	estoqueRotas.GET("/criticos", h.Criticos)
	estoqueRotas.GET("", h.Listar)
	estoqueRotas.GET("/:parte_peca_id", h.Obter)
	estoqueRotas.POST("/ajuste", h.Ajustar, gestao)

	movRotas := grupo.Group("/movimentacoes", autenticacao)
	movRotas.GET("", h.ListarMovimentacoes)
	movRotas.GET("/:id", h.ObterMovimentacao)
}

type ajusteEstoqueRequest struct {
	PartePecaID int64  `json:"parte_peca_id" validate:"required"`
	Quantidade  int    `json:"quantidade" validate:"required"`
	Motivo      string `json:"motivo" validate:"required,max=50"`
	Observacoes string `json:"observacoes" validate:"max=1000"`
}

// Listar devolve a pagina de saldo de estoque.
func (h *EstoqueHandler) Listar(c echo.Context) error {
	params, err := consulta.AnalisarComStatus(c.QueryParams(), estoque.ColunasOrdenaveis, "codigo", estoque.StatusPermitidos)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	itens, total, err := h.servico.ListarSaldo(c.Request().Context(), params)
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// Obter devolve o saldo de uma Parte/Peca especifica.
func (h *EstoqueHandler) Obter(c echo.Context) error {
	id, err := parsePartePecaID(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da parte/peca deve ser numerico")
	}

	saldo, err := h.servico.BuscarSaldo(c.Request().Context(), id)
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	return httpx.OK(c, saldo)
}

// Criticos devolve os itens com saldo critico, sem paginacao.
func (h *EstoqueHandler) Criticos(c echo.Context) error {
	itens, err := h.servico.ListarCriticos(c.Request().Context())
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	return httpx.OK(c, itens)
}

// Ajustar registra um ajuste manual de estoque.
func (h *EstoqueHandler) Ajustar(c echo.Context) error {
	var req ajusteEstoqueRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if problemas := httpx.Validar(req); problemas != nil {
		return httpx.ErroValidacao(c, problemas)
	}

	saldo, err := h.servico.Ajustar(c.Request().Context(), estoque.AjusteDados{
		PartePecaID: req.PartePecaID, Quantidade: req.Quantidade, Motivo: req.Motivo, Observacoes: req.Observacoes,
	}, autorDaRequisicao(c))
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	return httpx.Criado(c, saldo)
}

// ListarMovimentacoes devolve a pagina de historico.
func (h *EstoqueHandler) ListarMovimentacoes(c echo.Context) error {
	params, err := consulta.Analisar(c.QueryParams(), []string{"data_hora"}, "data_hora")
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	itens, total, err := h.servico.ListarMovimentacoes(c.Request().Context(), params)
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// ObterMovimentacao devolve uma movimentacao especifica.
func (h *EstoqueHandler) ObterMovimentacao(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da movimentacao deve ser numerico")
	}

	mov, err := h.servico.BuscarMovimentacao(c.Request().Context(), id)
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	return httpx.OK(c, mov)
}

func parsePartePecaID(c echo.Context) (int64, error) {
	return idDaRotaComNome(c, "parte_peca_id")
}
