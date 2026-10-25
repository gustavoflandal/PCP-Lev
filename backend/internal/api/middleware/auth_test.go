package middleware_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const segredoTeste = "chave_de_teste_com_mais_de_32_caracteres_ok"

func tokenDe(t *testing.T, perfil usuario.Perfil, duracao time.Duration) string {
	t.Helper()
	token, _, err := auth.NovoServicoToken(segredoTeste, duracao).Gerar(&usuario.Usuario{
		ID: 7, Username: "gestor01", Nome: "Gustavo Landal", Perfil: perfil, Ativo: true,
	})
	require.NoError(t, err)
	return token
}

// executar dispara uma requisicao protegida e devolve o recorder.
func executar(t *testing.T, cabecalho string, protecoes ...echo.MiddlewareFunc) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/protegido", nil)
	if cabecalho != "" {
		req.Header.Set(echo.HeaderAuthorization, cabecalho)
	}
	rec := httptest.NewRecorder()

	cadeia := append([]echo.MiddlewareFunc{
		middleware.Autenticacao(auth.NovoServicoToken(segredoTeste, time.Hour)),
	}, protecoes...)

	e.GET("/protegido", func(c echo.Context) error {
		claims := middleware.ClaimsDoContexto(c)
		return c.JSON(http.StatusOK, map[string]any{
			"usuario_id": claims.UsuarioID,
			"perfil":     claims.Perfil,
		})
	}, cadeia...)

	e.ServeHTTP(rec, req)
	return rec
}

func codigoDeErro(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	return body["erro"].(map[string]any)["codigo"].(string)
}

func TestAutenticacaoLiberaRequisicaoComTokenValido(t *testing.T) {
	rec := executar(t, "Bearer "+tokenDe(t, usuario.PerfilGestor, time.Hour))

	require.Equal(t, http.StatusOK, rec.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, float64(7), body["usuario_id"], "as claims chegam ao handler")
}

func TestAutenticacaoBloqueiaRequisicaoSemCabecalho(t *testing.T) {
	rec := executar(t, "")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Equal(t, "NAO_AUTORIZADO", codigoDeErro(t, rec))
}

func TestAutenticacaoBloqueiaCabecalhoSemPrefixoBearer(t *testing.T) {
	rec := executar(t, tokenDe(t, usuario.PerfilGestor, time.Hour))

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAutenticacaoBloqueiaTokenAdulterado(t *testing.T) {
	rec := executar(t, "Bearer "+tokenDe(t, usuario.PerfilGestor, time.Hour)+"adulterado")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAutenticacaoBloqueiaTokenExpirado(t *testing.T) {
	rec := executar(t, "Bearer "+tokenDe(t, usuario.PerfilGestor, -time.Minute))

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Contains(t, body["erro"].(map[string]any)["mensagem"], "expirad")
}

// autorizadorFalso devolve um Acesso fixo (ou um erro).
type autorizadorFalso struct {
	acesso acesso.Acesso
	erro   error
}

func (a autorizadorFalso) AcessoDoUsuario(context.Context, int64) (acesso.Acesso, error) {
	return a.acesso, a.erro
}

func ativoCom(permissoes ...string) autorizadorFalso {
	conjunto := map[string]bool{}
	for _, p := range permissoes {
		conjunto[p] = true
	}
	return autorizadorFalso{acesso: acesso.Acesso{Ativo: true, Permissoes: conjunto}}
}

func executarComPermissao(t *testing.T, autorizador middleware.Autorizador, permissao string) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	if autorizador != nil {
		e.Use(middleware.Autorizacao(autorizador))
	}
	e.GET("/protegido", func(c echo.Context) error { return c.NoContent(http.StatusOK) },
		middleware.Autenticacao(auth.NovoServicoToken(segredoTeste, time.Hour)), middleware.ExigirPermissao(permissao))
	req := httptest.NewRequest(http.MethodGet, "/protegido", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+tokenDe(t, usuario.PerfilGestor, time.Hour))
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestExigirPermissaoLiberaQuemTem(t *testing.T) {
	assert.Equal(t, http.StatusOK, executarComPermissao(t, ativoCom("fornecedores.incluir"), "fornecedores.incluir").Code)
}

func TestExigirPermissaoBloqueiaQuemNaoTem(t *testing.T) {
	rec := executarComPermissao(t, ativoCom(), "fornecedores.incluir")

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Equal(t, "ACESSO_NEGADO", codigoDeErro(t, rec))
}

func TestExigirPermissaoUsuarioInativadoDepoisDoLoginResponde401(t *testing.T) {
	rec := executarComPermissao(t, autorizadorFalso{acesso: acesso.Acesso{Ativo: false}}, "fornecedores.incluir")

	assert.Equal(t, http.StatusUnauthorized, rec.Code, "o frontend leva ao login")
	assert.Equal(t, middleware.CodigoUsuarioInativo, codigoDeErro(t, rec), "com o motivo, nao 'sessao expirada'")
}

func TestExigirPermissaoComTrocaDeSenhaPendente(t *testing.T) {
	a := ativoCom("fornecedores.incluir")
	a.acesso.DeveTrocarSenha = true

	rec := executarComPermissao(t, a, "fornecedores.incluir")

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Equal(t, middleware.CodigoTrocaDeSenha, codigoDeErro(t, rec))
}

func TestExigirPermissaoComFalhaNoResolvedorNegaCom500(t *testing.T) {
	rec := executarComPermissao(t, autorizadorFalso{erro: errors.New("banco fora")}, "fornecedores.incluir")

	assert.Equal(t, http.StatusInternalServerError, rec.Code, "falha nao pode virar acesso liberado")
}

func TestExigirPermissaoSemAutorizadorNoRoteadorDa500(t *testing.T) {
	rec := executarComPermissao(t, nil, "fornecedores.incluir")

	assert.Equal(t, http.StatusInternalServerError, rec.Code, "erro de montagem, nao 'usuario inativo'")
}
