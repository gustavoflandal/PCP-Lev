package handlers

import (
	"net/http"
	"strconv"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/arquivo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
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
	{estoque.ErrLoteObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estoque.ErrValidadeDoLote, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estoque.ErrSeriesDoAjuste, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estoque.ErrLoteInsuficiente, http.StatusConflict, httpx.CodigoConflito},
	{estoque.ErrSerieIndisponivel, http.StatusConflict, httpx.CodigoConflito},
}

// EstoqueHandler atende /estoque e /movimentacoes (RF2).
type EstoqueHandler struct {
	servico *estoque.Servico
	fotos   *arquivo.Servico
}

// ComFotos liga as miniaturas das pecas nas respostas.
func (h *EstoqueHandler) ComFotos(s *arquivo.Servico) *EstoqueHandler {
	h.fotos = s
	return h
}

// comFotos preenche a miniatura da peca de cada saldo.
func (h *EstoqueHandler) comFotos(c echo.Context, saldos []estoque.Saldo) {
	ids := make([]int64, len(saldos))
	for i := range saldos {
		ids[i] = saldos[i].PartePecaID
	}
	urls := miniaturas(c, h.fotos, arquivo.EntidadePeca, ids)
	for i := range saldos {
		saldos[i].FotoURL = urls[saldos[i].PartePecaID]
	}
}

// NovoEstoqueHandler cria o handler de estoque.
func NovoEstoqueHandler(servico *estoque.Servico) *EstoqueHandler {
	return &EstoqueHandler{servico: servico}
}

// Registrar publica as rotas do modulo.
func (h *EstoqueHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	ver := middleware.ExigirPermissao(acesso.EstoqueVisualizar)

	estoqueRotas := grupo.Group("/estoque", autenticacao)
	// /criticos e /relatorio.csv antes de /:parte_peca_id: rotas estaticas,
	// nao podem ser capturadas pelo parametro.
	estoqueRotas.GET("/criticos", h.Criticos, ver)
	estoqueRotas.GET("/relatorio.csv", h.RelatorioCSV, middleware.ExigirPermissao(acesso.EstoqueExportar))
	estoqueRotas.GET("", h.Listar, ver)
	estoqueRotas.GET("/:parte_peca_id", h.Obter, ver)
	estoqueRotas.POST("/ajuste", h.Ajustar, middleware.ExigirPermissao(acesso.EstoqueAjustar))

	movRotas := grupo.Group("/movimentacoes", autenticacao, ver)
	movRotas.GET("", h.ListarMovimentacoes)
	movRotas.GET("/:id", h.ObterMovimentacao)
}

type ajusteEstoqueRequest struct {
	PartePecaID int64  `json:"parte_peca_id" validate:"required"`
	Quantidade  int    `json:"quantidade" validate:"required"`
	Motivo      string `json:"motivo" validate:"required,max=50"`
	Observacoes string `json:"observacoes" validate:"max=1000"`
	// Item rastreado (v1.2): lote e series do ajuste.
	Lote *struct {
		NumeroLote     string     `json:"numero_lote"`
		Validade       tempo.Data `json:"validade"`
		DataFabricacao tempo.Data `json:"data_fabricacao"`
	} `json:"lote"`
	Series []string `json:"series"`
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
	ocultarCustoSemPermissao(c, itens)
	h.comFotos(c, itens)
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
	if pode, _ := middleware.TemPermissao(c, acesso.ProducaoCustos); !pode {
		saldo.CustoMedio = 0
	}
	return httpx.OK(c, saldo)
}

// Criticos devolve os itens com saldo critico, sem paginacao.
func (h *EstoqueHandler) Criticos(c echo.Context) error {
	itens, err := h.servico.ListarCriticos(c.Request().Context())
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	ocultarCustoSemPermissao(c, itens)
	h.comFotos(c, itens)
	return httpx.OK(c, itens)
}

// RelatorioCSV exporta o saldo de estoque inteiro, sem paginacao.
func (h *EstoqueHandler) RelatorioCSV(c echo.Context) error {
	itens, err := h.servico.ListarParaRelatorio(c.Request().Context())
	if err != nil {
		return errosEstoque.responder(c, err)
	}

	linhas := make([][]string, len(itens))
	for i, s := range itens {
		linhas[i] = []string{
			s.Codigo, s.Descricao,
			strconv.Itoa(s.QuantidadeAtual), strconv.Itoa(s.Disponivel), strconv.Itoa(s.EstoqueMinimo),
			s.Status,
		}
	}
	return responderCSV(c, "estoque.csv",
		[]string{"codigo", "descricao", "saldo_atual", "disponivel", "estoque_minimo", "situacao"}, linhas)
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
		Lote: loteDoAjuste(req), Series: req.Series,
	}, autorDaRequisicao(c))
	if err != nil {
		return errosEstoque.responder(c, err)
	}
	if pode, _ := middleware.TemPermissao(c, acesso.ProducaoCustos); !pode {
		saldo.CustoMedio = 0
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

// ocultarCustoSemPermissao: o custo medio (CMP) e informacao de custo
// (producao.custos, sensivel) -- quem so ve estoque nao recebe.
func ocultarCustoSemPermissao(c echo.Context, saldos []estoque.Saldo) {
	if pode, _ := middleware.TemPermissao(c, acesso.ProducaoCustos); pode {
		return
	}
	for i := range saldos {
		saldos[i].CustoMedio = 0
	}
}

func loteDoAjuste(req ajusteEstoqueRequest) *estoque.LoteAjuste {
	if req.Lote == nil {
		return nil
	}
	return &estoque.LoteAjuste{NumeroLote: req.Lote.NumeroLote, Validade: req.Lote.Validade, DataFabricacao: req.Lote.DataFabricacao}
}
