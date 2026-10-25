package handlers

import (
	"net/http"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/labstack/echo/v4"
)

var errosUsuario = mapaDeErros{
	{usuario.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{usuario.ErrIndividualInexistente, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{usuario.ErrDuplicado, http.StatusConflict, httpx.CodigoConflito},
	{usuario.ErrUltimoAdmin, http.StatusConflict, httpx.CodigoConflito},
	{usuario.ErrAlteradoPorOutro, http.StatusConflict, httpx.CodigoConflito},
	{usuario.ErrAdminSemIndividuais, http.StatusConflict, httpx.CodigoConflito},
	{usuario.ErrUsernameInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{usuario.ErrNomeObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{usuario.ErrEmailInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{usuario.ErrCampoLongo, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{usuario.ErrPerfilObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{usuario.ErrPerfilInexistente, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{usuario.ErrSituacaoInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{usuario.ErrJustificativaCurta, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{usuario.ErrPermissaoForaCatalogo, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{usuario.ErrSenhaFraca, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{usuario.ErrAlterarASiMesmo, http.StatusForbidden, httpx.CodigoAcessoNegado},
	{usuario.ErrAtribuirPerfilSemTer, http.StatusForbidden, httpx.CodigoAcessoNegado},
	{usuario.ErrSoAdminAlteraAdmin, http.StatusForbidden, httpx.CodigoAcessoNegado},
	{usuario.ErrConcederSemTer, http.StatusForbidden, httpx.CodigoAcessoNegado},
	{usuario.ErrAlvoComMaisPermissoes, http.StatusForbidden, httpx.CodigoAcessoNegado},
}

// UsuarioHandler atende /usuarios -- gestao de usuarios e permissoes
// individuais (doc 0, secao 4.7.3; Fase 2.2b).
type UsuarioHandler struct {
	servico *usuario.ServicoGestao
	acessos *acesso.Servico
}

// NovoUsuarioHandler cria o handler de usuarios.
func NovoUsuarioHandler(servico *usuario.ServicoGestao, acessos *acesso.Servico) *UsuarioHandler {
	return &UsuarioHandler{servico: servico, acessos: acessos}
}

// Registrar publica as rotas, todas com a permissao configuracoes.usuarios.
func (h *UsuarioHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/usuarios", autenticacao, middleware.ExigirPermissao(acesso.ConfigUsuarios))
	rotas.GET("", h.Listar)
	rotas.GET("/opcoes", h.Opcoes)
	rotas.GET("/:id", h.Obter)
	rotas.POST("", h.Criar)
	rotas.PUT("/:id", h.Atualizar)
	rotas.POST("/:id/situacao", h.AlterarSituacao)
	rotas.POST("/:id/redefinir-senha", h.RedefinirSenha)
	rotas.GET("/:id/permissoes", h.Permissoes)
	rotas.PUT("/:id/permissoes/:codigo", h.DefinirPermissao)
	rotas.DELETE("/:id/permissoes/:codigo", h.RemoverPermissao)
}

type usuarioRequest struct {
	Username        string     `json:"username"`
	Nome            string     `json:"nome"`
	Email           string     `json:"email"`
	Matricula       *string    `json:"matricula"`
	Telefone        string     `json:"telefone"`
	Setor           string     `json:"setor"`
	Perfil          string     `json:"perfil"`
	DataAdmissao    tempo.Data `json:"data_admissao"`
	SenhaTemporaria string     `json:"senha_temporaria"`
}

func (r usuarioRequest) dados() usuario.Dados {
	return usuario.Dados{
		Username: r.Username, Nome: r.Nome, Email: r.Email, Matricula: r.Matricula,
		Telefone: r.Telefone, Setor: r.Setor, Perfil: usuario.Perfil(r.Perfil), DataAdmissao: r.DataAdmissao,
	}
}

// Listar devolve a pagina de usuarios (filtros: busca, perfil, status = situacao).
func (h *UsuarioHandler) Listar(c echo.Context) error {
	params, err := consulta.AnalisarComStatus(c.QueryParams(), usuario.ColunasOrdenaveis, "nome", usuario.SituacoesValidas)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}
	itens, total, err := h.servico.Listar(c.Request().Context(), params, strings.TrimSpace(c.QueryParam("perfil")))
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// Opcoes devolve os perfis (com as permissoes) e o catalogo -- a tela de
// usuarios precisa deles, e quem tem so configuracoes.usuarios nao le
// /acesso/* (que exige configuracoes.perfis).
func (h *UsuarioHandler) Opcoes(c echo.Context) error {
	perfis, err := h.acessos.ListarPerfis(c.Request().Context())
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	catalogo, err := h.acessos.Catalogo(c.Request().Context())
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	return httpx.OK(c, map[string]any{"perfis": perfis, "permissoes": catalogo})
}

// Obter devolve um usuario.
func (h *UsuarioHandler) Obter(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do usuario deve ser numerico")
	}
	u, err := h.servico.BuscarPorID(c.Request().Context(), id)
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	return httpx.OK(c, u)
}

// Criar cadastra um usuario com senha temporaria.
func (h *UsuarioHandler) Criar(c echo.Context) error {
	var req usuarioRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	editor, err := middleware.AcessoDaRequisicao(c)
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	u, err := h.servico.Criar(c.Request().Context(), editor, req.dados(), req.SenhaTemporaria, autorDaRequisicao(c))
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	return httpx.Criado(c, u)
}

// Atualizar altera o cadastro (o login nao muda).
func (h *UsuarioHandler) Atualizar(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do usuario deve ser numerico")
	}
	var req usuarioRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	editor, err := middleware.AcessoDaRequisicao(c)
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	u, err := h.servico.Atualizar(c.Request().Context(), editor, id, req.dados(), autorDaRequisicao(c))
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	return httpx.OK(c, u)
}

type situacaoRequest struct {
	Situacao         string     `json:"situacao"`
	DataDesligamento tempo.Data `json:"data_desligamento"`
}

// AlterarSituacao ativa, inativa ou bloqueia.
func (h *UsuarioHandler) AlterarSituacao(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do usuario deve ser numerico")
	}
	var req situacaoRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	editor, err := middleware.AcessoDaRequisicao(c)
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	u, err := h.servico.AlterarSituacao(c.Request().Context(), editor, id, usuario.Situacao(req.Situacao), req.DataDesligamento, autorDaRequisicao(c))
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	return httpx.OK(c, u)
}

type senhaTemporariaRequest struct {
	SenhaTemporaria string `json:"senha_temporaria"`
}

// RedefinirSenha define uma senha temporaria.
func (h *UsuarioHandler) RedefinirSenha(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do usuario deve ser numerico")
	}
	var req senhaTemporariaRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	editor, err := middleware.AcessoDaRequisicao(c)
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	if err := h.servico.RedefinirSenha(c.Request().Context(), editor, id, req.SenhaTemporaria, autorDaRequisicao(c)); err != nil {
		return errosUsuario.responder(c, err)
	}
	return httpx.OKComMensagem(c, nil, "Senha temporaria definida; o usuario a troca no proximo acesso")
}

// Permissoes devolve as permissoes individuais e as efetivas (configuradas:
// o que vale com o usuario ativo e a senha em dia) do usuario.
func (h *UsuarioHandler) Permissoes(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do usuario deve ser numerico")
	}
	if _, err := h.servico.BuscarPorID(c.Request().Context(), id); err != nil {
		return errosUsuario.responder(c, err)
	}
	individuais, efetivas, err := h.servico.PermissoesDoUsuario(c.Request().Context(), id)
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	return httpx.OK(c, map[string]any{"individuais": individuais, "efetivas": efetivas})
}

type permissaoIndividualRequest struct {
	Concedida     *bool  `json:"concedida"`
	Justificativa string `json:"justificativa"`
}

// DefinirPermissao concede ou retira uma permissao individual.
func (h *UsuarioHandler) DefinirPermissao(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do usuario deve ser numerico")
	}
	var req permissaoIndividualRequest
	if err := c.Bind(&req); err != nil || req.Concedida == nil {
		return erroRequisicaoInvalida(c, "Informe concedida (true/false) e a justificativa")
	}
	editor, err := middleware.AcessoDaRequisicao(c)
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	if err := h.servico.DefinirPermissao(c.Request().Context(), editor, id, c.Param("codigo"), *req.Concedida, req.Justificativa, autorDaRequisicao(c)); err != nil {
		return errosUsuario.responder(c, err)
	}
	return h.Permissoes(c)
}

// RemoverPermissao desfaz uma permissao individual.
func (h *UsuarioHandler) RemoverPermissao(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador do usuario deve ser numerico")
	}
	editor, err := middleware.AcessoDaRequisicao(c)
	if err != nil {
		return errosUsuario.responder(c, err)
	}
	if err := h.servico.RemoverPermissao(c.Request().Context(), editor, id, c.Param("codigo")); err != nil {
		return errosUsuario.responder(c, err)
	}
	return h.Permissoes(c)
}
