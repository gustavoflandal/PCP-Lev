package middleware_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/integracao"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type autenticadorFalso struct {
	validas map[string]int64
	erro    error
}

func (a autenticadorFalso) Autenticar(_ context.Context, segredo string) (*integracao.ChaveAPI, error) {
	if a.erro != nil {
		return nil, a.erro
	}
	id, ok := a.validas[segredo]
	if !ok {
		return nil, integracao.ErrChaveInvalida
	}
	return &integracao.ChaveAPI{ID: id, Nome: "ERP", Ativo: true}, nil
}

func rotaProtegidaPorChave(a autenticadorFalso) *echo.Echo {
	e := echo.New()
	e.GET("/api/integracao/v1/teste", func(c echo.Context) error {
		chave := middleware.ChaveAPIDoContexto(c)
		return c.String(http.StatusOK, chave.Nome)
	}, middleware.AutenticacaoPorChave(a))
	return e
}

func chamarComChave(e *echo.Echo, chave string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/api/integracao/v1/teste", nil)
	if chave != "" {
		req.Header.Set(middleware.CabecalhoChaveAPI, chave)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestAutenticacaoPorChaveLiberaChaveValida(t *testing.T) {
	e := rotaProtegidaPorChave(autenticadorFalso{validas: map[string]int64{"pcp_valida": 1}})

	rec := chamarComChave(e, "pcp_valida")

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "ERP", rec.Body.String())
}

func TestAutenticacaoPorChaveRecusaAusenteInvalidaERevogada(t *testing.T) {
	e := rotaProtegidaPorChave(autenticadorFalso{validas: map[string]int64{"pcp_valida": 1}})

	assert.Equal(t, http.StatusUnauthorized, chamarComChave(e, "").Code, "sem cabecalho")
	assert.Equal(t, http.StatusUnauthorized, chamarComChave(e, "pcp_outra").Code, "desconhecida ou revogada")
}

func TestAutenticacaoPorChaveNaoAceitaJWTNoLugarDaChave(t *testing.T) {
	e := rotaProtegidaPorChave(autenticadorFalso{validas: map[string]int64{"pcp_valida": 1}})
	req := httptest.NewRequest(http.MethodGet, "/api/integracao/v1/teste", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer eyJ.fake.token")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAutenticacaoPorChaveFalhaInternaVira500(t *testing.T) {
	e := rotaProtegidaPorChave(autenticadorFalso{erro: assert.AnError})

	assert.Equal(t, http.StatusInternalServerError, chamarComChave(e, "pcp_valida").Code)
}
