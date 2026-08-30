package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/labstack/echo/v4"
)

// errosPedidoCompra mapeia os erros do dominio de pedidos de compra para o
// doc 3. Exportado (nao literalmente — mas usado por CotacaoHandler.Registrar
// no mesmo pacote) para que a conversao de cotacao em pedido de compra
// devolva o erro certo sem duplicar a tabela.
var errosPedidoCompra = mapaDeErros{
	{pedidocompra.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{pedidocompra.ErrNumeroPCDuplicado, http.StatusConflict, httpx.CodigoConflito},
	{pedidocompra.ErrStatusInvalidoParaAcao, http.StatusConflict, httpx.CodigoConflito},
	{pedidocompra.ErrFornecedorObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidocompra.ErrDataEntregaObrigatoria, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidocompra.ErrDataEntregaInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidocompra.ErrItensObrigatorios, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidocompra.ErrQuantidadeInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidocompra.ErrPrecoInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidocompra.ErrNumeroPCObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidocompra.ErrFornecedorOuPecaInexistente, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{pedidocompra.ErrCotacaoInexistente, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// PedidoCompraHandler atende /pedidos-compra (RF3.3).
type PedidoCompraHandler struct {
	servico *pedidocompra.Servico
}

// NovoPedidoCompraHandler cria o handler de pedidos de compra.
func NovoPedidoCompraHandler(servico *pedidocompra.Servico) *PedidoCompraHandler {
	return &PedidoCompraHandler{servico: servico}
}

// Registrar publica as rotas do modulo.
func (h *PedidoCompraHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/pedidos-compra", autenticacao)
	gestao := middleware.ExigirPerfil(usuario.PerfilAdmin, usuario.PerfilGestor)

	// /em-atraso antes de /:id: e uma rota estatica que nao pode ser
	// capturada pelo parametro de id.
	rotas.GET("/em-atraso", h.EmAtraso)
	rotas.GET("", h.Listar)
	rotas.GET("/:id", h.Obter)
	rotas.POST("", h.Criar, gestao)
	rotas.PUT("/:id", h.Atualizar, gestao)
	rotas.POST("/:id/emitir", h.Emitir, gestao)
	rotas.POST("/:id/cancelar", h.Cancelar, gestao)
}

type itemPedidoCompraRequest struct {
	PartePecaID          int64             `json:"parte_peca_id" validate:"required"`
	QuantidadeSolicitada int               `json:"quantidade_solicitada" validate:"required,gt=0"`
	PrecoUnitario        dinheiro.Dinheiro `json:"preco_unitario" validate:"required"`
}

// pedidoCompraRequest e o corpo de POST e PUT.
type pedidoCompraRequest struct {
	NumeroPC            string                    `json:"numero_pc" validate:"required,max=50"`
	CotacaoID           *int64                    `json:"cotacao_id"`
	FornecedorID        int64                     `json:"fornecedor_id" validate:"required"`
	DataEntregaPrevista string                    `json:"data_entrega_prevista" validate:"required"`
	CondicaoPagamento   string                    `json:"condicao_pagamento" validate:"max=50"`
	Observacoes         string                    `json:"observacoes" validate:"max=1000"`
	Itens               []itemPedidoCompraRequest `json:"itens" validate:"required,min=1,dive"`
}

// paraDados converte o corpo da requisicao. Devolve erro quando a data nao
// esta no formato esperado — isso nao e coberto pelas tags `validate`,
// entao o handler precisa checar explicitamente.
func (r pedidoCompraRequest) paraDados() (pedidocompra.Dados, error) {
	entrega, err := tempo.DeString(r.DataEntregaPrevista)
	if err != nil {
		return pedidocompra.Dados{}, err
	}

	itens := make([]pedidocompra.ItemDados, len(r.Itens))
	for i, item := range r.Itens {
		itens[i] = pedidocompra.ItemDados{
			PartePecaID: item.PartePecaID, QuantidadeSolicitada: item.QuantidadeSolicitada,
			PrecoUnitario: item.PrecoUnitario,
		}
	}

	return pedidocompra.Dados{
		NumeroPC: r.NumeroPC, CotacaoID: r.CotacaoID, FornecedorID: r.FornecedorID,
		DataEntregaPrevista: entrega, CondicaoPagamento: r.CondicaoPagamento,
		Observacoes: r.Observacoes, Itens: itens,
	}, nil
}

// Criar cadastra um pedido de compra.
func (h *PedidoCompraHandler) Criar(c echo.Context) error {
	req, ok := lerPedidoCompraRequest(c)
	if !ok {
		return nil
	}
	dadosPedido, err := req.paraDados()
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	criado, err := h.servico.Criar(c.Request().Context(), dadosPedido, autorDaRequisicao(c))
	if err != nil {
		return errosPedidoCompra.responder(c, err)
	}
	return httpx.Criado(c, criado)
}

// Listar devolve a pagina de pedidos de compra.
func (h *PedidoCompraHandler) Listar(c echo.Context) error {
	params, err := consulta.AnalisarComStatus(c.QueryParams(), pedidocompra.ColunasOrdenaveis, "numero_pc", pedidocompra.StatusPermitidos)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	itens, total, err := h.servico.Listar(c.Request().Context(), params)
	if err != nil {
		return errosPedidoCompra.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// EmAtraso devolve os pedidos com entrega vencida — alerta operacional, sem
// paginacao.
func (h *PedidoCompraHandler) EmAtraso(c echo.Context) error {
	itens, err := h.servico.EmAtraso(c.Request().Context())
	if err != nil {
		return errosPedidoCompra.responder(c, err)
	}
	return httpx.OK(c, itens)
}

// Obter devolve um pedido de compra especifico.
func (h *PedidoCompraHandler) Obter(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do pedido de compra deve ser numerico")
	}

	p, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosPedidoCompra.responder(c, err)
	}
	return httpx.OK(c, p)
}

// Atualizar altera um pedido de compra.
func (h *PedidoCompraHandler) Atualizar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do pedido de compra deve ser numerico")
	}

	req, ok := lerPedidoCompraRequest(c)
	if !ok {
		return nil
	}
	dadosPedido, err := req.paraDados()
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	atualizado, err := h.servico.Atualizar(c.Request().Context(), id, dadosPedido, autorDaRequisicao(c))
	if err != nil {
		return errosPedidoCompra.responder(c, err)
	}
	return httpx.OK(c, atualizado)
}

// Emitir marca o pedido de compra como emitido ao fornecedor.
func (h *PedidoCompraHandler) Emitir(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do pedido de compra deve ser numerico")
	}

	emitido, err := h.servico.Emitir(c.Request().Context(), id, autorDaRequisicao(c))
	if err != nil {
		return errosPedidoCompra.responder(c, err)
	}
	return httpx.OK(c, emitido)
}

// Cancelar marca o pedido de compra como cancelado.
func (h *PedidoCompraHandler) Cancelar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do pedido de compra deve ser numerico")
	}

	if err := h.servico.Cancelar(c.Request().Context(), id, autorDaRequisicao(c)); err != nil {
		return errosPedidoCompra.responder(c, err)
	}
	atualizado, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosPedidoCompra.responder(c, err)
	}
	return httpx.OK(c, atualizado)
}

func lerPedidoCompraRequest(c echo.Context) (pedidoCompraRequest, bool) {
	var req pedidoCompraRequest
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
