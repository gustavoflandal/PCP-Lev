package handlers_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
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
	// acessos e o resolvedor do middleware; handlers que invalidam o cache
	// (perfis, usuarios) devem usar este mesmo.
	acessos *acesso.Servico
	t       *testing.T
}

func novaAPIProtegida(t *testing.T, pool *pgxpool.Pool) *apiProtegida {
	t.Helper()
	e := echo.New()
	// Mesmo resolvedor de permissoes do roteador real, sobre a matriz semeada
	// pela migration 014 -- os testes exercitam a matriz de verdade.
	acessos := acesso.NovoServico(repository.NovoAcessoRepositorio(pool))
	e.Use(middleware.Autorizacao(acessos))
	return &apiProtegida{echo: e, tokens: auth.NovoServicoToken(segredoTeste, time.Hour), pool: pool, acessos: acessos, t: t}
}

// usuarioDe garante um usuario REAL com o perfil (as permissoes sao
// resolvidas do banco, nao do token) e devolve o id.
func (a *apiProtegida) usuarioDe(perfil usuario.Perfil) int64 {
	a.t.Helper()
	nome := "teste_" + strings.ToLower(string(perfil))
	var id int64
	err := a.pool.QueryRow(context.Background(), `
		INSERT INTO usuarios (username, nome, email, senha_hash, perfil)
		VALUES ($1::varchar, $1::varchar, $1::varchar || '@exemplo.local', 'x', $2)
		ON CONFLICT (username) DO UPDATE SET perfil = EXCLUDED.perfil
		RETURNING id`, nome, string(perfil)).Scan(&id)
	require.NoError(a.t, err)
	return id
}

// tokenDe gera um token de um usuario real com o perfil. O username no token
// continua "gestor01": e o autor gravado (created_by/updated_by) que varios
// testes conferem.
func (a *apiProtegida) tokenDe(perfil usuario.Perfil) string {
	a.t.Helper()
	token, _, err := a.tokens.Gerar(&usuario.Usuario{
		ID: a.usuarioDe(perfil), Username: "gestor01", Nome: "Gustavo Landal", Perfil: perfil, Ativo: true,
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

// chamarComo dispara a requisicao com o token de um usuario especifico.
func (a *apiProtegida) chamarComo(id int64, metodo, rota, corpo string) *httptest.ResponseRecorder {
	a.t.Helper()
	token, _, err := a.tokens.Gerar(&usuario.Usuario{ID: id, Username: "outro", Perfil: usuario.PerfilGestor, Ativo: true})
	require.NoError(a.t, err)
	var leitor io.Reader
	if corpo != "" {
		leitor = strings.NewReader(corpo)
	}
	req := httptest.NewRequest(metodo, rota, leitor)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
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

// dataFutura devolve hoje (UTC, o mesmo relogio de tempo.Hoje() no servidor)
// mais `dias`, no formato do contrato da API. Datas fixas nos fixtures viram
// passado conforme o calendario anda e quebram as validacoes "posterior a
// data de emissao/pedido".
func dataFutura(dias int) string {
	return time.Now().UTC().AddDate(0, 0, dias).Format("2006-01-02")
}

// perfilConsulta e o perfil somente-leitura da matriz da migration 014 (ve e
// exporta tudo que e operacional). Os testes de leitura usavam o OPERADOR
// antigo, que na Fase 2.2a virou o Operador de Montagem, com escopo menor.
const perfilConsulta = usuario.Perfil("CONSULTA")
