package middleware

import (
	"log/slog"
	"time"

	"github.com/labstack/echo/v4"
)

// Log registra uma linha estruturada por requisicao (RNF6).
// Erros 5xx sobem para nivel ERROR; 4xx para WARN.
func Log() echo.MiddlewareFunc {
	return func(proximo echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			inicio := time.Now()
			err := proximo(c)
			if err != nil {
				c.Error(err)
			}

			req, res := c.Request(), c.Response()
			atributos := []any{
				"metodo", req.Method,
				"rota", req.URL.Path,
				"status", res.Status,
				"duracao_ms", time.Since(inicio).Milliseconds(),
				"ip", c.RealIP(),
			}
			if claims := ClaimsDoContexto(c); claims != nil {
				atributos = append(atributos, "usuario", claims.Username)
			}

			switch {
			case res.Status >= 500:
				slog.Error("requisicao", atributos...)
			case res.Status >= 400:
				slog.Warn("requisicao", atributos...)
			default:
				slog.Info("requisicao", atributos...)
			}
			return nil
		}
	}
}
