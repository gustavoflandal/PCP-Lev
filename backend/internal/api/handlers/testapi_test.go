package handlers_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
)

// apiProtegida monta um Echo com o middleware de autenticacao real e devolve
// um cliente que ja envia o token do perfil informado.
type apiProtegida struct {
	echo   *echo.Echo
	tokens *auth.ServicoToken
	pool   *pgxpool.Pool
	t      *testing.T
}

func novaAPIProtegida(t *testing.T, pool *pgxpool.Pool) *apiProtegida {
	t.Helper()
	e := echo.New()
	return &apiProtegida{echo: e, tokens: auth.NovoServicoToken(segredoTeste, time.Hour), pool: pool, t: t}
}

func (a *apiProtegida) tokenDe(perfil usuario.Perfil) string {
	a.t.Helper()
	token, _, err := a.tokens.Gerar(&usuario.Usuario{
		ID: 1, Username: "gestor01", Nome: "Gustavo Landal", Perfil: perfil, Ativo: true,
	})
	require.NoError(a.t, err)
	return token
}

func (a *apiProtegida) autenticacao() echo.MiddlewareFunc {
	return middleware.Autenticacao(a.tokens)
}

// chamar dispara a requisicao autenticada com o perfil informado.
func (a *apiProtegida) chamar(metodo, rota string, corpo string, perfil usuario.Perfil) *httptest.ResponseRecorder {
	a.t.Helper()

	var leitor io.Reader
	if corpo != "" {
		leitor = strings.NewReader(corpo)
	}
	req := httptest.NewRequest(metodo, rota, leitor)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+a.tokenDe(perfil))

	rec := httptest.NewRecorder()
	a.echo.ServeHTTP(rec, req)
	return rec
}

// semToken dispara a requisicao sem cabecalho de autorizacao.
func (a *apiProtegida) semToken(metodo, rota string) *httptest.ResponseRecorder {
	a.t.Helper()
	req := httptest.NewRequest(metodo, rota, nil)
	rec := httptest.NewRecorder()
	a.echo.ServeHTTP(rec, req)
	return rec
}

func corpoJSON(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &m), "corpo: %s", rec.Body.String())
	return m
}

func dados(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	return corpoJSON(t, rec)["dados"].(map[string]any)
}

func lista(t *testing.T, rec *httptest.ResponseRecorder) []any {
	t.Helper()
	return corpoJSON(t, rec)["dados"].([]any)
}

func codigoErro(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	return corpoJSON(t, rec)["erro"].(map[string]any)["codigo"].(string)
}

func mensagemErro(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	return corpoJSON(t, rec)["erro"].(map[string]any)["mensagem"].(string)
}

var _ = http.MethodGet

// formatarID converte o id vindo do JSON (float64) em texto para a rota.
func formatarID(valor any) string {
	return strconv.FormatInt(int64(valor.(float64)), 10)
}
