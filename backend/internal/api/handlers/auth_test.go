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
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const segredoTeste = "chave_de_teste_com_mais_de_32_caracteres_ok"

// apiDeTeste monta a rota de login sobre o servico e o banco reais.
func apiDeTeste(t *testing.T) (*echo.Echo, *auth.ServicoToken) {
	t.Helper()
	e, tokens, _ := apiDeTesteComBanco(t)
	return e, tokens
}

func apiDeTesteComBanco(t *testing.T) (*echo.Echo, *auth.ServicoToken, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	tokens := auth.NovoServicoToken(segredoTeste, time.Hour)
	servico := auth.NovoServicoAutenticacao(repository.NovoUsuarioRepositorio(pool), tokens)
	handler := handlers.NovoAuthHandler(servico, acesso.NovoServico(repository.NovoAcessoRepositorio(pool)))

	e := echo.New()
	e.POST("/api/v1/auth/login", handler.Login)
	e.GET("/api/v1/auth/eu", handler.Eu, middleware.Autenticacao(tokens))
	e.POST("/api/v1/auth/trocar-senha", handler.TrocarSenha, middleware.Autenticacao(tokens))
	e.PUT("/api/v1/auth/preferencias", handler.AtualizarPreferencias, middleware.Autenticacao(tokens))
	return e, tokens, pool
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

func TestLoginDevolveAsPermissoesDoPerfil(t *testing.T) {
	e, _ := apiDeTeste(t)

	body := json_(t, postLogin(t, e, `{"username":"admin","password":"Admin@123"}`))

	permissoes := body["permissoes"].([]any)
	assert.Len(t, permissoes, len(acesso.Catalogo), "ADMIN recebe o catalogo inteiro")
	assert.Contains(t, permissoes, acesso.ConfigPerfis)
	assert.Equal(t, "Administrador", body["perfil_nome"])
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
	assert.Len(t, body["dados"].(map[string]any)["permissoes"], len(acesso.Catalogo))
}

func TestSessaoAbertaDeUsuarioBloqueadoCaiNoEuENaTrocaDeSenha(t *testing.T) {
	e, _, pool := apiDeTesteComBanco(t)
	token := json_(t, postLogin(t, e, `{"username":"admin","password":"Admin@123"}`))["access_token"].(string)
	_, err := pool.Exec(t.Context(), `UPDATE usuarios SET situacao = 'BLOQUEADO' WHERE username = 'admin'`)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/eu", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code, "o frontend leva ao login")

	rec = postTrocaDeSenha(t, e, token, `{"senha_atual":"Admin@123","nova_senha":"OutraSenha#1"}`)
	assert.Equal(t, http.StatusUnauthorized, rec.Code, "bloqueado nao troca a senha com a sessao antiga")
}

func TestEuExigeAutenticacao(t *testing.T) {
	e, _ := apiDeTeste(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/eu", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// postTrocaDeSenha dispara a troca autenticada com o token informado.
func postTrocaDeSenha(t *testing.T, e *echo.Echo, token, corpo string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/trocar-senha", strings.NewReader(corpo))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	if token != "" {
		req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func tokenDoAdmin(t *testing.T, e *echo.Echo) string {
	t.Helper()
	return json_(t, postLogin(t, e, `{"username":"admin","password":"Admin@123"}`))["access_token"].(string)
}

func TestTrocarSenhaPermiteEntrarComANovaSenha(t *testing.T) {
	e, _ := apiDeTeste(t)
	token := tokenDoAdmin(t, e)

	rec := postTrocaDeSenha(t, e, token, `{"senha_atual":"Admin@123","nova_senha":"NovaSenha@2026"}`)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, true, json_(t, rec)["sucesso"])

	novoLogin := postLogin(t, e, `{"username":"admin","password":"NovaSenha@2026"}`)
	assert.Equal(t, http.StatusOK, novoLogin.Code)
}

func TestTrocarSenhaComSenhaAtualErradaResponde401(t *testing.T) {
	e, _ := apiDeTeste(t)
	token := tokenDoAdmin(t, e)

	rec := postTrocaDeSenha(t, e, token, `{"senha_atual":"errada","nova_senha":"NovaSenha@2026"}`)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Equal(t, "NAO_AUTORIZADO", json_(t, rec)["erro"].(map[string]any)["codigo"])
}

func TestTrocarSenhaCurtaResponde400(t *testing.T) {
	e, _ := apiDeTeste(t)
	token := tokenDoAdmin(t, e)

	rec := postTrocaDeSenha(t, e, token, `{"senha_atual":"Admin@123","nova_senha":"curta1"}`)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, "ERRO_VALIDACAO", json_(t, rec)["erro"].(map[string]any)["codigo"])
}

func TestTrocarSenhaRepetindoAAtualResponde400(t *testing.T) {
	e, _ := apiDeTeste(t)
	token := tokenDoAdmin(t, e)

	rec := postTrocaDeSenha(t, e, token, `{"senha_atual":"Admin@123","nova_senha":"Admin@123"}`)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, json_(t, rec)["erro"].(map[string]any)["mensagem"], "diferente")
}

func TestTrocarSenhaExigeAutenticacao(t *testing.T) {
	e, _ := apiDeTeste(t)

	rec := postTrocaDeSenha(t, e, "", `{"senha_atual":"Admin@123","nova_senha":"NovaSenha@2026"}`)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// putPreferencias dispara a atualizacao autenticada com o token informado.
func putPreferencias(t *testing.T, e *echo.Echo, token, corpo string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPut, "/api/v1/auth/preferencias", strings.NewReader(corpo))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	if token != "" {
		req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestAtualizarPreferenciasResponde200ERefleteNoEu(t *testing.T) {
	e, _ := apiDeTeste(t)
	token := tokenDoAdmin(t, e)

	rec := putPreferencias(t, e, token, `{"tema":"escuro","alto_contraste":true,"densidade":"compacta","tamanho_fonte":"grande"}`)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	dados := json_(t, rec)["dados"].(map[string]any)
	assert.Equal(t, "escuro", dados["tema"])
	assert.Equal(t, true, dados["alto_contraste"])

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/eu", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	recEu := httptest.NewRecorder()
	e.ServeHTTP(recEu, req)
	euDados := json_(t, recEu)["dados"].(map[string]any)
	assert.Equal(t, "escuro", euDados["tema"], "Eu deve refletir a preferencia sem exigir novo login")
}

func TestAtualizarPreferenciasComTemaInvalidoResponde400(t *testing.T) {
	e, _ := apiDeTeste(t)
	token := tokenDoAdmin(t, e)

	rec := putPreferencias(t, e, token, `{"tema":"roxo","densidade":"compacta","tamanho_fonte":"padrao"}`)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, "ERRO_VALIDACAO", json_(t, rec)["erro"].(map[string]any)["codigo"])
}

func TestAtualizarPreferenciasExigeAutenticacao(t *testing.T) {
	e, _ := apiDeTeste(t)

	rec := putPreferencias(t, e, "", `{"tema":"claro","densidade":"compacta","tamanho_fonte":"padrao"}`)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// Cinco senhas erradas seguidas bloqueiam a conta por um tempo, mesmo com a
// senha certa depois; o login certo antes disso zera a contagem.
func TestLoginBloqueiaAContaDepoisDeFalhasSeguidas(t *testing.T) {
	e, _, pool := apiDeTesteComBanco(t)
	errada := `{"username":"admin","password":"errada-123"}`
	for range 4 {
		assert.Equal(t, http.StatusUnauthorized, postLogin(t, e, errada).Code)
	}
	require.Equal(t, http.StatusOK, postLogin(t, e, `{"username":"admin","password":"Admin@123"}`).Code, "4 falhas ainda nao bloqueiam")
	for range 5 {
		postLogin(t, e, errada)
	}
	rec := postLogin(t, e, `{"username":"admin","password":"Admin@123"}`)
	assert.Equal(t, http.StatusTooManyRequests, rec.Code, "bloqueada mesmo com a senha certa")
	var ate time.Time
	require.NoError(t, pool.QueryRow(t.Context(), `SELECT bloqueado_ate FROM usuarios WHERE username = 'admin'`).Scan(&ate))
	assert.WithinDuration(t, time.Now().Add(15*time.Minute), ate, 2*time.Minute)
}

// Trocar a senha derruba os tokens emitidos antes (um roubado, inclusive) e
// devolve um novo para a sessao de quem trocou.
func TestTrocarSenhaRevogaTokensAnteriores(t *testing.T) {
	_, _, pool := apiDeTesteComBanco(t)
	tokens := auth.NovoServicoToken(segredoTeste, time.Hour)
	acessos := acesso.NovoServico(repository.NovoAcessoRepositorio(pool))
	handler := handlers.NovoAuthHandler(auth.NovoServicoAutenticacao(repository.NovoUsuarioRepositorio(pool), tokens), acessos)
	e := echo.New()
	e.Use(middleware.Autorizacao(acessos))
	e.POST("/api/v1/auth/login", handler.Login)
	e.GET("/api/v1/auth/eu", handler.Eu, middleware.Autenticacao(tokens))
	e.POST("/api/v1/auth/trocar-senha", handler.TrocarSenha, middleware.Autenticacao(tokens))

	velho := json_(t, postLogin(t, e, `{"username":"admin","password":"Admin@123"}`))["access_token"].(string)
	chamar := func(metodo, rota, token, corpo string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(metodo, rota, strings.NewReader(corpo))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec
	}
	assert.Equal(t, http.StatusBadRequest, chamar(http.MethodPost, "/api/v1/auth/trocar-senha", velho,
		`{"senha_atual":"Admin@123","nova_senha":"1234567890"}`).Code, "senha comum recusada")
	rec := chamar(http.MethodPost, "/api/v1/auth/trocar-senha", velho, `{"senha_atual":"Admin@123","nova_senha":"Radar#Fabrica2026"}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	novo := json_(t, rec)["dados"].(map[string]any)["access_token"].(string)

	rec = chamar(http.MethodGet, "/api/v1/auth/eu", velho, "")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), middleware.CodigoSessaoEncerrada)
	assert.Equal(t, http.StatusOK, chamar(http.MethodGet, "/api/v1/auth/eu", novo, "").Code)
}
