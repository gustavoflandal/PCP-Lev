package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cotacao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/labstack/echo/v4"
)

// errosCotacao mapeia os erros do dominio de cotacoes para o doc 3.
var errosCotacao = mapaDeErros{
	{cotacao.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{cotacao.ErrNumeroCotacaoDuplicado, http.StatusConflict, httpx.CodigoConflito},
	{cotacao.ErrStatusInvalidoParaAcao, http.StatusConflict, httpx.CodigoConflito},
	{cotacao.ErrFornecedorObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cotacao.ErrDataValidadeObrigatoria, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cotacao.ErrDataValidadeInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cotacao.ErrItensObrigatorios, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cotacao.ErrQuantidadeInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cotacao.ErrPrecoInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cotacao.ErrNumeroCotacaoObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cotacao.ErrFornecedorOuPecaInexistente, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// CotacaoHandler atende /cotacoes (RF3.1). Tambem depende do servico de
// pedidos de compra: converter-pc cria um PedidoCompra a partir da cotacao.
type CotacaoHandler struct {
	servico       *cotacao.Servico
	pedidoServico *pedidocompra.Servico
}

// NovoCotacaoHandler cria o handler de cotacoes.
func NovoCotacaoHandler(servico *cotacao.Servico, pedidoServico *pedidocompra.Servico) *CotacaoHandler {
	return &CotacaoHandler{servico: servico, pedidoServico: pedidoServico}
}

// Registrar publica as rotas do modulo.
func (h *CotacaoHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/cotacoes", autenticacao)
	gestao := middleware.ExigirPerfil(usuario.PerfilAdmin, usuario.PerfilGestor)

	rotas.GET("", h.Listar)
	rotas.GET("/:id", h.Obter)
	rotas.POST("", h.Criar, gestao)
	rotas.PUT("/:id", h.Atualizar, gestao)
	rotas.POST("/:id/enviar", h.Enviar, gestao)
	rotas.POST("/:id/registrar-resposta", h.RegistrarResposta, gestao)
	rotas.POST("/:id/cancelar", h.Cancelar, gestao)
	rotas.POST("/:id/converter-pc", h.ConverterEmPedido, gestao)
}

type itemCotacaoRequest struct {
	PartePecaID   int64             `json:"parte_peca_id" validate:"required"`
	Quantidade    int               `json:"quantidade" validate:"required,gt=0"`
	PrecoUnitario dinheiro.Dinheiro `json:"preco_unitario" validate:"required"`
}

// cotacaoRequest e o corpo de POST e PUT.
type cotacaoRequest struct {
	NumeroCotacao string               `json:"numero_cotacao" validate:"required,max=50"`
	FornecedorID  int64                `json:"fornecedor_id" validate:"required"`
	DataValidade  string               `json:"data_validade" validate:"required"`
	Observacoes   string               `json:"observacoes" validate:"max=1000"`
	Itens         []itemCotacaoRequest `json:"itens" validate:"required,min=1,dive"`
}

func (r cotacaoRequest) paraDados() (cotacao.Dados, error) {
	validade, err := tempo.DeString(r.DataValidade)
	if err != nil {
		return cotacao.Dados{}, err
	}

	itens := make([]cotacao.ItemDados, len(r.Itens))
	for i, item := range r.Itens {
		itens[i] = cotacao.ItemDados{
			PartePecaID: item.PartePecaID, Quantidade: item.Quantidade, PrecoUnitario: item.PrecoUnitario,
		}
	}

	return cotacao.Dados{
		NumeroCotacao: r.NumeroCotacao, FornecedorID: r.FornecedorID,
		DataValidade: validade, Observacoes: r.Observacoes, Itens: itens,
	}, nil
}

type itemRespostaRequest struct {
	PartePecaID   int64             `json:"parte_peca_id" validate:"required"`
	PrecoUnitario dinheiro.Dinheiro `json:"preco_unitario" validate:"required"`
}

type respostaRequest struct {
	DataResposta string                `json:"data_resposta" validate:"required"`
	Itens        []itemRespostaRequest `json:"itens" validate:"required,min=1,dive"`
}

func (r respostaRequest) paraDados() (cotacao.RespostaDados, error) {
	data, err := tempo.DeString(r.DataResposta)
	if err != nil {
		return cotacao.RespostaDados{}, err
	}
	itens := make([]cotacao.ItemDados, len(r.Itens))
	for i, item := range r.Itens {
		itens[i] = cotacao.ItemDados{PartePecaID: item.PartePecaID, PrecoUnitario: item.PrecoUnitario}
	}
	return cotacao.RespostaDados{DataResposta: data, Itens: itens}, nil
}

// converterRequest e o corpo de POST /:id/converter-pc. O numero do PC e
// digitado pelo usuario, como em qualquer outro cadastro deste sistema —
// nao ha gerador automatico de sequencia.
type converterRequest struct {
	NumeroPC            string `json:"numero_pc" validate:"required,max=50"`
	DataEntregaPrevista string `json:"data_entrega_prevista" validate:"required"`
	CondicaoPagamento   string `json:"condicao_pagamento" validate:"max=50"`
}

// Criar cadastra uma cotacao.
func (h *CotacaoHandler) Criar(c echo.Context) error {
	req, ok := lerCotacaoRequest(c)
	if !ok {
		return nil
	}
	dadosCotacao, err := req.paraDados()
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	criada, err := h.servico.Criar(c.Request().Context(), dadosCotacao, autorDaRequisicao(c))
	if err != nil {
		return errosCotacao.responder(c, err)
	}
	return httpx.Criado(c, criada)
}

// Listar devolve a pagina de cotacoes.
func (h *CotacaoHandler) Listar(c echo.Context) error {
	params, err := consulta.AnalisarComStatus(c.QueryParams(), cotacao.ColunasOrdenaveis, "numero_cotacao", cotacao.StatusPermitidos)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	itens, total, err := h.servico.Listar(c.Request().Context(), params)
	if err != nil {
		return errosCotacao.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// Obter devolve uma cotacao especifica.
func (h *CotacaoHandler) Obter(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da cotacao deve ser numerico")
	}

	encontrada, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosCotacao.responder(c, err)
	}
	return httpx.OK(c, encontrada)
}

// Atualizar altera uma cotacao.
func (h *CotacaoHandler) Atualizar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da cotacao deve ser numerico")
	}

	req, ok := lerCotacaoRequest(c)
	if !ok {
		return nil
	}
	dadosCotacao, err := req.paraDados()
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	atualizada, err := h.servico.Atualizar(c.Request().Context(), id, dadosCotacao, autorDaRequisicao(c))
	if err != nil {
		return errosCotacao.responder(c, err)
	}
	return httpx.OK(c, atualizada)
}

// Enviar marca a cotacao como enviada ao fornecedor.
func (h *CotacaoHandler) Enviar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da cotacao deve ser numerico")
	}

	enviada, err := h.servico.Enviar(c.Request().Context(), id, autorDaRequisicao(c))
	if err != nil {
		return errosCotacao.responder(c, err)
	}
	return httpx.OK(c, enviada)
}

// RegistrarResposta atualiza os precos com o que o fornecedor respondeu.
func (h *CotacaoHandler) RegistrarResposta(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da cotacao deve ser numerico")
	}

	var req respostaRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if problemas := httpx.Validar(req); problemas != nil {
		return httpx.ErroValidacao(c, problemas)
	}
	resposta, err := req.paraDados()
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	respondida, err := h.servico.RegistrarResposta(c.Request().Context(), id, resposta, autorDaRequisicao(c))
	if err != nil {
		return errosCotacao.responder(c, err)
	}
	return httpx.OK(c, respondida)
}

// Cancelar marca a cotacao como cancelada.
func (h *CotacaoHandler) Cancelar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da cotacao deve ser numerico")
	}

	if err := h.servico.Cancelar(c.Request().Context(), id, autorDaRequisicao(c)); err != nil {
		return errosCotacao.responder(c, err)
	}
	atualizada, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosCotacao.responder(c, err)
	}
	return httpx.OK(c, atualizada)
}

// ConverterEmPedido cria um pedido de compra a partir de uma cotacao
// respondida, copiando fornecedor, pecas e o preco negociado — RF3.3 exige
// que o preco do PC bata com a cotacao, entao a tela nao reabre esse campo.
func (h *CotacaoHandler) ConverterEmPedido(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da cotacao deve ser numerico")
	}

	encontrada, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosCotacao.responder(c, err)
	}
	if encontrada.Status != cotacao.StatusRespondida {
		return errosCotacao.responder(c, cotacao.ErrStatusInvalidoParaAcao)
	}

	var req converterRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if problemas := httpx.Validar(req); problemas != nil {
		return httpx.ErroValidacao(c, problemas)
	}
	entrega, err := tempo.DeString(req.DataEntregaPrevista)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	itens := make([]pedidocompra.ItemDados, len(encontrada.Itens))
	for i, item := range encontrada.Itens {
		itens[i] = pedidocompra.ItemDados{
			PartePecaID: item.PartePecaID, QuantidadeSolicitada: item.Quantidade, PrecoUnitario: item.PrecoUnitario,
		}
	}
	cotacaoID := encontrada.ID

	criado, err := h.pedidoServico.Criar(c.Request().Context(), pedidocompra.Dados{
		NumeroPC: req.NumeroPC, CotacaoID: &cotacaoID, FornecedorID: encontrada.FornecedorID,
		DataEntregaPrevista: entrega, CondicaoPagamento: req.CondicaoPagamento, Itens: itens,
	}, autorDaRequisicao(c))
	if err != nil {
		return errosPedidoCompra.responder(c, err)
	}
	return httpx.Criado(c, criado)
}

func lerCotacaoRequest(c echo.Context) (cotacaoRequest, bool) {
	var req cotacaoRequest
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
