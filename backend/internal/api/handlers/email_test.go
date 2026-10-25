package handlers_test

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/email"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/cripto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type enviadorDeTeste struct{ erro error }

func (e enviadorDeTeste) Enviar(context.Context, email.Servidor, email.Mensagem) error { return e.erro }

func apiEmail(t *testing.T, erroDeEnvio error) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)
	cofre, err := cripto.NovoCofre(base64.StdEncoding.EncodeToString([]byte(strings.Repeat("c", 32))))
	require.NoError(t, err)
	servico := email.NovoServico(repository.NovoEmailRepositorio(pool), cofre, enviadorDeTeste{erro: erroDeEnvio})
	handlers.NovoEmailHandler(servico).Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	return api
}

const corpoSMTP = `{"habilitado":true,"host":"smtp.empresa.com.br","porta":587,"criptografia":"STARTTLS",
	"usuario":"pcp@empresa.com.br","senha":"senha-secreta-123","remetente_email":"pcp@empresa.com.br","remetente_nome":"PCP"}`

func TestSMTPSoAdministrador(t *testing.T) {
	api := apiEmail(t, nil)

	assert.Equal(t, http.StatusUnauthorized, api.semToken(http.MethodGet, "/api/v1/configuracoes/smtp").Code)
	for _, perfil := range []usuario.Perfil{usuario.PerfilGestor, usuario.PerfilOperador} {
		assert.Equal(t, http.StatusForbidden, api.chamar(http.MethodGet, "/api/v1/configuracoes/smtp", "", perfil).Code)
		assert.Equal(t, http.StatusForbidden, api.chamar(http.MethodPut, "/api/v1/configuracoes/smtp", corpoSMTP, perfil).Code)
		assert.Equal(t, http.StatusForbidden,
			api.chamar(http.MethodPost, "/api/v1/configuracoes/smtp/testar", `{"destinatario":"a@b.com"}`, perfil).Code)
	}
}

func TestSMTPGravarNuncaDevolveASenha(t *testing.T) {
	api := apiEmail(t, nil)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/smtp", corpoSMTP, usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.NotContains(t, rec.Body.String(), "senha-secreta-123")
	assert.Equal(t, true, dados(t, rec)["senha_definida"])

	rec = api.chamar(http.MethodGet, "/api/v1/configuracoes/smtp", "", usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.NotContains(t, rec.Body.String(), "senha-secreta-123")
	assert.NotContains(t, rec.Body.String(), "senha_cifrada")
	assert.Equal(t, "smtp.empresa.com.br", dados(t, rec)["host"])
}

func TestSMTPValidacaoResponde400(t *testing.T) {
	api := apiEmail(t, nil)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/smtp",
		`{"habilitado":true,"host":"","porta":587,"criptografia":"STARTTLS","remetente_email":"pcp@empresa.com.br"}`, usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestSMTPTesteSemConfiguracaoResponde409(t *testing.T) {
	api := apiEmail(t, nil)

	rec := api.chamar(http.MethodPost, "/api/v1/configuracoes/smtp/testar", `{"destinatario":"a@b.com"}`, usuario.PerfilAdmin)

	assert.Equal(t, http.StatusConflict, rec.Code)
}

func TestSMTPTesteEnviadoResponde200(t *testing.T) {
	api := apiEmail(t, nil)
	require.Equal(t, http.StatusOK, api.chamar(http.MethodPut, "/api/v1/configuracoes/smtp", corpoSMTP, usuario.PerfilAdmin).Code)

	rec := api.chamar(http.MethodPost, "/api/v1/configuracoes/smtp/testar", `{"destinatario":"a@b.com"}`, usuario.PerfilAdmin)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, true, dados(t, rec)["enviado"])
}

func TestSMTPFalhaDoServidorResponde502SemASenha(t *testing.T) {
	api := apiEmail(t, errors.New("535 5.7.8 credenciais invalidas (senha-secreta-123)"))
	require.Equal(t, http.StatusOK, api.chamar(http.MethodPut, "/api/v1/configuracoes/smtp", corpoSMTP, usuario.PerfilAdmin).Code)

	rec := api.chamar(http.MethodPost, "/api/v1/configuracoes/smtp/testar", `{"destinatario":"a@b.com"}`, usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadGateway, rec.Code)
	assert.Contains(t, rec.Body.String(), "FALHA_SERVICO_EXTERNO")
	assert.Contains(t, rec.Body.String(), "535 5.7.8")
	assert.NotContains(t, rec.Body.String(), "senha-secreta-123")
}
