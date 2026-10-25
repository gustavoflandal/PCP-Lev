package handlers

import (
	"log/slog"
	"strconv"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/painel"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

// PainelHandler atende /paineis: o Painel inicial e um painel por setor.
type PainelHandler struct {
	servico *painel.Servico
}

// NovoPainelHandler cria o handler.
func NovoPainelHandler(servico *painel.Servico) *PainelHandler {
	return &PainelHandler{servico: servico}
}

// Registrar publica as rotas. Cada painel de setor tem a sua permissao; o
// inicial so exige estar autenticado (cada bloco segue a do modulo).
func (h *PainelHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/paineis", autenticacao)
	rotas.GET("/inicio", h.Inicio)
	rotas.GET("/compras", h.Compras, middleware.ExigirPermissao(acesso.PaineisCompras))
	rotas.GET("/estoque", h.Estoque, middleware.ExigirPermissao(acesso.PaineisEstoque))
	rotas.GET("/producao", h.Producao, middleware.ExigirPermissao(acesso.PaineisProducao))
	rotas.GET("/vendas", h.Vendas, middleware.ExigirPermissao(acesso.PaineisVendas))
	rotas.GET("/qualidade", h.Qualidade, middleware.ExigirPermissao(acesso.PaineisQualidade))
}

func dias(c echo.Context) int {
	n, _ := strconv.Atoi(c.QueryParam("dias"))
	return n
}

func (h *PainelHandler) responder(c echo.Context, dados any, err error) error {
	if err != nil {
		slog.Error("falha ao montar painel", "rota", c.Path(), "erro", err)
		return httpx.ErroInterno(c)
	}
	return httpx.OK(c, dados)
}

// Inicio devolve os blocos do Painel inicial que o usuario pode ver.
func (h *PainelHandler) Inicio(c echo.Context) error {
	a, err := middleware.AcessoDaRequisicao(c)
	if err != nil {
		return h.responder(c, nil, err)
	}
	pode := func(p string) bool { return a.Ativo && !a.DeveTrocarSenha && a.Permissoes[p] }
	ini, err := h.servico.Inicio(c.Request().Context(), painel.BlocosDoInicio{
		Producao: pode(acesso.ProducaoVisualizar),
		Compras:  pode(acesso.PedidosVisualizar),
		Estoque:  pode(acesso.EstoqueVisualizar),
		Notas:    pode(acesso.NotasVisualizar),
		Vendas:   pode(acesso.PedidosVendaVisualizar),
	})
	return h.responder(c, ini, err)
}

func (h *PainelHandler) Compras(c echo.Context) error {
	p, err := h.servico.Compras(c.Request().Context(), dias(c))
	return h.responder(c, p, err)
}

// Estoque: valor em estoque (CMP) so com a permissao de custos.
func (h *PainelHandler) Estoque(c echo.Context) error {
	comCustos, err := middleware.TemPermissao(c, acesso.ProducaoCustos)
	if err != nil {
		return h.responder(c, nil, err)
	}
	p, err := h.servico.Estoque(c.Request().Context(), dias(c), comCustos)
	return h.responder(c, p, err)
}

func (h *PainelHandler) Producao(c echo.Context) error {
	p, err := h.servico.Producao(c.Request().Context(), dias(c))
	return h.responder(c, p, err)
}

func (h *PainelHandler) Vendas(c echo.Context) error {
	p, err := h.servico.Vendas(c.Request().Context(), dias(c))
	return h.responder(c, p, err)
}

func (h *PainelHandler) Qualidade(c echo.Context) error {
	p, err := h.servico.Qualidade(c.Request().Context(), dias(c))
	return h.responder(c, p, err)
}
