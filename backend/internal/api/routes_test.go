package api_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api"
	"github.com/gustavoflandal/pcp-lev/backend/internal/config"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
)

// roteador monta o Echo real da aplicacao, com todas as rotas registradas.
func roteador(t *testing.T) http.Handler {
	t.Helper()
	pool := testsupport.BancoMigrado(t)

	return api.NovoRoteador(api.Dependencias{
		Cfg: &config.Config{
			APIEnv:      "test",
			CorsOrigens: []string{"http://localhost:5173"},
		},
		Pool:   pool,
		Tokens: auth.NovoServicoToken("segredo_de_teste_com_mais_de_32_caracteres", time.Hour),
	})
}

// Os handlers sao testados com um grupo montado a mao, entao um modulo pode
// existir inteiro e mesmo assim ficar de fora do roteador da aplicacao. Estes
// testes cobrem exatamente essa lacuna: exigem 401 (rota existe e e protegida)
// no lugar de 404 (rota nunca registrada).
func TestRotasDosCadastrosEstaoRegistradas(t *testing.T) {
	handler := roteador(t)

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
	handler := roteador(t)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/saude", nil))

	assert.Equal(t, http.StatusOK, rec.Code)
}
