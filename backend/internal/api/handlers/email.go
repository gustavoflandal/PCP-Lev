package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/email"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/i18n"
	"github.com/labstack/echo/v4"
)

var errosEmail = mapaDeErros{
	{email.ErrPortaInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{email.ErrCriptografiaInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{email.ErrHostObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{email.ErrRemetenteInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{email.ErrSenhaETrocaConflitantes, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{email.ErrDestinatarioInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{email.ErrSenhaAoTrocarDestino, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{email.ErrAutenticacaoSemTLS, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{email.ErrCampoLongoDemais, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{email.ErrChaveMestraAusente, http.StatusConflict, httpx.CodigoConflito},
	{email.ErrNaoConfigurado, http.StatusConflict, httpx.CodigoConflito},
	{email.ErrSenhaIlegivel, http.StatusConflict, httpx.CodigoConflito},
	{email.ErrEnvioFalhou, http.StatusBadGateway, httpx.CodigoServicoExterno},
}

// EmailHandler atende /configuracoes/smtp (doc 0, secao 4.7.7).
type EmailHandler struct {
	servico *email.Servico
}

// NovoEmailHandler cria o handler do servidor de e-mail.
func NovoEmailHandler(servico *email.Servico) *EmailHandler {
	return &EmailHandler{servico: servico}
}

// Registrar publica as rotas (permissao configuracoes.integracoes).
func (h *EmailHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/configuracoes/smtp", autenticacao, middleware.ExigirPermissao(acesso.ConfigIntegracoes))
	rotas.GET("", h.Buscar)
	rotas.PUT("", h.Atualizar)
	rotas.POST("/testar", h.Testar)
}

// Buscar devolve a configuracao, sem a senha.
func (h *EmailHandler) Buscar(c echo.Context) error {
	cfg, err := h.servico.Buscar(c.Request().Context())
	if err != nil {
		return errosEmail.responder(c, err)
	}
	return httpx.OK(c, cfg)
}

type dadosSMTPRequest struct {
	Habilitado     bool               `json:"habilitado"`
	Host           string             `json:"host"`
	Porta          int                `json:"porta"`
	Criptografia   email.Criptografia `json:"criptografia"`
	Usuario        string             `json:"usuario"`
	Senha          string             `json:"senha"`
	RemoverSenha   bool               `json:"remover_senha"`
	RemetenteEmail string             `json:"remetente_email"`
	RemetenteNome  string             `json:"remetente_nome"`
}

// Atualizar grava a configuracao. Senha vazia mantem a atual.
func (h *EmailHandler) Atualizar(c echo.Context) error {
	var req dadosSMTPRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	cfg, err := h.servico.Atualizar(c.Request().Context(), email.Dados(req), autorDaRequisicao(c))
	if err != nil {
		return errosEmail.responder(c, err)
	}
	return httpx.OK(c, cfg)
}

type testeSMTPRequest struct {
	Destinatario string `json:"destinatario"`
}

// Testar envia um e-mail de teste com a configuracao salva.
func (h *EmailHandler) Testar(c echo.Context) error {
	var req testeSMTPRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if err := h.servico.EnviarTesteIdioma(c.Request().Context(), req.Destinatario, autorDaRequisicao(c), i18n.Idioma(c)); err != nil {
		return errosEmail.responder(c, err)
	}
	return httpx.OK(c, map[string]bool{"enviado": true})
}
