package api_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api"
	"github.com/gustavoflandal/pcp-lev/backend/internal/config"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// roteador monta o Echo real da aplicacao, com todas as rotas registradas, e
// devolve tambem o pool para os testes que precisam inspecionar o banco
// diretamente (ex.: a trilha de auditoria, que nenhum endpoint devolve hoje).
func roteador(t *testing.T) (http.Handler, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)

	handler := api.NovoRoteador(api.Dependencias{
		Cfg: &config.Config{
			APIEnv:      "test",
			CorsOrigens: []string{"http://localhost:5173"},
		},
		Pool:   pool,
		Tokens: auth.NovoServicoToken("segredo_de_teste_com_mais_de_32_caracteres", time.Hour),
	})
	return handler, pool
}

// Os handlers sao testados com um grupo montado a mao, entao um modulo pode
// existir inteiro e mesmo assim ficar de fora do roteador da aplicacao. Estes
// testes cobrem exatamente essa lacuna: exigem 401 (rota existe e e protegida)
// no lugar de 404 (rota nunca registrada).
func TestRotasDosCadastrosEstaoRegistradas(t *testing.T) {
	handler, _ := roteador(t)

	rotas := []string{
		"/api/v1/produtos-acabados",
		"/api/v1/partes-pecas",
		"/api/v1/fornecedores",
	}

	for _, rota := range rotas {
		t.Run(rota, func(t *testing.T) {
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, rota, nil))

			assert.Equal(t, http.StatusUnauthorized, rec.Code,
				"a rota deve existir e exigir autenticacao")
		})
	}
}

func TestSaudeRespondeSemToken(t *testing.T) {
	handler, _ := roteador(t)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/saude", nil))

	assert.Equal(t, http.StatusOK, rec.Code)
}

// TestRequisicaoAutenticadaGravaUsuarioEIPNaAuditoria e o teste de ponta a
// ponta da correcao do pinning de conexao: antes dela, os triggers da
// migration 007 dependiam de variaveis de sessao do Postgres que o Go nunca
// definia, entao toda linha de auditoria tinha usuario_id/endereco_ip
// sempre NULL, mesmo com uma requisicao autenticada de verdade.
func TestRequisicaoAutenticadaGravaUsuarioEIPNaAuditoria(t *testing.T) {
	handler, pool := roteador(t)
	ctx := context.Background()

	recLogin := httptest.NewRecorder()
	reqLogin := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login",
		strings.NewReader(`{"username": "admin", "password": "Admin@123"}`))
	reqLogin.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	handler.ServeHTTP(recLogin, reqLogin)
	require.Equal(t, http.StatusOK, recLogin.Code, recLogin.Body.String())

	var resposta struct {
		AccessToken string `json:"access_token"`
		Usuario     struct {
			ID int64 `json:"id"`
		} `json:"usuario"`
	}
	require.NoError(t, json.Unmarshal(recLogin.Body.Bytes(), &resposta))

	corpoFornecedor := `{
		"razao_social": "Fornecedor Teste Auditoria", "cnpj": "11222333000181",
		"contato_nome": "", "contato_email": "", "contato_telefone": "",
		"endereco": "", "lead_time_medio": 7, "condicao_pagamento": ""
	}`
	recCriar := httptest.NewRecorder()
	reqCriar := httptest.NewRequest(http.MethodPost, "/api/v1/fornecedores", strings.NewReader(corpoFornecedor))
	reqCriar.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	reqCriar.Header.Set(echo.HeaderAuthorization, "Bearer "+resposta.AccessToken)
	reqCriar.RemoteAddr = "203.0.113.7:54321"
	handler.ServeHTTP(recCriar, reqCriar)
	require.Equal(t, http.StatusCreated, recCriar.Code, recCriar.Body.String())

	var usuarioID *int64
	var enderecoIP *string
	err := pool.QueryRow(ctx,
		`SELECT usuario_id, endereco_ip FROM auditoria
		 WHERE tabela = 'fornecedores' AND operacao = 'INSERT'
		 ORDER BY id DESC LIMIT 1`,
	).Scan(&usuarioID, &enderecoIP)
	require.NoError(t, err)

	require.NotNil(t, usuarioID, "usuario_id nao pode ficar NULL numa requisicao com token valido")
	assert.Equal(t, resposta.Usuario.ID, *usuarioID)
	require.NotNil(t, enderecoIP)
	assert.Equal(t, "203.0.113.7", *enderecoIP)
}
