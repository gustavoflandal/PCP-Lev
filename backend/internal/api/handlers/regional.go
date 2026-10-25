package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

var errosRegional = mapaDeErros{
	{regional.ErrFormatoDataInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{regional.ErrFormatoHoraInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// RegionalHandler atende /configuracoes/regional (doc 0, secao 4.6.4).
type RegionalHandler struct {
	servico *regional.Servico
}

// NovoRegionalHandler cria o handler de parametros regionais.
func NovoRegionalHandler(servico *regional.Servico) *RegionalHandler {
	return &RegionalHandler{servico: servico}
}

// Registrar publica as rotas do modulo. Diferente de Dados da Empresa, a
// leitura EXIGE autenticacao (qualquer perfil) -- nada antes do login usa
// formato de data/hora, ao contrario do nome/logo da empresa. Escrita com a
// permissao configuracoes.regional.
func (h *RegionalHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/configuracoes/regional", autenticacao)
	rotas.GET("", h.Buscar)
	rotas.PUT("", h.Atualizar, middleware.ExigirPermissao(acesso.ConfigRegional))
}

// Buscar devolve a configuracao atual (qualquer usuario autenticado).
func (h *RegionalHandler) Buscar(c echo.Context) error {
	cfg, err := h.servico.Buscar(c.Request().Context())
	if err != nil {
		return errosRegional.responder(c, err)
	}
	return httpx.OK(c, cfg)
}

type dadosRegionalRequest struct {
	FormatoData regional.FormatoData `json:"formato_data"`
	FormatoHora regional.FormatoHora `json:"formato_hora"`
}

// Atualizar grava os dois campos (Administrador).
func (h *RegionalHandler) Atualizar(c echo.Context) error {
	claims := middleware.ClaimsDoContexto(c)
	if claims == nil {
		return httpx.NaoAutorizado(c, "Token de acesso ausente")
	}

	var req dadosRegionalRequest
	if err := c.Bind(&req); err != nil {
		return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoRequisicaoInvalida, "Corpo da requisicao invalido")
	}

	atualizada, err := h.servico.Atualizar(c.Request().Context(), regional.Dados{
		FormatoData: req.FormatoData,
		FormatoHora: req.FormatoHora,
	}, claims.Username)
	if err != nil {
		return errosRegional.responder(c, err)
	}
	return httpx.OK(c, atualizada)
}
