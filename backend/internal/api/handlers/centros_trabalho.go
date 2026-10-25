package handlers

import (
	"net/http"
	"slices"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/centrotrabalho"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

var errosCentro = mapaDeErros{
	{centrotrabalho.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{centrotrabalho.ErrCodigoDuplicado, http.StatusConflict, httpx.CodigoConflito},
	{centrotrabalho.ErrCodigoInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{centrotrabalho.ErrNomeObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{centrotrabalho.ErrEtapaInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{centrotrabalho.ErrCapacidadeInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{centrotrabalho.ErrDescricaoLonga, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{centrotrabalho.ErrCustoHoraInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// CentroTrabalhoHandler atende /centros-trabalho (doc 0, secao 4.1).
type CentroTrabalhoHandler struct {
	servico *centrotrabalho.Servico
}

// NovoCentroTrabalhoHandler cria o handler de centros de trabalho.
func NovoCentroTrabalhoHandler(servico *centrotrabalho.Servico) *CentroTrabalhoHandler {
	return &CentroTrabalhoHandler{servico: servico}
}

// Registrar publica as rotas do cadastro.
func (h *CentroTrabalhoHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/centros-trabalho", autenticacao)
	rotas.GET("", h.Listar, middleware.ExigirPermissao(acesso.CentrosVisualizar))
	rotas.GET("/:id", h.Obter, middleware.ExigirPermissao(acesso.CentrosVisualizar))
	rotas.POST("", h.Criar, middleware.ExigirPermissao(acesso.CentrosIncluir))
	rotas.PUT("/:id", h.Atualizar, middleware.ExigirPermissao(acesso.CentrosEditar))
	rotas.DELETE("/:id", h.Excluir, middleware.ExigirPermissao(acesso.CentrosInativar))
}

type centroRequest struct {
	Codigo             string   `json:"codigo"`
	Nome               string   `json:"nome"`
	Etapa              string   `json:"etapa"`
	CapacidadeHorasDia *float64 `json:"capacidade_horas_dia"`
	CustoHora          *float64 `json:"custo_hora"`
	Descricao          string   `json:"descricao"`
	Ativo              *bool    `json:"ativo"`
}

func (r centroRequest) dados() centrotrabalho.Dados {
	return centrotrabalho.Dados{
		Codigo: r.Codigo, Nome: r.Nome, Etapa: r.Etapa, CapacidadeHorasDia: r.CapacidadeHorasDia, CustoHora: r.CustoHora,
		Descricao: r.Descricao, Ativo: r.Ativo,
	}
}

// Listar devolve a pagina de centros de trabalho (filtro extra: etapa).
func (h *CentroTrabalhoHandler) Listar(c echo.Context) error {
	params, err := consulta.Analisar(c.QueryParams(), centrotrabalho.ColunasOrdenaveis, "codigo")
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}
	etapa := c.QueryParam("etapa")
	if etapa != "" && !slices.Contains(centrotrabalho.EtapasValidas, etapa) {
		return erroRequisicaoInvalida(c, "etapa invalida")
	}
	itens, total, err := h.servico.Listar(c.Request().Context(), params, etapa)
	if err != nil {
		return errosCentro.responder(c, err)
	}
	for i := range itens {
		ocultarCustoHora(c, &itens[i])
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// Obter devolve um centro de trabalho.
func (h *CentroTrabalhoHandler) Obter(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do centro de trabalho deve ser numerico")
	}
	ct, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosCentro.responder(c, err)
	}
	ocultarCustoHora(c, ct)
	return httpx.OK(c, ct)
}

// Criar cadastra um centro de trabalho.
func (h *CentroTrabalhoHandler) Criar(c echo.Context) error {
	var req centroRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	dados := req.dados()
	if pode, _ := middleware.TemPermissao(c, acesso.ProducaoCustos); !pode {
		dados.CustoHora = nil
	}
	ct, err := h.servico.Criar(c.Request().Context(), dados, autorDaRequisicao(c))
	if err != nil {
		return errosCentro.responder(c, err)
	}
	ocultarCustoHora(c, ct)
	return httpx.Criado(c, ct)
}

// Atualizar altera um centro de trabalho (o codigo nao muda).
func (h *CentroTrabalhoHandler) Atualizar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do centro de trabalho deve ser numerico")
	}
	var req centroRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	dados := req.dados()
	// Sem producao.custos o formulario nem recebe o custo/hora: manter o atual.
	if pode, _ := middleware.TemPermissao(c, acesso.ProducaoCustos); !pode {
		dados.ManterCustoHora = true
	}
	ct, err := h.servico.Atualizar(c.Request().Context(), id, dados, autorDaRequisicao(c))
	if err != nil {
		return errosCentro.responder(c, err)
	}
	ocultarCustoHora(c, ct)
	return httpx.OK(c, ct)
}

// Excluir inativa um centro de trabalho.
func (h *CentroTrabalhoHandler) Excluir(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do centro de trabalho deve ser numerico")
	}
	if err := h.servico.Excluir(c.Request().Context(), id, autorDaRequisicao(c)); err != nil {
		return errosCentro.responder(c, err)
	}
	return httpx.SemConteudo(c)
}

// ocultarCustoHora: custo/hora e informacao de custo (producao.custos).
func ocultarCustoHora(c echo.Context, ct *centrotrabalho.CentroTrabalho) {
	if pode, _ := middleware.TemPermissao(c, acesso.ProducaoCustos); !pode {
		ct.CustoHora = nil
	}
}
