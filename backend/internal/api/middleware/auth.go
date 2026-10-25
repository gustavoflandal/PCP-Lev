// Package middleware reune os interceptadores HTTP da API.
package middleware

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

// chaveClaims identifica as claims dentro do contexto da requisicao.
const chaveClaims = "pcp_claims"

const prefixoBearer = "Bearer "

// Autenticacao exige um JWT valido e publica as claims no contexto.
func Autenticacao(tokens *auth.ServicoToken) echo.MiddlewareFunc {
	return func(proximo echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			cabecalho := c.Request().Header.Get(echo.HeaderAuthorization)
			if !strings.HasPrefix(cabecalho, prefixoBearer) {
				return httpx.NaoAutorizado(c, "Token de acesso ausente")
			}

			claims, err := tokens.Validar(strings.TrimSpace(cabecalho[len(prefixoBearer):]))
			if err != nil {
				if errors.Is(err, auth.ErrTokenExpirado) {
					return httpx.NaoAutorizado(c, "Sessao expirada, faca login novamente")
				}
				return httpx.NaoAutorizado(c, "Token de acesso invalido")
			}

			c.Set(chaveClaims, claims)
			if ok, err := conferirSessao(c, claims); !ok {
				return err
			}
			return proximo(c)
		}
	}
}

// CodigoSessaoEncerrada: o token foi emitido antes de a senha mudar (ou de a
// conta ser inativada) -- o frontend leva ao login.
const CodigoSessaoEncerrada = "SESSAO_ENCERRADA"

// conferirSessao recusa, em TODA rota autenticada (nao so nas com
// ExigirPermissao), token de versao de sessao antiga e usuario inativo ou
// bloqueado. Sem Autorizador no contexto (roteadores de teste que nao o
// montam) a checagem fica so com o token. ok=false: a resposta ja foi
// escrita (err e o resultado da escrita).
func conferirSessao(c echo.Context, claims *auth.Claims) (ok bool, err error) {
	autorizador, tem := c.Get(chaveAutorizador).(Autorizador)
	if !tem {
		return true, nil
	}
	a, errAcesso := autorizador.AcessoDoUsuario(c.Request().Context(), claims.UsuarioID)
	switch {
	case errors.Is(errAcesso, acesso.ErrUsuarioNaoEncontrado):
		return false, httpx.NaoAutorizado(c, "Usuario nao encontrado")
	case errAcesso != nil:
		slog.Error("falha ao conferir a sessao", "usuario_id", claims.UsuarioID, "erro", errAcesso)
		return false, httpx.ErroInterno(c)
	// Situacao antes da versao: o bloqueio tambem sobe a versao, e quem foi
	// bloqueado precisa ler o motivo certo.
	case !a.Ativo:
		return false, httpx.Erro(c, http.StatusUnauthorized, CodigoUsuarioInativo, MensagemUsuarioInativo)
	case a.VersaoSessao != claims.VersaoSessao:
		return false, httpx.Erro(c, http.StatusUnauthorized, CodigoSessaoEncerrada,
			"Sua sessao foi encerrada (senha alterada ou acesso revisto pelo administrador). Entre de novo.")
	}
	return true, nil
}

// ClaimsDoContexto devolve as claims da requisicao autenticada, ou nil.
func ClaimsDoContexto(c echo.Context) *auth.Claims {
	claims, ok := c.Get(chaveClaims).(*auth.Claims)
	if !ok {
		return nil
	}
	return claims
}
