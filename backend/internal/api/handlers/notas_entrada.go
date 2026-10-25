package handlers

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/arquivo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/notaentrada"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/labstack/echo/v4"
)

// CodigoPendencias e o 409 da conferencia/efetivacao com pendencias; os
// detalhes trazem cada uma ("campo" = "item N" ou o tipo; a mensagem diz o
// que corrigir). O nivel vem prefixado na mensagem: [BLOQUEIO], [APROVACAO]
// ou [AVISO].
const CodigoPendencias = "PENDENCIAS_NA_NOTA"

var errosNota = mapaDeErros{
	{notaentrada.ErrNaoEncontrada, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{notaentrada.ErrDeParaNaoExiste, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{notaentrada.ErrDuplicada, http.StatusConflict, httpx.CodigoConflito},
	{notaentrada.ErrStatusInvalidoParaAcao, http.StatusConflict, httpx.CodigoConflito},
	{notaentrada.ErrEstornoBloqueado, http.StatusConflict, httpx.CodigoConflito},
	{notaentrada.ErrPedidoObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrModeloInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrSerieNumero, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrChaveInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrValoresNegativos, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrItemInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrObservacoesLongas, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrMotivoObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrDeParaInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrAlteradaNoMeio, http.StatusConflict, httpx.CodigoConflito},
	{notaentrada.ErrCertificadoInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrXMLGrande, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrXMLInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrXMLSemItens, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrXMLModelo, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{notaentrada.ErrEmitenteDoPedido, http.StatusConflict, httpx.CodigoConflito},
	{arquivo.ErrTipoNaoAceito, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{arquivo.ErrGrandeDemais, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// NotaEntradaHandler atende /notas-entrada e o de-para dos fornecedores.
type NotaEntradaHandler struct {
	servico *notaentrada.Servico
	fotos   *arquivo.Servico
}

// NovoNotaEntradaHandler cria o handler.
func NovoNotaEntradaHandler(servico *notaentrada.Servico) *NotaEntradaHandler {
	return &NotaEntradaHandler{servico: servico}
}

// ComFotos liga as miniaturas das pecas (conferencia de recebimento, 4.1.2).
func (h *NotaEntradaHandler) ComFotos(s *arquivo.Servico) *NotaEntradaHandler {
	h.fotos = s
	return h
}

// Registrar publica as rotas.
func (h *NotaEntradaHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	ver := middleware.ExigirPermissao(acesso.NotasVisualizar)
	lancar := middleware.ExigirPermissao(acesso.NotasLancar)
	rotas := grupo.Group("/notas-entrada", autenticacao)
	rotas.GET("", h.Listar, ver)
	rotas.GET("/:id", h.Obter, ver)
	rotas.GET("/:id/pendencias", h.Pendencias, ver)
	rotas.POST("", h.Criar, lancar)
	rotas.POST("/importar-xml", h.ImportarXML, lancar)
	rotas.PUT("/:id", h.Atualizar, lancar)
	rotas.POST("/:id/conferir", h.Conferir, lancar)
	rotas.POST("/:id/cancelar", h.Cancelar, lancar)
	rotas.POST("/:id/efetivar", h.Efetivar, middleware.ExigirPermissao(acesso.NotasEfetivar))
	rotas.POST("/:id/estornar", h.Estornar, middleware.ExigirPermissao(acesso.NotasEstornar))

	grupo.GET("/fornecedores/:id/de-para", h.ListarDePara, autenticacao, ver)
	grupo.POST("/fornecedores/:id/de-para", h.SalvarDePara, autenticacao, lancar)
	grupo.DELETE("/de-para/:id", h.RemoverDePara, autenticacao, lancar)
}

func (h *NotaEntradaHandler) responder(c echo.Context, err error) error {
	var p *notaentrada.ErroDePendencias
	if errors.As(err, &p) {
		detalhes := make([]httpx.CampoInvalido, 0, len(p.Pendencias))
		for _, x := range p.Pendencias {
			campo := x.Tipo
			if x.ItemOrdem != nil {
				campo = fmt.Sprintf("item %d", *x.ItemOrdem)
			}
			detalhes = append(detalhes, httpx.CampoInvalido{Campo: campo, Mensagem: "[" + x.Nivel + "] " + x.Mensagem})
		}
		return c.JSON(http.StatusConflict, httpx.RespostaErro{Erro: httpx.DetalheErro{
			Codigo: CodigoPendencias, Mensagem: err.Error(), Detalhes: detalhes,
		}})
	}
	return errosNota.responder(c, err)
}

type notaRequest struct {
	PedidoCompraID int64              `json:"pedido_compra_id"`
	CNPJEmitente   string             `json:"cnpj_emitente"`
	Modelo         string             `json:"modelo"`
	Serie          string             `json:"serie"`
	Numero         string             `json:"numero"`
	ChaveAcesso    string             `json:"chave_acesso"`
	DataEmissao    tempo.Data         `json:"data_emissao"`
	DataEntrada    tempo.Data         `json:"data_entrada"`
	CFOP           string             `json:"cfop"`
	ValorProdutos  dinheiro.Dinheiro  `json:"valor_produtos"`
	ValorFrete     dinheiro.Dinheiro  `json:"valor_frete"`
	ValorSeguro    dinheiro.Dinheiro  `json:"valor_seguro"`
	ValorDesconto  dinheiro.Dinheiro  `json:"valor_desconto"`
	ValorIPI       dinheiro.Dinheiro  `json:"valor_ipi"`
	ValorICMSST    dinheiro.Dinheiro  `json:"valor_icms_st"`
	ValorTotal     dinheiro.Dinheiro  `json:"valor_total"`
	Observacoes    string             `json:"observacoes"`
	Origem         string             `json:"origem"`
	Itens          []notaentrada.Item `json:"itens"`
}

func (r notaRequest) dados() notaentrada.Dados {
	return notaentrada.Dados{
		PedidoCompraID: r.PedidoCompraID, CNPJEmitente: r.CNPJEmitente, Modelo: r.Modelo, Serie: r.Serie, Numero: r.Numero,
		ChaveAcesso: r.ChaveAcesso, DataEmissao: r.DataEmissao, DataEntrada: r.DataEntrada, CFOP: r.CFOP,
		ValorProdutos: r.ValorProdutos, ValorFrete: r.ValorFrete, ValorSeguro: r.ValorSeguro, ValorDesconto: r.ValorDesconto,
		ValorIPI: r.ValorIPI, ValorICMSST: r.ValorICMSST, ValorTotal: r.ValorTotal, Observacoes: r.Observacoes, Origem: r.Origem, Itens: r.Itens,
	}
}

func (h *NotaEntradaHandler) comFotos(c echo.Context, n *notaentrada.Nota) {
	ids := make([]int64, len(n.Itens))
	for i := range n.Itens {
		ids[i] = n.Itens[i].PartePecaID
	}
	urls := miniaturas(c, h.fotos, arquivo.EntidadePeca, ids)
	for i := range n.Itens {
		n.Itens[i].FotoURL = urls[n.Itens[i].PartePecaID]
	}
}

func (h *NotaEntradaHandler) responderNota(c echo.Context, id int64, status int) error {
	n, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return h.responder(c, err)
	}
	h.comFotos(c, n)
	if pode, _ := middleware.TemPermissao(c, acesso.ProducaoCustos); !pode {
		for i := range n.Itens {
			n.Itens[i].CustoUnitarioEntrada = nil
		}
	}
	return c.JSON(status, httpx.RespostaSucesso{Sucesso: true, Dados: n})
}

// Listar devolve a pagina de notas (filtros: status, pedido_compra_id, busca).
func (h *NotaEntradaHandler) Listar(c echo.Context) error {
	params, err := consulta.AnalisarComStatus(c.QueryParams(), notaentrada.ColunasOrdenaveis, "data_entrada", notaentrada.StatusPermitidos)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}
	if c.QueryParam("ordem") == "" {
		params.Ordem = consulta.Decrescente
	}
	pc, _ := strconv.ParseInt(c.QueryParam("pedido_compra_id"), 10, 64)
	itens, total, err := h.servico.Listar(c.Request().Context(), params, pc)
	if err != nil {
		return h.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// Obter devolve a nota com os itens.
func (h *NotaEntradaHandler) Obter(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da nota deve ser numerico")
	}
	return h.responderNota(c, id, http.StatusOK)
}

// Pendencias confere a nota sem mudar nada.
func (h *NotaEntradaHandler) Pendencias(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da nota deve ser numerico")
	}
	p, err := h.servico.Pendencias(c.Request().Context(), id)
	if err != nil {
		return h.responder(c, err)
	}
	if p == nil {
		p = []notaentrada.Pendencia{}
	}
	return httpx.OK(c, p)
}

// Criar grava um rascunho.
func (h *NotaEntradaHandler) Criar(c echo.Context) error {
	var req notaRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if ok, err := h.certificadosVisiveis(c, req); !ok {
		return err
	}
	n, err := h.servico.Criar(c.Request().Context(), req.dados(), autorDaRequisicao(c))
	if err != nil {
		return h.responder(c, err)
	}
	return h.responderNota(c, n.ID, http.StatusCreated)
}

// certificadosVisiveis recusa certificado (arquivo_id) que o usuario nao
// enviou nem pode ver por outro registro -- a mesma regra de POST /anexos.
// ok=false: a resposta ja foi escrita.
func (h *NotaEntradaHandler) certificadosVisiveis(c echo.Context, req notaRequest) (bool, error) {
	if h.fotos == nil {
		return true, nil
	}
	var ids []string
	for _, it := range req.Itens {
		if it.CertificadoArquivoID != nil {
			ids = append(ids, *it.CertificadoArquivoID)
		}
		for _, l := range it.Lotes {
			if l.CertificadoArquivoID != nil {
				ids = append(ids, *l.CertificadoArquivoID)
			}
		}
	}
	for _, id := range ids {
		if !arquivo.IDValido(id) {
			continue // o dominio responde 400 (certificado invalido)
		}
		pode, err := podeVerArquivo(c, h.fotos, id)
		if errors.Is(err, arquivo.ErrNaoEncontrado) {
			continue
		}
		if err != nil {
			return false, h.responder(c, err)
		}
		if !pode {
			return false, httpx.AcessoNegado(c, "Certificado anexado de um arquivo que voce nao pode ver")
		}
	}
	return true, nil
}

// Atualizar regrava o rascunho.
func (h *NotaEntradaHandler) Atualizar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da nota deve ser numerico")
	}
	var req notaRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if ok, err := h.certificadosVisiveis(c, req); !ok {
		return err
	}
	if _, err := h.servico.Atualizar(c.Request().Context(), id, req.dados(), autorDaRequisicao(c)); err != nil {
		return h.responder(c, err)
	}
	return h.responderNota(c, id, http.StatusOK)
}

func (h *NotaEntradaHandler) acao(c echo.Context, f func(id int64) error) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da nota deve ser numerico")
	}
	if err := f(id); err != nil {
		return h.responder(c, err)
	}
	return h.responderNota(c, id, http.StatusOK)
}

// Conferir passa a nota a Conferida (ou devolve as pendencias).
func (h *NotaEntradaHandler) Conferir(c echo.Context) error {
	return h.acao(c, func(id int64) error {
		_, err := h.servico.Conferir(c.Request().Context(), id, autorDaRequisicao(c))
		return err
	})
}

// Efetivar da a entrada no estoque.
func (h *NotaEntradaHandler) Efetivar(c echo.Context) error {
	podeAprovar, err := middleware.TemPermissao(c, acesso.NotasAprovarDivergencia)
	if err != nil {
		return h.responder(c, err)
	}
	return h.acao(c, func(id int64) error {
		return h.servico.Efetivar(c.Request().Context(), id, podeAprovar, autorDaRequisicao(c))
	})
}

// Cancelar descarta uma nota nao efetivada.
func (h *NotaEntradaHandler) Cancelar(c echo.Context) error {
	return h.acao(c, func(id int64) error { return h.servico.Cancelar(c.Request().Context(), id, autorDaRequisicao(c)) })
}

// Estornar desfaz uma nota efetivada (motivo obrigatorio).
func (h *NotaEntradaHandler) Estornar(c echo.Context) error {
	var req struct {
		Motivo string `json:"motivo"`
	}
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	return h.acao(c, func(id int64) error {
		return h.servico.Estornar(c.Request().Context(), id, req.Motivo, autorDaRequisicao(c))
	})
}

// ListarDePara devolve os vinculos item x fornecedor.
func (h *NotaEntradaHandler) ListarDePara(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do fornecedor deve ser numerico")
	}
	lista, err := h.servico.ListarDePara(c.Request().Context(), id)
	if err != nil {
		return h.responder(c, err)
	}
	return httpx.OK(c, lista)
}

// SalvarDePara cria ou atualiza um vinculo.
func (h *NotaEntradaHandler) SalvarDePara(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do fornecedor deve ser numerico")
	}
	var d notaentrada.DePara
	if err := c.Bind(&d); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	d.FornecedorID = id
	salvo, err := h.servico.SalvarDePara(c.Request().Context(), d, autorDaRequisicao(c))
	if err != nil {
		return h.responder(c, err)
	}
	return httpx.OK(c, salvo)
}

// RemoverDePara apaga um vinculo.
func (h *NotaEntradaHandler) RemoverDePara(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador deve ser numerico")
	}
	if err := h.servico.RemoverDePara(c.Request().Context(), id); err != nil {
		return h.responder(c, err)
	}
	return httpx.SemConteudo(c)
}

// ImportarXML le o XML da NF-e (multipart: pedido_compra_id e arquivo) e
// devolve a previa -- os itens reconhecidos pelo de-para e os que faltam
// vincular. O XML fica guardado (arquivo_id) para ser anexado a nota.
func (h *NotaEntradaHandler) ImportarXML(c echo.Context) error {
	c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, arquivo.LimiteXML+(1<<20))
	if err := c.Request().ParseMultipartForm(1 << 20); err != nil {
		var grande *http.MaxBytesError
		if errors.As(err, &grande) {
			return h.responder(c, notaentrada.ErrXMLGrande)
		}
		return erroRequisicaoInvalida(c, "Envie pedido_compra_id e o arquivo (multipart/form-data)")
	}
	pc, err := strconv.ParseInt(c.FormValue("pedido_compra_id"), 10, 64)
	if err != nil || pc <= 0 {
		return erroRequisicaoInvalida(c, "Informe pedido_compra_id")
	}
	cab, err := c.FormFile("arquivo")
	if err != nil {
		return erroRequisicaoInvalida(c, "Envie o XML no campo 'arquivo'")
	}
	f, err := cab.Open()
	if err != nil {
		return erroRequisicaoInvalida(c, "Nao foi possivel ler o arquivo")
	}
	defer f.Close()
	conteudo, err := io.ReadAll(io.LimitReader(f, arquivo.LimiteXML+1))
	if err != nil {
		return erroRequisicaoInvalida(c, "Nao foi possivel ler o arquivo")
	}
	if len(conteudo) > arquivo.LimiteXML {
		return h.responder(c, notaentrada.ErrXMLGrande)
	}
	previa, err := h.servico.Previa(c.Request().Context(), pc, conteudo)
	if err != nil {
		return h.responder(c, err)
	}
	if h.fotos != nil {
		a, err := h.fotos.Enviar(c.Request().Context(), cab.Filename, conteudo, autorDaRequisicao(c))
		if err != nil {
			return h.responder(c, err)
		}
		if a.TipoMime != arquivo.MimeXML {
			return h.responder(c, notaentrada.ErrXMLInvalido)
		}
		previa.ArquivoID = a.ID
	}
	return httpx.OK(c, previa)
}
