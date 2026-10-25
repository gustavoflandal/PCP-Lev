package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/negocio"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

var errosNegocio = mapaDeErros{
	{negocio.ErrMetodoCusteioInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{negocio.ErrToleranciaInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{negocio.ErrLeadTimeInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{negocio.ErrLimiteGestorInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{negocio.ErrCotacoesInvalidas, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{negocio.ErrValorCotacoesInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{negocio.ErrToleranciaPrecoInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{negocio.ErrAcaoDivergenciaInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// NegocioHandler atende /configuracoes/negocio (doc 0, secao 4.7.5).
type NegocioHandler struct {
	servico *negocio.Servico
}

// NovoNegocioHandler cria o handler de parametros de negocio.
func NovoNegocioHandler(servico *negocio.Servico) *NegocioHandler {
	return &NegocioHandler{servico: servico}
}

// Registrar publica as rotas do modulo. Leitura para qualquer usuario
// autenticado -- os formularios de cadastro usam o lead time padrao; escrita
// com a permissao configuracoes.negocio.
func (h *NegocioHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/configuracoes/negocio", autenticacao)
	rotas.GET("", h.Buscar)
	rotas.PUT("", h.Atualizar, middleware.ExigirPermissao(acesso.ConfigNegocio))
}

// Buscar devolve a configuracao atual.
func (h *NegocioHandler) Buscar(c echo.Context) error {
	cfg, err := h.servico.Buscar(c.Request().Context())
	if err != nil {
		return errosNegocio.responder(c, err)
	}
	return httpx.OK(c, cfg)
}

// Atualizar grava a configuracao inteira (Administrador).
func (h *NegocioHandler) Atualizar(c echo.Context) error {
	var dados negocio.Dados
	if err := c.Bind(&dados); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}

	atualizada, err := h.servico.Atualizar(c.Request().Context(), dados, autorDaRequisicao(c))
	if err != nil {
		return errosNegocio.responder(c, err)
	}
	return httpx.OK(c, atualizada)
}
