package middleware_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// cnpjsDeTeste evita colisao com a unique de fornecedores entre as escritas
// de um mesmo teste.
var cnpjsDeTeste = []string{"11222333000181", "34028316000103", "60746948000112", "33000167000101"}

// ambienteDeAuditoria monta um Echo com a MESMA cadeia de middlewares da
// aplicacao real (Recover antes de ConexaoDeAuditoria -- ver api.NovoRoteador)
// e rotas minimas que escrevem numa tabela auditada. Nao usa api.NovoRoteador
// para poder exercitar um handler que entra em panico e um GET que escreve,
// dois caminhos que nenhuma rota de producao expoe mas que modelam,
// respectivamente, um bug em qualquer handler e qualquer escrita fora do
// pinning (jobs, fallback do middleware).
type ambienteDeAuditoria struct {
	echo    *echo.Echo
	pool    *pgxpool.Pool
	adminID int64
	// naoFixouConexao registra, na ultima chamada a GET /le, se o contexto
	// da requisicao ficou SEM executor fixado.
	naoFixouConexao bool
}

func ambiente(t *testing.T) *ambienteDeAuditoria {
	t.Helper()
	pool := testsupport.BancoMigrado(t)

	var adminID int64
	require.NoError(t, pool.QueryRow(context.Background(),
		`SELECT id FROM usuarios WHERE username = 'admin'`).Scan(&adminID))

	amb := &ambienteDeAuditoria{echo: echo.New(), pool: pool, adminID: adminID}
	amb.echo.Use(echomw.Recover())
	amb.echo.Use(middleware.ConexaoDeAuditoria(pool, auth.NovoServicoToken(segredoTeste, time.Hour)))

	inserir := func(c echo.Context) error {
		ctx := c.Request().Context()
		_, err := db.DoContexto(ctx, pool).Exec(ctx,
			`INSERT INTO fornecedores (razao_social, cnpj, lead_time_medio, ativo, created_by, updated_by)
			 VALUES ('Fornecedor Auditoria', $1, 7, true, 'teste', 'teste')`,
			c.QueryParam("cnpj"))
		return err
	}
	escrever := func(c echo.Context) error {
		if err := inserir(c); err != nil {
			return err
		}
		return c.NoContent(http.StatusCreated)
	}

	amb.echo.POST("/escreve", escrever)
	// GET que escreve: nao existe em producao, mas e o unico jeito de exercitar
	// uma escrita que roda no pool COMPARTILHADO (o middleware pula o pinning
	// em GET) logo depois de outra requisicao ter devolvido sua conexao.
	amb.echo.GET("/escreve", escrever)
	// Escreve e quebra ANTES de responder, para que a resposta seja a do
	// Recover (500) e nao um 201 ja comprometido.
	amb.echo.POST("/panico", func(c echo.Context) error {
		_ = inserir(c)
		panic("falha proposital no handler")
	})
	amb.echo.GET("/le", func(c echo.Context) error {
		amb.naoFixouConexao = db.DoContexto(c.Request().Context(), pool) == db.Executor(pool)
		return c.NoContent(http.StatusOK)
	})

	return amb
}

// chamar dispara a requisicao; token vazio significa "sem Authorization".
func (a *ambienteDeAuditoria) chamar(t *testing.T, metodo, rota, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(metodo, rota, nil)
	if token != "" {
		req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	a.echo.ServeHTTP(rec, req)
	return rec
}

func (a *ambienteDeAuditoria) tokenDoAdmin(t *testing.T) string {
	t.Helper()
	token, _, err := auth.NovoServicoToken(segredoTeste, time.Hour).Gerar(&usuario.Usuario{
		ID: a.adminID, Username: "admin", Nome: "Administrador", Perfil: usuario.PerfilAdmin, Ativo: true,
	})
	require.NoError(t, err)
	return token
}

// usuarioDaUltimaAuditoria devolve o usuario_id da linha de auditoria mais
// recente do CNPJ informado -- identifica a escrita de uma requisicao
// especifica sem depender da ordem global da tabela.
func (a *ambienteDeAuditoria) usuarioDaUltimaAuditoria(t *testing.T, cnpj string) *int64 {
	t.Helper()
	var usuarioID *int64
	err := a.pool.QueryRow(context.Background(),
		`SELECT usuario_id FROM auditoria
		 WHERE tabela = 'fornecedores' AND dados_novos->>'cnpj' = $1
		 ORDER BY id DESC LIMIT 1`, cnpj).Scan(&usuarioID)
	require.NoError(t, err, "a escrita do cnpj %s deveria ter gerado uma linha de auditoria", cnpj)
	return usuarioID
}

// TestGETNaoFixaConexaoDoPool cobre o teto de requisicoes simultaneas: se o
// middleware fixasse uma conexao em toda requisicao, DB_MAX_CONNS viraria o
// limite de GETs concorrentes da API inteira -- inclusive de GETs sem
// autenticacao para rotas inexistentes, que o Echo tambem passa pela cadeia
// global de middlewares.
func TestGETNaoFixaConexaoDoPool(t *testing.T) {
	amb := ambiente(t)

	rec := amb.chamar(t, http.MethodGet, "/le", amb.tokenDoAdmin(t))

	require.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, amb.naoFixouConexao,
		"GET nao dispara trigger de auditoria e nao pode segurar uma conexao do pool")
}

// TestRotaInexistenteNaoFixaConexaoDoPool garante que o caminho de 404 (onde
// o Echo aplica os middlewares globais ao NotFoundHandler) nao consome uma
// conexao -- era o vetor de esgotamento sem autenticacao nenhuma.
func TestRotaInexistenteNaoFixaConexaoDoPool(t *testing.T) {
	amb := ambiente(t)
	antes := amb.pool.Stat().AcquireCount()

	for i := 0; i < 30; i++ {
		rec := amb.chamar(t, http.MethodGet, "/rota-que-nao-existe", "")
		require.Equal(t, http.StatusNotFound, rec.Code)
	}

	assert.Equal(t, antes, amb.pool.Stat().AcquireCount(),
		"nenhum GET para rota inexistente pode tomar conexao do pool")
}

// TestRequisicaoSemTokenNaoHerdaUsuarioDaAnterior prova o RESET no caminho
// feliz: como o pool devolve a conexao recem-liberada (LIFO), a segunda
// requisicao roda na MESMA conexao fisica da primeira.
func TestRequisicaoSemTokenNaoHerdaUsuarioDaAnterior(t *testing.T) {
	amb := ambiente(t)

	rec := amb.chamar(t, http.MethodPost, "/escreve?cnpj="+cnpjsDeTeste[0], amb.tokenDoAdmin(t))
	require.Equal(t, http.StatusCreated, rec.Code)
	comUsuario := amb.usuarioDaUltimaAuditoria(t, cnpjsDeTeste[0])
	require.NotNil(t, comUsuario, "requisicao autenticada precisa gravar o usuario")
	require.Equal(t, amb.adminID, *comUsuario)

	rec = amb.chamar(t, http.MethodPost, "/escreve?cnpj="+cnpjsDeTeste[1], "")
	require.Equal(t, http.StatusCreated, rec.Code)

	assert.Nil(t, amb.usuarioDaUltimaAuditoria(t, cnpjsDeTeste[1]),
		"sem token a trilha deve ficar NULL, nunca com o usuario da requisicao anterior")
}

// TestPanicNoHandlerNaoDeixaUsuarioNaConexao e a regressao mais direta do
// achado: um panic desenrola a pilha por este middleware, entao o RESET
// precisa estar num defer. Sem isso, a conexao volta ao pool com
// pcp.usuario_id definido e a proxima escrita que rodar no pool compartilhado
// (aqui, um GET, que nao fixa conexao) e atribuida ao usuario ERRADO -- pior
// que NULL numa trilha de auditoria, porque e evidencia falsa.
func TestPanicNoHandlerNaoDeixaUsuarioNaConexao(t *testing.T) {
	amb := ambiente(t)

	rec := amb.chamar(t, http.MethodPost, "/panico?cnpj="+cnpjsDeTeste[0], amb.tokenDoAdmin(t))
	require.Equal(t, http.StatusInternalServerError, rec.Code)
	require.NotNil(t, amb.usuarioDaUltimaAuditoria(t, cnpjsDeTeste[0]),
		"a escrita antes do panic aconteceu na conexao fixada, com usuario")

	rec = amb.chamar(t, http.MethodGet, "/escreve?cnpj="+cnpjsDeTeste[1], "")
	require.Equal(t, http.StatusCreated, rec.Code)

	assert.Nil(t, amb.usuarioDaUltimaAuditoria(t, cnpjsDeTeste[1]),
		"a conexao devolvida ao pool apos o panic nao pode carregar o usuario da requisicao que quebrou")
}

// TestUsuariosDiferentesEmSequenciaNaoSeMisturam confirma a propriedade no
// uso normal: cada requisicao grava o seu proprio usuario, sem vazamento
// entre requisicoes que reaproveitam a mesma conexao do pool.
func TestUsuariosDiferentesEmSequenciaNaoSeMisturam(t *testing.T) {
	amb := ambiente(t)
	tokens := auth.NovoServicoToken(segredoTeste, time.Hour)

	esperados := make([]int64, 0, 3)
	for i := 0; i < 3; i++ {
		id := amb.adminID + int64(i)
		token, _, err := tokens.Gerar(&usuario.Usuario{
			ID: id, Username: "u" + strconv.FormatInt(id, 10), Nome: "Usuario",
			Perfil: usuario.PerfilAdmin, Ativo: true,
		})
		require.NoError(t, err)

		rec := amb.chamar(t, http.MethodPost, "/escreve?cnpj="+cnpjsDeTeste[i], token)
		require.Equal(t, http.StatusCreated, rec.Code)
		esperados = append(esperados, id)
	}

	for i, esperado := range esperados {
		gravado := amb.usuarioDaUltimaAuditoria(t, cnpjsDeTeste[i])
		require.NotNil(t, gravado)
		assert.Equal(t, esperado, *gravado,
			"cada linha da trilha tem que ficar com o usuario da propria requisicao")
	}
}
