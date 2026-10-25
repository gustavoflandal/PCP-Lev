package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/banco"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

var errosBanco = mapaDeErros{
	{banco.ErrIndisponivel, http.StatusServiceUnavailable, httpx.CodigoIndisponivel},
}

// BancoHandler atende /configuracoes/banco (doc 0, secao 4.7.6): diagnostico
// somente-leitura, nunca credenciais.
type BancoHandler struct {
	servico *banco.Servico
}

// NovoBancoHandler cria o handler de diagnostico do banco.
func NovoBancoHandler(servico *banco.Servico) *BancoHandler {
	return &BancoHandler{servico: servico}
}

// Registrar publica as rotas do modulo (permissao configuracoes.banco).
func (h *BancoHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/configuracoes/banco", autenticacao, middleware.ExigirPermissao(acesso.ConfigBanco))
	rotas.GET("", h.Status)
	rotas.POST("/testar", h.Testar)
}

// Status devolve o diagnostico completo do banco.
func (h *BancoHandler) Status(c echo.Context) error {
	status, err := h.servico.Status(c.Request().Context())
	if err != nil {
		return errosBanco.responder(c, err)
	}
	return httpx.OK(c, status)
}

// Testar executa SELECT 1 e devolve a latencia.
func (h *BancoHandler) Testar(c echo.Context) error {
	teste, err := h.servico.Testar(c.Request().Context())
	if err != nil {
		return errosBanco.responder(c, err)
	}
	return httpx.OK(c, teste)
}
