package handlers

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

var errosAcesso = mapaDeErros{
	{acesso.ErrPerfilNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{acesso.ErrAdminImutavel, http.StatusConflict, httpx.CodigoConflito},
	{acesso.ErrPerfilDoSistema, http.StatusConflict, httpx.CodigoConflito},
	{acesso.ErrPerfilEmUso, http.StatusConflict, httpx.CodigoConflito},
	{acesso.ErrCodigoDuplicado, http.StatusConflict, httpx.CodigoConflito},
	{acesso.ErrCodigoInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{acesso.ErrNomeObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{acesso.ErrPermissaoDesconhecida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{acesso.ErrDescricaoLonga, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{acesso.ErrProprioPerfil, http.StatusForbidden, httpx.CodigoAcessoNegado},
	{acesso.ErrConcederSemTer, http.StatusForbidden, httpx.CodigoAcessoNegado},
	{acesso.ErrPerfilAcimaDoEditor, http.StatusForbidden, httpx.CodigoAcessoNegado},
}

// AcessoHandler atende /acesso/* -- perfis e a matriz de permissoes (doc 0,
// secao 4.7.3).
type AcessoHandler struct {
	servico *acesso.Servico
}

// NovoAcessoHandler cria o handler de perfis e permissoes.
func NovoAcessoHandler(servico *acesso.Servico) *AcessoHandler {
	return &AcessoHandler{servico: servico}
}

// Registrar publica as rotas, todas com a permissao configuracoes.perfis.
func (h *AcessoHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/acesso", autenticacao, middleware.ExigirPermissao(acesso.ConfigPerfis))
	rotas.GET("/permissoes", h.Catalogo)
	rotas.GET("/perfis", h.ListarPerfis)
	rotas.GET("/perfis/:codigo", h.BuscarPerfil)
	rotas.POST("/perfis", h.CriarPerfil)
	rotas.PUT("/perfis/:codigo", h.AtualizarPerfil)
	rotas.DELETE("/perfis/:codigo", h.ExcluirPerfil)
}

// Catalogo devolve as permissoes existentes.
func (h *AcessoHandler) Catalogo(c echo.Context) error {
	catalogo, err := h.servico.Catalogo(c.Request().Context())
	if err != nil {
		return errosAcesso.responder(c, err)
	}
	return httpx.OK(c, catalogo)
}

// ListarPerfis devolve todos os perfis com as permissoes.
func (h *AcessoHandler) ListarPerfis(c echo.Context) error {
	perfis, err := h.servico.ListarPerfis(c.Request().Context())
	if err != nil {
		return errosAcesso.responder(c, err)
	}
	return httpx.OK(c, perfis)
}

// BuscarPerfil devolve um perfil.
func (h *AcessoHandler) BuscarPerfil(c echo.Context) error {
	perfil, err := h.servico.BuscarPerfil(c.Request().Context(), c.Param("codigo"))
	if err != nil {
		return errosAcesso.responder(c, err)
	}
	return httpx.OK(c, perfil)
}

type perfilRequest struct {
	Codigo     string   `json:"codigo"`
	Nome       string   `json:"nome"`
	Descricao  string   `json:"descricao"`
	Permissoes []string `json:"permissoes"`
}

func (r perfilRequest) dados() acesso.Dados {
	return acesso.Dados{Nome: r.Nome, Descricao: r.Descricao, Permissoes: r.Permissoes}
}

// editor descreve quem esta editando: o perfil atual e as permissoes efetivas.
func (h *AcessoHandler) editor(c echo.Context) (acesso.Editor, error) {
	a, err := middleware.AcessoDaRequisicao(c)
	return acesso.Editor{Perfil: a.Perfil, Permissoes: a.Permissoes}, err
}

// CriarPerfil cria um perfil personalizado.
func (h *AcessoHandler) CriarPerfil(c echo.Context) error {
	var req perfilRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	editor, err := h.editor(c)
	if err != nil {
		return errosAcesso.responder(c, err)
	}
	perfil, err := h.servico.CriarPerfil(c.Request().Context(), editor, req.Codigo, req.dados(), autorDaRequisicao(c))
	if err != nil {
		return errosAcesso.responder(c, err)
	}
	return httpx.Criado(c, perfil)
}

// AtualizarPerfil troca nome, descricao e o conjunto inteiro de permissoes.
func (h *AcessoHandler) AtualizarPerfil(c echo.Context) error {
	var req perfilRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	editor, err := h.editor(c)
	if err != nil {
		return errosAcesso.responder(c, err)
	}
	perfil, err := h.servico.AtualizarPerfil(c.Request().Context(), editor, c.Param("codigo"), req.dados(), autorDaRequisicao(c))
	if err != nil {
		return errosAcesso.responder(c, err)
	}
	return httpx.OK(c, perfil)
}

// ExcluirPerfil remove um perfil personalizado sem usuarios.
func (h *AcessoHandler) ExcluirPerfil(c echo.Context) error {
	if err := h.servico.ExcluirPerfil(c.Request().Context(), c.Param("codigo")); err != nil {
		return errosAcesso.responder(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}
