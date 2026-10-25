package handlers

import (
	"net/http"
	"regexp"
	"slices"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cliente"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/documento"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/labstack/echo/v4"
)

var pareceCNPJ = regexp.MustCompile(`^[0-9]{2}[0-9./-]{6,}$`)

var errosCliente = mapaDeErros{
	{cliente.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{cliente.ErrCNPJDuplicado, http.StatusConflict, httpx.CodigoConflito},
	{cliente.ErrTipoInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cliente.ErrRazaoSocialObrigatoria, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cliente.ErrCNPJInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cliente.ErrEmailInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cliente.ErrTelefoneInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cliente.ErrUFInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cliente.ErrVigenciaInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{cliente.ErrCampoLongo, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// ClienteHandler atende /clientes (doc 0, secao 4.1).
type ClienteHandler struct {
	servico *cliente.Servico
}

// NovoClienteHandler cria o handler de clientes.
func NovoClienteHandler(servico *cliente.Servico) *ClienteHandler {
	return &ClienteHandler{servico: servico}
}

// Registrar publica as rotas do cadastro.
func (h *ClienteHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/clientes", autenticacao)
	rotas.GET("", h.Listar, middleware.ExigirPermissao(acesso.ClientesVisualizar))
	rotas.GET("/:id", h.Obter, middleware.ExigirPermissao(acesso.ClientesVisualizar))
	rotas.POST("", h.Criar, middleware.ExigirPermissao(acesso.ClientesIncluir))
	rotas.PUT("/:id", h.Atualizar, middleware.ExigirPermissao(acesso.ClientesEditar))
	rotas.DELETE("/:id", h.Excluir, middleware.ExigirPermissao(acesso.ClientesInativar))
}

type clienteRequest struct {
	Tipo              string     `json:"tipo"`
	RazaoSocial       string     `json:"razao_social"`
	NomeFantasia      string     `json:"nome_fantasia"`
	CNPJ              string     `json:"cnpj"`
	InscricaoEstadual string     `json:"inscricao_estadual"`
	ContatoNome       string     `json:"contato_nome"`
	ContatoEmail      string     `json:"contato_email"`
	ContatoTelefone   string     `json:"contato_telefone"`
	Endereco          string     `json:"endereco"`
	Cidade            string     `json:"cidade"`
	UF                string     `json:"uf"`
	NumeroContrato    string     `json:"numero_contrato"`
	VigenciaInicio    tempo.Data `json:"vigencia_inicio"`
	VigenciaFim       tempo.Data `json:"vigencia_fim"`
	CondicaoPagamento string     `json:"condicao_pagamento"`
	Observacoes       string     `json:"observacoes"`
	Ativo             *bool      `json:"ativo"`
}

func (r clienteRequest) dados() cliente.Dados {
	return cliente.Dados{
		Tipo: r.Tipo, RazaoSocial: r.RazaoSocial, NomeFantasia: r.NomeFantasia, CNPJ: r.CNPJ,
		InscricaoEstadual: r.InscricaoEstadual, ContatoNome: r.ContatoNome, ContatoEmail: r.ContatoEmail,
		ContatoTelefone: r.ContatoTelefone, Endereco: r.Endereco, Cidade: r.Cidade, UF: r.UF,
		NumeroContrato: r.NumeroContrato, VigenciaInicio: r.VigenciaInicio, VigenciaFim: r.VigenciaFim,
		CondicaoPagamento: r.CondicaoPagamento, Observacoes: r.Observacoes, Ativo: r.Ativo,
	}
}

// Listar devolve a pagina de clientes (filtro extra: tipo).
func (h *ClienteHandler) Listar(c echo.Context) error {
	params, err := consulta.Analisar(c.QueryParams(), cliente.ColunasOrdenaveis, "razao_social")
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}
	// O banco guarda o CNPJ so com digitos: "11.222.333/0001-81" digitado na
	// busca precisa virar "11222333000181" para achar.
	if pareceCNPJ.MatchString(params.Busca) {
		params.Busca = documento.ApenasDigitos(params.Busca)
	}
	tipo := c.QueryParam("tipo")
	if tipo != "" && !slices.Contains(cliente.TiposValidos, tipo) {
		return erroRequisicaoInvalida(c, "tipo invalido")
	}
	itens, total, err := h.servico.Listar(c.Request().Context(), params, tipo)
	if err != nil {
		return errosCliente.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// Obter devolve um cliente.
func (h *ClienteHandler) Obter(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do cliente deve ser numerico")
	}
	cl, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosCliente.responder(c, err)
	}
	return httpx.OK(c, cl)
}

// Criar cadastra um cliente.
func (h *ClienteHandler) Criar(c echo.Context) error {
	var req clienteRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	cl, err := h.servico.Criar(c.Request().Context(), req.dados(), autorDaRequisicao(c))
	if err != nil {
		return errosCliente.responder(c, err)
	}
	return httpx.Criado(c, cl)
}

// Atualizar altera um cliente.
func (h *ClienteHandler) Atualizar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do cliente deve ser numerico")
	}
	var req clienteRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	cl, err := h.servico.Atualizar(c.Request().Context(), id, req.dados(), autorDaRequisicao(c))
	if err != nil {
		return errosCliente.responder(c, err)
	}
	return httpx.OK(c, cl)
}

// Excluir inativa um cliente.
func (h *ClienteHandler) Excluir(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do cliente deve ser numerico")
	}
	if err := h.servico.Excluir(c.Request().Context(), id, autorDaRequisicao(c)); err != nil {
		return errosCliente.responder(c, err)
	}
	return httpx.SemConteudo(c)
}
