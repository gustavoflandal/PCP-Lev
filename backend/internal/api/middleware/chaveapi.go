package middleware

import (
	"context"
	"errors"
	"log/slog"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/integracao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

// CabecalhoChaveAPI e o cabecalho com que o ERP envia a chave de integracao.
const CabecalhoChaveAPI = "X-API-Key"

// chaveAPIDoContexto identifica a chave autenticada no contexto da requisicao.
const chaveAPIDoContexto = "pcp_chave_api"

// AutenticadorDeChave confere o segredo de uma chave de API; implementado por
// integracao.Servico.
type AutenticadorDeChave interface {
	Autenticar(ctx context.Context, segredo string) (*integracao.ChaveAPI, error)
}

// AutenticacaoPorChave exige uma chave de API valida (cabecalho X-API-Key) na
// API publica de integracao. Chave ausente, desconhecida ou revogada responde
// 401 com a mesma mensagem, para nao ajudar quem tenta adivinhar chaves.
func AutenticacaoPorChave(autenticador AutenticadorDeChave) echo.MiddlewareFunc {
	return func(proximo echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			segredo := c.Request().Header.Get(CabecalhoChaveAPI)
			if segredo == "" {
				return httpx.NaoAutorizado(c, "Chave de API ausente: envie o cabecalho "+CabecalhoChaveAPI)
			}
			chave, err := autenticador.Autenticar(c.Request().Context(), segredo)
			if errors.Is(err, integracao.ErrChaveInvalida) {
				return httpx.NaoAutorizado(c, "Chave de API invalida ou revogada")
			}
			if err != nil {
				slog.Error("falha ao conferir a chave de api", "erro", err)
				return httpx.ErroInterno(c)
			}
			c.Set(chaveAPIDoContexto, chave)
			return proximo(c)
		}
	}
}

// ChaveAPIDoContexto devolve a chave autenticada da requisicao, ou nil.
func ChaveAPIDoContexto(c echo.Context) *integracao.ChaveAPI {
	chave, _ := c.Get(chaveAPIDoContexto).(*integracao.ChaveAPI)
	return chave
}
