package handlers

import (
	"context"
	"encoding/base64"
	"log/slog"
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/empresa"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

var errosEmpresa = mapaDeErros{
	{empresa.ErrRazaoSocialObrigatoria, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{empresa.ErrCNPJInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{empresa.ErrUFInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{empresa.ErrEmailInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{empresa.ErrImagemFormatoInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{empresa.ErrImagemMuitoGrande, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{empresa.ErrImagemPequenaDemais, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// EmpresaHandler atende /configuracoes/empresa (doc 0, secao 4.6.2).
type EmpresaHandler struct {
	servico *empresa.Servico
}

// NovoEmpresaHandler cria o handler de dados da empresa.
func NovoEmpresaHandler(servico *empresa.Servico) *EmpresaHandler {
	return &EmpresaHandler{servico: servico}
}

// Registrar publica as rotas do modulo. Leitura (dados e imagens) fica sem
// `autenticacao`: a tela de login e o favicon do navegador precisam do nome
// e do logo da empresa antes de qualquer sessao existir, e nada aqui e
// sigiloso -- e o que consta em qualquer nota fiscal da empresa. Escrita
// exige perfil Administrador (mais restrito que PodeGerenciarCadastros, por
// ser configuracao de sistema, nao cadastro de negocio).
func (h *EmpresaHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	admin := middleware.ExigirPerfil(usuario.PerfilAdmin)

	rotas := grupo.Group("/configuracoes/empresa")
	rotas.GET("", h.Buscar)
	rotas.PUT("", h.Atualizar, autenticacao, admin)

	rotas.GET("/logotipo/claro", h.ServirLogoClaro)
	rotas.PUT("/logotipo/claro", h.AtualizarLogoClaro, autenticacao, admin)

	rotas.GET("/logotipo/escuro", h.ServirLogoEscuro)
	rotas.PUT("/logotipo/escuro", h.AtualizarLogoEscuro, autenticacao, admin)

	rotas.GET("/favicon", h.ServirFavicon)
	rotas.PUT("/favicon", h.AtualizarFavicon, autenticacao, admin)
}

// Buscar devolve a configuracao atual (publico).
func (h *EmpresaHandler) Buscar(c echo.Context) error {
	e, err := h.servico.Buscar(c.Request().Context())
	if err != nil {
		return errosEmpresa.responder(c, err)
	}
	return httpx.OK(c, e)
}

type dadosEmpresaRequest struct {
	RazaoSocial           string `json:"razao_social"`
	NomeFantasia          string `json:"nome_fantasia"`
	CNPJ                  string `json:"cnpj"`
	InscricaoEstadual     string `json:"inscricao_estadual"`
	InscricaoMunicipal    string `json:"inscricao_municipal"`
	CNAE                  string `json:"cnae"`
	CEP                   string `json:"cep"`
	Logradouro            string `json:"logradouro"`
	Numero                string `json:"numero"`
	Complemento           string `json:"complemento"`
	Bairro                string `json:"bairro"`
	Cidade                string `json:"cidade"`
	UF                    string `json:"uf"`
	Telefone              string `json:"telefone"`
	Email                 string `json:"email"`
	Site                  string `json:"site"`
	RodapePadrao          string `json:"rodape_padrao"`
	CondicoesGeraisCompra string `json:"condicoes_gerais_compra"`
	ResponsavelTecnico    string `json:"responsavel_tecnico"`
}

// Atualizar grava os campos de texto da empresa (Administrador).
func (h *EmpresaHandler) Atualizar(c echo.Context) error {
	claims := middleware.ClaimsDoContexto(c)
	if claims == nil {
		return httpx.NaoAutorizado(c, "Token de acesso ausente")
	}

	var req dadosEmpresaRequest
	if err := c.Bind(&req); err != nil {
		return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoRequisicaoInvalida, "Corpo da requisicao invalido")
	}

	dados := empresa.Dados{
		RazaoSocial: req.RazaoSocial, NomeFantasia: req.NomeFantasia, CNPJ: req.CNPJ,
		InscricaoEstadual: req.InscricaoEstadual, InscricaoMunicipal: req.InscricaoMunicipal,
		CNAE: req.CNAE, CEP: req.CEP, Logradouro: req.Logradouro, Numero: req.Numero,
		Complemento: req.Complemento, Bairro: req.Bairro, Cidade: req.Cidade, UF: req.UF,
		Telefone: req.Telefone, Email: req.Email, Site: req.Site,
		RodapePadrao: req.RodapePadrao, CondicoesGeraisCompra: req.CondicoesGeraisCompra,
		ResponsavelTecnico: req.ResponsavelTecnico,
	}

	atualizada, err := h.servico.Atualizar(c.Request().Context(), dados, claims.Username)
	if err != nil {
		return errosEmpresa.responder(c, err)
	}
	return httpx.OK(c, atualizada)
}

// imagemRequest e o corpo de PUT .../logotipo/claro|escuro e .../favicon.
// DadosBase64 vazio remove a imagem atual em vez de ser rejeitado.
type imagemRequest struct {
	DadosBase64 string `json:"dados_base64"`
	Mime        string `json:"mime"`
}

func (h *EmpresaHandler) AtualizarLogoClaro(c echo.Context) error {
	return h.atualizarImagem(c, h.servico.AtualizarLogoClaro)
}

func (h *EmpresaHandler) AtualizarLogoEscuro(c echo.Context) error {
	return h.atualizarImagem(c, h.servico.AtualizarLogoEscuro)
}

func (h *EmpresaHandler) AtualizarFavicon(c echo.Context) error {
	return h.atualizarImagem(c, h.servico.AtualizarFavicon)
}

func (h *EmpresaHandler) atualizarImagem(c echo.Context, gravar func(ctx context.Context, dados []byte, mime string) error) error {
	var req imagemRequest
	if err := c.Bind(&req); err != nil {
		return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoRequisicaoInvalida, "Corpo da requisicao invalido")
	}

	var dados []byte
	if req.DadosBase64 != "" {
		decodificados, err := base64.StdEncoding.DecodeString(req.DadosBase64)
		if err != nil {
			return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoErroValidacao, "Imagem em base64 invalida")
		}
		dados = decodificados
	}

	if err := gravar(c.Request().Context(), dados, req.Mime); err != nil {
		return errosEmpresa.responder(c, err)
	}

	e, err := h.servico.Buscar(c.Request().Context())
	if err != nil {
		return errosEmpresa.responder(c, err)
	}
	return httpx.OK(c, e)
}

func (h *EmpresaHandler) ServirLogoClaro(c echo.Context) error {
	return h.servirImagem(c, h.servico.BuscarLogoClaro)
}

func (h *EmpresaHandler) ServirLogoEscuro(c echo.Context) error {
	return h.servirImagem(c, h.servico.BuscarLogoEscuro)
}

func (h *EmpresaHandler) ServirFavicon(c echo.Context) error {
	return h.servirImagem(c, h.servico.BuscarFavicon)
}

func (h *EmpresaHandler) servirImagem(c echo.Context, buscar func(ctx context.Context) ([]byte, string, error)) error {
	dados, tipo, err := buscar(c.Request().Context())
	if err != nil {
		slog.Error("falha ao buscar imagem da empresa", "rota", c.Request().URL.Path, "erro", err)
		return httpx.ErroInterno(c)
	}
	if tipo == "" {
		return httpx.NaoEncontrado(c, "Imagem nao configurada")
	}

	// Sempre revalida: a URL nao muda quando a imagem muda (nenhum
	// parametro de versao), entao um max-age exibiria o logo antigo por ate
	// esse tempo depois do administrador trocar. Sem ETag/Last-Modified
	// aqui, "no-cache" sempre busca de novo -- aceitavel para um arquivo
	// pequeno pedido poucas vezes por sessao (cabecalho, login).
	c.Response().Header().Set("Cache-Control", "no-cache")
	return c.Blob(http.StatusOK, tipo, dados)
}
