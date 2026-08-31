package handlers

import (
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/necessidadecompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

// errosNecessidadeCompra e vazio de proposito: o dominio e so leitura, sem
// sentinelas -- mantido pelo mesmo motivo de todo handler usar
// mapaDeErros.responder (log padronizado do erro nao mapeado + 500 generico
// para o cliente), em vez de duplicar esse bloco aqui.
var errosNecessidadeCompra = mapaDeErros{}

// NecessidadeCompraHandler atende GET /necessidade-compra (RF3.2).
type NecessidadeCompraHandler struct {
	servico *necessidadecompra.Servico
}

// NovoNecessidadeCompraHandler cria o handler de necessidade de compra.
func NovoNecessidadeCompraHandler(servico *necessidadecompra.Servico) *NecessidadeCompraHandler {
	return &NecessidadeCompraHandler{servico: servico}
}

// Registrar publica a rota do modulo -- consulta, aberta a qualquer perfil
// autenticado (mesmo padrao de GET /estoque/criticos).
func (h *NecessidadeCompraHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	grupo.GET("/necessidade-compra", h.Listar, autenticacao)
}

// Listar devolve as pecas ativas com saldo abaixo do estoque minimo.
func (h *NecessidadeCompraHandler) Listar(c echo.Context) error {
	itens, err := h.servico.Listar(c.Request().Context())
	if err != nil {
		return errosNecessidadeCompra.responder(c, err)
	}
	return httpx.OK(c, itens)
}
