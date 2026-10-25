package handlers

import (
	"net/http"
	"strconv"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/rastreio"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

var errosRastreio = mapaDeErros{
	{rastreio.ErrLoteNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
}

// RastreioHandler atende /lotes e o kardex/origens do estoque (4.3.7, 4.4).
type RastreioHandler struct {
	servico *rastreio.Servico
}

// NovoRastreioHandler cria o handler.
func NovoRastreioHandler(servico *rastreio.Servico) *RastreioHandler {
	return &RastreioHandler{servico: servico}
}

// Registrar publica as rotas (todas de leitura, permissao de ver estoque).
func (h *RastreioHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	ver := middleware.ExigirPermissao(acesso.EstoqueVisualizar)
	grupo.GET("/lotes", h.ListarLotes, autenticacao, ver)
	grupo.GET("/lotes/:id/rastreabilidade", h.RastrearLote, autenticacao, ver)
	grupo.GET("/estoque/:parte_peca_id/kardex", h.Kardex, autenticacao, ver)
	grupo.GET("/estoque/:parte_peca_id/origens", h.Origens, autenticacao, ver)
}

// ListarLotes (?parte_peca_id=&busca=&vencendo_dias=&com_saldo=true).
func (h *RastreioHandler) ListarLotes(c echo.Context) error {
	peca, _ := strconv.ParseInt(c.QueryParam("parte_peca_id"), 10, 64)
	dias, _ := strconv.Atoi(c.QueryParam("vencendo_dias"))
	lista, err := h.servico.ListarLotes(c.Request().Context(), rastreio.FiltroLotes{
		PartePecaID: peca, Busca: c.QueryParam("busca"), VencendoDias: dias, SoComSaldo: c.QueryParam("com_saldo") == "true",
	})
	if err != nil {
		return errosRastreio.responder(c, err)
	}
	return httpx.OK(c, lista)
}

// RastrearLote: do lote ao campo.
func (h *RastreioHandler) RastrearLote(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do lote deve ser numerico")
	}
	r, err := h.servico.RastrearLote(c.Request().Context(), id)
	if err != nil {
		return errosRastreio.responder(c, err)
	}
	if pode, _ := middleware.TemPermissao(c, acesso.ProducaoCustos); !pode {
		for i := range r.Entradas {
			r.Entradas[i].CustoUnitario = nil
		}
	}
	return httpx.OK(c, r)
}

// Kardex devolve o extrato do item (?limite=).
func (h *RastreioHandler) Kardex(c echo.Context) error {
	id, err := idDaRotaComNome(c, "parte_peca_id")
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da parte/peca deve ser numerico")
	}
	limite, _ := strconv.Atoi(c.QueryParam("limite"))
	lista, err := h.servico.Kardex(c.Request().Context(), id, limite)
	if err != nil {
		return errosRastreio.responder(c, err)
	}
	if pode, _ := middleware.TemPermissao(c, acesso.ProducaoCustos); !pode {
		for i := range lista {
			lista[i].CustoUnitario = nil
		}
	}
	return httpx.OK(c, lista)
}

// Origens: do saldo as notas que o originaram.
func (h *RastreioHandler) Origens(c echo.Context) error {
	id, err := idDaRotaComNome(c, "parte_peca_id")
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da parte/peca deve ser numerico")
	}
	o, err := h.servico.Origens(c.Request().Context(), id)
	if err != nil {
		return errosRastreio.responder(c, err)
	}
	if pode, _ := middleware.TemPermissao(c, acesso.ProducaoCustos); !pode {
		for i := range o.Entradas {
			o.Entradas[i].CustoUnitario = nil
		}
	}
	return httpx.OK(c, o)
}
