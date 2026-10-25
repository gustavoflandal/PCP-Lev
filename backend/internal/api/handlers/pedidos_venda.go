package handlers

import (
	"context"
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidovenda"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/labstack/echo/v4"
)

var errosPedidoVenda = mapaDeErros{
	{pedidovenda.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{pedidovenda.ErrNumeroDuplicado, http.StatusConflict, httpx.CodigoConflito},
	{pedidovenda.ErrStatusInvalidoParaAcao, http.StatusConflict, httpx.CodigoConflito},
	{pedidovenda.ErrPossuiOPEmAndamento, http.StatusConflict, httpx.CodigoConflito},
	{pedidovenda.ErrSaldoPAInsuficiente, http.StatusConflict, httpx.CodigoConflito},
	{pedidovenda.ErrItensComHistorico, http.StatusConflict, httpx.CodigoConflito},
	{pedidovenda.ErrNumeroObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidovenda.ErrClienteObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidovenda.ErrClienteInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidovenda.ErrDatasInvalidas, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidovenda.ErrSemItens, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidovenda.ErrItemInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidovenda.ErrProdutoRepetido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidovenda.ErrProdutoInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidovenda.ErrObservacoesLongas, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// PedidoVendaHandler atende /pedidos-venda (RF4).
type PedidoVendaHandler struct {
	servico *pedidovenda.Servico
}

// NovoPedidoVendaHandler cria o handler.
func NovoPedidoVendaHandler(servico *pedidovenda.Servico) *PedidoVendaHandler {
	return &PedidoVendaHandler{servico: servico}
}

// Registrar publica as rotas.
func (h *PedidoVendaHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/pedidos-venda", autenticacao)
	rotas.GET("", h.Listar, middleware.ExigirPermissao(acesso.PedidosVendaVisualizar))
	rotas.GET("/:id", h.Obter, middleware.ExigirPermissao(acesso.PedidosVendaVisualizar))
	rotas.POST("", h.Criar, middleware.ExigirPermissao(acesso.PedidosVendaIncluir))
	rotas.PUT("/:id", h.Atualizar, middleware.ExigirPermissao(acesso.PedidosVendaEditar))
	rotas.POST("/:id/cancelar", h.Cancelar, middleware.ExigirPermissao(acesso.PedidosVendaCancelar))
	rotas.POST("/:id/entregar", h.Entregar, middleware.ExigirPermissao(acesso.PedidosVendaEntregar))
}

type itemPedidoVendaRequest struct {
	ProdutoAcabadoID int64             `json:"produto_acabado_id"`
	Quantidade       int               `json:"quantidade"`
	PrecoUnitario    dinheiro.Dinheiro `json:"preco_unitario"`
}

type pedidoVendaRequest struct {
	NumeroPedido         string                   `json:"numero_pedido"`
	ClienteID            int64                    `json:"cliente_id"`
	DataPedido           tempo.Data               `json:"data_pedido"`
	DataEntregaPrometida tempo.Data               `json:"data_entrega_prometida"`
	Observacoes          string                   `json:"observacoes"`
	Itens                []itemPedidoVendaRequest `json:"itens"`
}

func (r pedidoVendaRequest) dados() pedidovenda.Dados {
	d := pedidovenda.Dados{
		NumeroPedido: r.NumeroPedido, ClienteID: r.ClienteID, DataPedido: r.DataPedido,
		DataEntregaPrometida: r.DataEntregaPrometida, Observacoes: r.Observacoes,
	}
	for _, i := range r.Itens {
		d.Itens = append(d.Itens, pedidovenda.ItemDados{ProdutoAcabadoID: i.ProdutoAcabadoID, Quantidade: i.Quantidade, PrecoUnitario: i.PrecoUnitario})
	}
	return d
}

// Listar devolve a pagina de pedidos (filtro `status`).
func (h *PedidoVendaHandler) Listar(c echo.Context) error {
	params, err := consulta.AnalisarComStatus(c.QueryParams(), pedidovenda.ColunasOrdenaveis, "data_entrega_prometida", pedidovenda.StatusPermitidos)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}
	itens, total, err := h.servico.Listar(c.Request().Context(), params)
	if err != nil {
		return errosPedidoVenda.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// Obter devolve um pedido com os itens e as OPs.
func (h *PedidoVendaHandler) Obter(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do pedido deve ser numerico")
	}
	p, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosPedidoVenda.responder(c, err)
	}
	return httpx.OK(c, p)
}

// Criar cadastra um pedido.
func (h *PedidoVendaHandler) Criar(c echo.Context) error {
	var req pedidoVendaRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	p, err := h.servico.Criar(c.Request().Context(), req.dados(), autorDaRequisicao(c))
	if err != nil {
		return errosPedidoVenda.responder(c, err)
	}
	return httpx.Criado(c, p)
}

// Atualizar altera um pedido Aberto.
func (h *PedidoVendaHandler) Atualizar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do pedido deve ser numerico")
	}
	var req pedidoVendaRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	p, err := h.servico.Atualizar(c.Request().Context(), id, req.dados(), autorDaRequisicao(c))
	if err != nil {
		return errosPedidoVenda.responder(c, err)
	}
	return httpx.OK(c, p)
}

// Cancelar cancela um pedido.
func (h *PedidoVendaHandler) Cancelar(c echo.Context) error {
	return h.acao(c, h.servico.Cancelar)
}

// Entregar registra a entrega de um pedido Pronto para Envio.
func (h *PedidoVendaHandler) Entregar(c echo.Context) error {
	return h.acao(c, h.servico.RegistrarEntrega)
}

func (h *PedidoVendaHandler) acao(c echo.Context, f func(ctx context.Context, id int64, autor string) error) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do pedido deve ser numerico")
	}
	if err := f(c.Request().Context(), id, autorDaRequisicao(c)); err != nil {
		return errosPedidoVenda.responder(c, err)
	}
	p, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosPedidoVenda.responder(c, err)
	}
	return httpx.OK(c, p)
}
