// Package handlers expoe os casos de uso como endpoints HTTP.
package handlers

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

// AuthHandler atende os endpoints de autenticacao.
type AuthHandler struct {
	servico *auth.ServicoAutenticacao
}

// NovoAuthHandler cria o handler de autenticacao.
func NovoAuthHandler(servico *auth.ServicoAutenticacao) *AuthHandler {
	return &AuthHandler{servico: servico}
}

// LoginRequest e o corpo de POST /auth/login.
type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

// Login autentica o usuario e devolve o token da sessao.
//
// A resposta segue literalmente o contrato do doc 3: os campos vao na raiz,
// sem o envelope `sucesso/dados` usado nos demais endpoints.
func (h *AuthHandler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoRequisicaoInvalida,
			"Corpo da requisicao invalido")
	}
	if problemas := httpx.Validar(req); problemas != nil {
		return httpx.ErroValidacao(c, problemas)
	}

	resultado, err := h.servico.Autenticar(c.Request().Context(), req.Username, req.Password)
	if err != nil {
		switch {
		case errors.Is(err, usuario.ErrCredenciaisInvalidas):
			return httpx.NaoAutorizado(c, "Usuario ou senha invalidos")
		case errors.Is(err, usuario.ErrUsuarioInativo):
			return httpx.NaoAutorizado(c, "Usuario inativo, procure o administrador")
		default:
			slog.Error("falha ao autenticar", "username", req.Username, "erro", err)
			return httpx.ErroInterno(c)
		}
	}

	return c.JSON(http.StatusOK, resultado)
}

// TrocarSenhaRequest e o corpo de POST /auth/trocar-senha.
type TrocarSenhaRequest struct {
	SenhaAtual string `json:"senha_atual" validate:"required"`
	NovaSenha  string `json:"nova_senha" validate:"required,min=8"`
}

// TrocarSenha altera a senha do usuario da sessao corrente.
func (h *AuthHandler) TrocarSenha(c echo.Context) error {
	claims := middleware.ClaimsDoContexto(c)
	if claims == nil {
		return httpx.NaoAutorizado(c, "Token de acesso ausente")
	}

	var req TrocarSenhaRequest
	if err := c.Bind(&req); err != nil {
		return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoRequisicaoInvalida,
			"Corpo da requisicao invalido")
	}
	if problemas := httpx.Validar(req); problemas != nil {
		return httpx.ErroValidacao(c, problemas)
	}

	err := h.servico.TrocarSenha(c.Request().Context(), claims.UsuarioID, req.SenhaAtual, req.NovaSenha)
	switch {
	case err == nil:
		return httpx.OKComMensagem(c, nil, "Senha alterada")
	case errors.Is(err, usuario.ErrCredenciaisInvalidas):
		// Sem detalhar: quem tem o token mas nao a senha nao deve descobrir
		// se errou a senha atual ou esbarrou em outra regra.
		return httpx.NaoAutorizado(c, "Senha atual invalida")
	case errors.Is(err, auth.ErrSenhaRepetida):
		return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoErroValidacao, err.Error())
	case errors.Is(err, usuario.ErrSenhaFraca):
		return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoErroValidacao, err.Error())
	case errors.Is(err, usuario.ErrNaoEncontrado):
		return httpx.NaoEncontrado(c, "Usuario nao encontrado")
	default:
		slog.Error("falha ao trocar a senha", "usuario_id", claims.UsuarioID, "erro", err)
		return httpx.ErroInterno(c)
	}
}

// Eu devolve os dados do usuario da sessao corrente. Consulta o banco (nao
// so ecoa as claims do JWT) para refletir mudancas -- como preferencias de
// aparencia -- sem exigir um novo login.
func (h *AuthHandler) Eu(c echo.Context) error {
	claims := middleware.ClaimsDoContexto(c)
	if claims == nil {
		return httpx.NaoAutorizado(c, "Token de acesso ausente")
	}

	u, err := h.servico.BuscarUsuarioAtual(c.Request().Context(), claims.UsuarioID)
	switch {
	case err == nil:
		return httpx.OK(c, u)
	case errors.Is(err, usuario.ErrNaoEncontrado):
		return httpx.NaoAutorizado(c, "Usuario nao encontrado")
	default:
		// Uma falha transitoria de banco nao pode deslogar o usuario -- o
		// interceptador do frontend trata todo 401 fora de /auth/login como
		// sessao expirada (api.ts). 500 aqui e o mesmo tratamento que
		// TrocarSenha ja da para erros nao mapeados.
		slog.Error("falha ao buscar usuario atual", "usuario_id", claims.UsuarioID, "erro", err)
		return httpx.ErroInterno(c)
	}
}

// preferenciasRequest e o corpo de PUT /auth/preferencias. Sem tags
// `validate:"required"` -- usuario.Preferencias.Validar() ja rejeita string
// vazia (fora do conjunto fechado por campo); duplicar a checagem aqui so
// fazia a mesma falha chegar ao cliente em dois formatos diferentes
// (com/sem `detalhes` por campo).
type preferenciasRequest struct {
	Tema          string `json:"tema"`
	AltoContraste bool   `json:"alto_contraste"`
	Densidade     string `json:"densidade"`
	TamanhoFonte  string `json:"tamanho_fonte"`
}

// AtualizarPreferencias grava as preferencias de aparencia do usuario da
// sessao corrente.
func (h *AuthHandler) AtualizarPreferencias(c echo.Context) error {
	claims := middleware.ClaimsDoContexto(c)
	if claims == nil {
		return httpx.NaoAutorizado(c, "Token de acesso ausente")
	}

	var req preferenciasRequest
	if err := c.Bind(&req); err != nil {
		return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoRequisicaoInvalida, "Corpo da requisicao invalido")
	}
	if problemas := httpx.Validar(req); problemas != nil {
		return httpx.ErroValidacao(c, problemas)
	}

	atualizado, err := h.servico.AtualizarPreferencias(c.Request().Context(), claims.UsuarioID, usuario.Preferencias{
		Tema: req.Tema, AltoContraste: req.AltoContraste, Densidade: req.Densidade, TamanhoFonte: req.TamanhoFonte,
	})
	if err != nil {
		switch {
		case errors.Is(err, usuario.ErrPreferenciaInvalida):
			return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoErroValidacao, err.Error())
		case errors.Is(err, usuario.ErrNaoEncontrado):
			return httpx.NaoEncontrado(c, "Usuario nao encontrado")
		default:
			slog.Error("falha ao atualizar preferencias", "usuario_id", claims.UsuarioID, "erro", err)
			return httpx.ErroInterno(c)
		}
	}
	return httpx.OK(c, atualizado)
}
