package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func echoCom(mw echo.MiddlewareFunc) *echo.Echo {
	e := echo.New()
	e.GET("/x", func(c echo.Context) error { return c.NoContent(http.StatusOK) }, mw)
	return e
}

func chamar(e *echo.Echo, ip, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.RemoteAddr = ip + ":1234"
	if token != "" {
		req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// echoDeLogin simula o handler de login: ?ok=1 e senha certa (200), senao 401.
func echoDeLogin(mw echo.MiddlewareFunc) *echo.Echo {
	e := echo.New()
	e.GET("/x", func(c echo.Context) error {
		if c.QueryParam("ok") == "1" {
			return c.NoContent(http.StatusOK)
		}
		return c.NoContent(http.StatusUnauthorized)
	}, mw)
	return e
}

func tentarLogin(e *echo.Echo, ip string, certo bool) *httptest.ResponseRecorder {
	alvo := "/x"
	if certo {
		alvo += "?ok=1"
	}
	req := httptest.NewRequest(http.MethodGet, alvo, nil)
	req.RemoteAddr = ip + ":1234"
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestLimiteDeLoginBloqueiaDepoisDasFalhasComRetryAfter(t *testing.T) {
	e := echoDeLogin(middleware.LimiteDeLogin(5))

	for i := 0; i < 5; i++ {
		require.Equal(t, http.StatusUnauthorized, tentarLogin(e, "203.0.113.7", false).Code, "tentativa %d", i+1)
	}
	rec := tentarLogin(e, "203.0.113.7", true)

	assert.Equal(t, http.StatusTooManyRequests, rec.Code, "esgotado, nem a senha certa passa")
	assert.Equal(t, "12", rec.Header().Get("Retry-After"), "5/min = uma ficha a cada 12s")
	assert.Contains(t, rec.Body.String(), "LIMITE_EXCEDIDO")
	assert.Contains(t, rec.Body.String(), "tentativas de login")
}

func TestLimiteDeLoginNaoContaLoginsBemSucedidos(t *testing.T) {
	e := echoDeLogin(middleware.LimiteDeLogin(2))

	// Troca de turno: 30 operadores entrando certo pelo mesmo IP (NAT).
	for i := 0; i < 30; i++ {
		require.Equal(t, http.StatusOK, tentarLogin(e, "10.0.0.1", true).Code, "login %d", i+1)
	}
}

func TestLimiteDeLoginEPorIP(t *testing.T) {
	e := echoDeLogin(middleware.LimiteDeLogin(1))

	require.Equal(t, http.StatusUnauthorized, tentarLogin(e, "203.0.113.7", false).Code)
	require.Equal(t, http.StatusTooManyRequests, tentarLogin(e, "203.0.113.7", false).Code)

	assert.Equal(t, http.StatusUnauthorized, tentarLogin(e, "203.0.113.8", false).Code, "outro IP tem o proprio balde")
}

func TestLimiteDeRequisicoesSeparaUsuariosAtrasDoMesmoIP(t *testing.T) {
	tokens := auth.NovoServicoToken("segredo_de_teste_com_mais_de_32_caracteres", time.Hour)
	tokenA, _, err := tokens.Gerar(&usuario.Usuario{ID: 1, Username: "ana", Perfil: usuario.PerfilOperador})
	require.NoError(t, err)
	tokenB, _, err := tokens.Gerar(&usuario.Usuario{ID: 2, Username: "bia", Perfil: usuario.PerfilOperador})
	require.NoError(t, err)
	e := echoCom(middleware.LimiteDeRequisicoes(1, 1, tokens))

	require.Equal(t, http.StatusOK, chamar(e, "10.0.0.5", tokenA).Code)
	require.Equal(t, http.StatusTooManyRequests, chamar(e, "10.0.0.5", tokenA).Code)

	assert.Equal(t, http.StatusOK, chamar(e, "10.0.0.5", tokenB).Code, "mesmo NAT, outro usuario")
}

func TestLimiteDeRequisicoesTokenInvalidoCaiNoBaldeDoIP(t *testing.T) {
	tokens := auth.NovoServicoToken("segredo_de_teste_com_mais_de_32_caracteres", time.Hour)
	e := echoCom(middleware.LimiteDeRequisicoes(1, 1, tokens))

	require.Equal(t, http.StatusOK, chamar(e, "203.0.113.9", "lixo-1").Code)

	assert.Equal(t, http.StatusTooManyRequests, chamar(e, "203.0.113.9", "lixo-2").Code,
		"trocar o token invalido a cada chamada nao pode escapar do limite")
}

func TestLimiteZeroDesliga(t *testing.T) {
	login := echoDeLogin(middleware.LimiteDeLogin(0))
	global := echoCom(middleware.LimiteDeRequisicoes(0, 0, nil))

	for i := 0; i < 50; i++ {
		require.Equal(t, http.StatusUnauthorized, tentarLogin(login, "203.0.113.7", false).Code)
		require.Equal(t, http.StatusOK, chamar(global, "203.0.113.7", "").Code)
	}
}

// Tentativas simultaneas (o handler real demora o bcrypt) nao podem passar
// todas pela mesma ficha: so passam as que cabem no limite.
func TestLimiteDeLoginNaoDeixaTentativasSimultaneasPassarem(t *testing.T) {
	e := echo.New()
	e.GET("/x", func(c echo.Context) error {
		time.Sleep(50 * time.Millisecond)
		return c.NoContent(http.StatusUnauthorized)
	}, middleware.LimiteDeLogin(5))
	var passaram atomic.Int32
	var grupo sync.WaitGroup
	for range 40 {
		grupo.Add(1)
		go func() {
			defer grupo.Done()
			if tentarLogin(e, "10.9.9.9", false).Code == http.StatusUnauthorized {
				passaram.Add(1)
			}
		}()
	}
	grupo.Wait()
	assert.Equal(t, int32(5), passaram.Load(), "so as 5 fichas do minuto chegam ao handler")
}
