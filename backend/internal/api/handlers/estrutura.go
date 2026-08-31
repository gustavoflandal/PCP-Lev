package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/labstack/echo/v4"
)

var errosEstrutura = mapaDeErros{
	{estrutura.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{estrutura.ErrJaPossuiEstruturaAtiva, http.StatusConflict, httpx.CodigoConflito},
	{estrutura.ErrStatusInvalidoParaAcao, http.StatusConflict, httpx.CodigoConflito},
	{estrutura.ErrVigenciaAnteriorAAtual, http.StatusConflict, httpx.CodigoConflito},
	{estrutura.ErrProdutoAcabadoObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estrutura.ErrProdutoAcabadoInexistente, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estrutura.ErrItensObrigatorios, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estrutura.ErrQuantidadeInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estrutura.ErrPartePecaInexistente, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estrutura.ErrDataVigenciaObrigatoria, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{estrutura.ErrDataVigenciaFimInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// EstruturaHandler atende /boms e /produtos-acabados/{id}/boms (RF1.3).
type EstruturaHandler struct {
	servico *estrutura.Servico
}

// NovoEstruturaHandler cria o handler de estrutura de produto.
func NovoEstruturaHandler(servico *estrutura.Servico) *EstruturaHandler {
	return &EstruturaHandler{servico: servico}
}

// Registrar publica as rotas do modulo.
func (h *EstruturaHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	gestao := middleware.ExigirPerfil(usuario.PerfilAdmin, usuario.PerfilGestor)

	rotas := grupo.Group("/boms", autenticacao)
	rotas.POST("", h.Criar, gestao)
	rotas.GET("/:id", h.Obter)
	rotas.POST("/:id/versionar", h.Versionar, gestao)

	grupo.GET("/produtos-acabados/:id/boms", h.ListarPorProduto, autenticacao)
}

type itemEstruturaRequest struct {
	PartePecaID int64 `json:"parte_peca_id" validate:"required"`
	Quantidade  int   `json:"quantidade" validate:"required,gt=0"`
}

type criarEstruturaRequest struct {
	ProdutoAcabadoID   int64                  `json:"produto_acabado_id" validate:"required"`
	DataVigenciaInicio string                 `json:"data_vigencia_inicio" validate:"required"`
	DataVigenciaFim    string                 `json:"data_vigencia_fim"`
	Itens              []itemEstruturaRequest `json:"itens" validate:"required,min=1,dive"`
}

func (r criarEstruturaRequest) paraDados() (estrutura.Dados, error) {
	inicio, err := tempo.DeString(r.DataVigenciaInicio)
	if err != nil {
		return estrutura.Dados{}, err
	}
	var fim tempo.Data
	if r.DataVigenciaFim != "" {
		fim, err = tempo.DeString(r.DataVigenciaFim)
		if err != nil {
			return estrutura.Dados{}, err
		}
	}
	itens := make([]estrutura.ItemDados, len(r.Itens))
	for i, item := range r.Itens {
		itens[i] = estrutura.ItemDados{PartePecaID: item.PartePecaID, Quantidade: item.Quantidade}
	}
	return estrutura.Dados{
		ProdutoAcabadoID: r.ProdutoAcabadoID, DataVigenciaInicio: inicio, DataVigenciaFim: fim, Itens: itens,
	}, nil
}

type versionarEstruturaRequest struct {
	DataVigenciaInicio string                 `json:"data_vigencia_inicio" validate:"required"`
	DataVigenciaFim    string                 `json:"data_vigencia_fim"`
	Itens              []itemEstruturaRequest `json:"itens" validate:"required,min=1,dive"`
}

func (r versionarEstruturaRequest) paraDados() (estrutura.Dados, error) {
	inicio, err := tempo.DeString(r.DataVigenciaInicio)
	if err != nil {
		return estrutura.Dados{}, err
	}
	var fim tempo.Data
	if r.DataVigenciaFim != "" {
		fim, err = tempo.DeString(r.DataVigenciaFim)
		if err != nil {
			return estrutura.Dados{}, err
		}
	}
	itens := make([]estrutura.ItemDados, len(r.Itens))
	for i, item := range r.Itens {
		itens[i] = estrutura.ItemDados{PartePecaID: item.PartePecaID, Quantidade: item.Quantidade}
	}
	return estrutura.Dados{DataVigenciaInicio: inicio, DataVigenciaFim: fim, Itens: itens}, nil
}

// Criar cadastra a primeira versao da BOM de um produto.
func (h *EstruturaHandler) Criar(c echo.Context) error {
	var req criarEstruturaRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if problemas := httpx.Validar(req); problemas != nil {
		return httpx.ErroValidacao(c, problemas)
	}
	dados, err := req.paraDados()
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	criada, err := h.servico.Criar(c.Request().Context(), dados, autorDaRequisicao(c))
	if err != nil {
		return errosEstrutura.responder(c, err)
	}
	return httpx.Criado(c, criada)
}

// Obter devolve uma versao especifica da estrutura, com os itens.
func (h *EstruturaHandler) Obter(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da estrutura deve ser numerico")
	}
	encontrada, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosEstrutura.responder(c, err)
	}
	return httpx.OK(c, encontrada)
}

// Versionar substitui a estrutura ativa por uma nova versao.
func (h *EstruturaHandler) Versionar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da estrutura deve ser numerico")
	}
	var req versionarEstruturaRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if problemas := httpx.Validar(req); problemas != nil {
		return httpx.ErroValidacao(c, problemas)
	}
	dados, err := req.paraDados()
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	nova, err := h.servico.Versionar(c.Request().Context(), id, dados, autorDaRequisicao(c))
	if err != nil {
		return errosEstrutura.responder(c, err)
	}
	return httpx.Criado(c, nova)
}

// ListarPorProduto devolve o historico completo de um produto.
func (h *EstruturaHandler) ListarPorProduto(c echo.Context) error {
	produtoID, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do produto deve ser numerico")
	}
	historico, err := h.servico.ListarPorProduto(c.Request().Context(), produtoID)
	if err != nil {
		return errosEstrutura.responder(c, err)
	}
	return httpx.OK(c, historico)
}
