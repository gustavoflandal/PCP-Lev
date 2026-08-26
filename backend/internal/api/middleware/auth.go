// Package middleware reune os interceptadores HTTP da API.
package middleware

import (
	"errors"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
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
			return proximo(c)
		}
	}
}

// ExigirPerfil restringe a rota aos perfis informados (RNF3).
func ExigirPerfil(perfis ...usuario.Perfil) echo.MiddlewareFunc {
	permitidos := make(map[usuario.Perfil]bool, len(perfis))
	for _, p := range perfis {
		permitidos[p] = true
	}

	return func(proximo echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims := ClaimsDoContexto(c)
			if claims == nil {
				return httpx.NaoAutorizado(c, "Token de acesso ausente")
			}
			if !permitidos[claims.Perfil] {
				return httpx.AcessoNegado(c, "Seu perfil nao tem permissao para esta operacao")
			}
			return proximo(c)
		}
	}
}

// ClaimsDoContexto devolve as claims da requisicao autenticada, ou nil.
func ClaimsDoContexto(c echo.Context) *auth.Claims {
	claims, ok := c.Get(chaveClaims).(*auth.Claims)
	if !ok {
		return nil
	}
	return claims
}
