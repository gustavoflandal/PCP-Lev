package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

// errosFornecedor mapeia os erros do dominio de fornecedores para o doc 3.
var errosFornecedor = mapaDeErros{
	{fornecedor.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{fornecedor.ErrCNPJDuplicado, http.StatusConflict, httpx.CodigoConflito},
	{fornecedor.ErrPossuiPedidosPendentes, http.StatusConflict, httpx.CodigoConflito},
	{fornecedor.ErrRazaoSocialObrigatoria, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{fornecedor.ErrCNPJInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{fornecedor.ErrEmailInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{fornecedor.ErrTelefoneInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{fornecedor.ErrLeadTimeInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// FornecedorHandler atende /fornecedores (RF1.4).
type FornecedorHandler struct {
	servico *fornecedor.Servico
}

// NovoFornecedorHandler cria o handler de fornecedores.
func NovoFornecedorHandler(servico *fornecedor.Servico) *FornecedorHandler {
	return &FornecedorHandler{servico: servico}
}

// Registrar publica as rotas do cadastro.
func (h *FornecedorHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/fornecedores", autenticacao)
	gestao := middleware.ExigirPerfil(usuario.PerfilAdmin, usuario.PerfilGestor)

	rotas.GET("", h.Listar)
	rotas.GET("/:id", h.Obter)
	rotas.POST("", h.Criar, gestao)
	rotas.PUT("/:id", h.Atualizar, gestao)
	rotas.DELETE("/:id", h.Excluir, gestao)
}

// fornecedorRequest e o corpo de POST e PUT.
//
// CNPJ, email e telefone chegam como o usuario digitou (pontuados); a forma
// canonica e a validade sao resolvidas no dominio, entao aqui so se confere
// presenca e tamanho maximo.
type fornecedorRequest struct {
	RazaoSocial       string `json:"razao_social" validate:"required,max=255"`
	CNPJ              string `json:"cnpj" validate:"required,max=18"`
	ContatoNome       string `json:"contato_nome" validate:"max=100"`
	ContatoEmail      string `json:"contato_email" validate:"max=100"`
	ContatoTelefone   string `json:"contato_telefone" validate:"max=20"`
	Endereco          string `json:"endereco" validate:"max=255"`
	LeadTimeMedio     int    `json:"lead_time_medio" validate:"required,min=1"`
	CondicaoPagamento string `json:"condicao_pagamento" validate:"max=50"`
	Ativo             *bool  `json:"ativo"`
}

func (r fornecedorRequest) paraDados() fornecedor.Dados {
	return fornecedor.Dados{
		RazaoSocial:       r.RazaoSocial,
		CNPJ:              r.CNPJ,
		ContatoNome:       r.ContatoNome,
		ContatoEmail:      r.ContatoEmail,
		ContatoTelefone:   r.ContatoTelefone,
		Endereco:          r.Endereco,
		LeadTimeMedio:     r.LeadTimeMedio,
		CondicaoPagamento: r.CondicaoPagamento,
		Ativo:             r.Ativo,
	}
}

// Criar cadastra um fornecedor.
func (h *FornecedorHandler) Criar(c echo.Context) error {
	req, ok := lerFornecedorRequest(c)
	if !ok {
		return nil
	}

	criado, err := h.servico.Criar(c.Request().Context(), req.paraDados(), autorDaRequisicao(c))
	if err != nil {
		return errosFornecedor.responder(c, err)
	}
	return httpx.Criado(c, criado)
}

// Listar devolve a pagina de fornecedores.
func (h *FornecedorHandler) Listar(c echo.Context) error {
	params, err := consulta.Analisar(c.QueryParams(), fornecedor.ColunasOrdenaveis, "razao_social")
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	itens, total, err := h.servico.Listar(c.Request().Context(), params)
	if err != nil {
		return errosFornecedor.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// Obter devolve um fornecedor especifico.
func (h *FornecedorHandler) Obter(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do fornecedor deve ser numerico")
	}

	f, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosFornecedor.responder(c, err)
	}
	return httpx.OK(c, f)
}

// Atualizar altera um fornecedor.
func (h *FornecedorHandler) Atualizar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do fornecedor deve ser numerico")
	}

	req, ok := lerFornecedorRequest(c)
	if !ok {
		return nil
	}

	atualizado, err := h.servico.Atualizar(c.Request().Context(), id, req.paraDados(), autorDaRequisicao(c))
	if err != nil {
		return errosFornecedor.responder(c, err)
	}
	return httpx.OK(c, atualizado)
}

// Excluir inativa um fornecedor.
func (h *FornecedorHandler) Excluir(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do fornecedor deve ser numerico")
	}

	if err := h.servico.Excluir(c.Request().Context(), id, autorDaRequisicao(c)); err != nil {
		return errosFornecedor.responder(c, err)
	}
	return httpx.SemConteudo(c)
}

// lerFornecedorRequest interpreta e valida o corpo; ok=false significa que a
// resposta de erro ja foi escrita.
func lerFornecedorRequest(c echo.Context) (fornecedorRequest, bool) {
	var req fornecedorRequest
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
