package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const segredoTeste = "chave_de_teste_com_mais_de_32_caracteres_ok"

// apiDeTeste monta a rota de login sobre o servico e o banco reais.
func apiDeTeste(t *testing.T) (*echo.Echo, *auth.ServicoToken) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	tokens := auth.NovoServicoToken(segredoTeste, time.Hour)
	servico := auth.NovoServicoAutenticacao(repository.NovoUsuarioRepositorio(pool), tokens)
	handler := handlers.NovoAuthHandler(servico)

	e := echo.New()
	e.POST("/api/v1/auth/login", handler.Login)
	e.GET("/api/v1/auth/eu", handler.Eu, middleware.Autenticacao(tokens))
	return e, tokens
}

func postLogin(t *testing.T, e *echo.Echo, corpo string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(corpo))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func json_(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &m))
	return m
}

func TestLoginComCredenciaisValidasDevolveContratoDoDoc3(t *testing.T) {
	e, _ := apiDeTeste(t)

	rec := postLogin(t, e, `{"username":"admin","password":"Admin@123"}`)

	require.Equal(t, http.StatusOK, rec.Code)
	body := json_(t, rec)
	assert.NotEmpty(t, body["access_token"])
	assert.Equal(t, "Bearer", body["token_type"])
	assert.Equal(t, float64(3600), body["expires_in"])

	u := body["usuario"].(map[string]any)
	assert.Equal(t, "admin", u["username"])
	assert.Equal(t, "ADMIN", u["perfil"])
	assert.NotContains(t, u, "senha_hash", "o hash da senha nunca trafega")
}

func TestLoginComSenhaErradaResponde401(t *testing.T) {
	e, _ := apiDeTeste(t)

	rec := postLogin(t, e, `{"username":"admin","password":"errada_demais"}`)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
	erro := json_(t, rec)["erro"].(map[string]any)
	assert.Equal(t, "NAO_AUTORIZADO", erro["codigo"])
}

func TestLoginSemUsernameResponde400ComDetalhes(t *testing.T) {
	e, _ := apiDeTeste(t)

	rec := postLogin(t, e, `{"username":"","password":"Admin@123"}`)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	erro := json_(t, rec)["erro"].(map[string]any)
	assert.Equal(t, "ERRO_VALIDACAO", erro["codigo"])
	assert.Equal(t, "username", erro["detalhes"].([]any)[0].(map[string]any)["campo"])
}

func TestLoginComJSONQuebradoResponde400(t *testing.T) {
	e, _ := apiDeTeste(t)

	rec := postLogin(t, e, `{isto nao e json`)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, "REQUISICAO_INVALIDA", json_(t, rec)["erro"].(map[string]any)["codigo"])
}

func TestEuDevolveOUsuarioDaSessao(t *testing.T) {
	e, _ := apiDeTeste(t)
	token := json_(t, postLogin(t, e, `{"username":"admin","password":"Admin@123"}`))["access_token"].(string)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/eu", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	body := json_(t, rec)
	assert.Equal(t, true, body["sucesso"])
	assert.Equal(t, "admin", body["dados"].(map[string]any)["username"])
}

func TestEuExigeAutenticacao(t *testing.T) {
	e, _ := apiDeTeste(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/eu", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
