package smtp

import (
	"errors"
	"fmt"
	netsmtp "net/smtp"
	"net/textproto"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCategorizarEscondeDetalhesDeRedeInterna(t *testing.T) {
	casos := map[string]struct {
		erro     error
		esperado string
		proibido string
	}{
		"porta fechada": {
			fmt.Errorf("conectar a 10.0.0.5:5432: %w", errors.New("dial tcp 10.0.0.5:5432: connect: connection refused")),
			"conexao recusada", "10.0.0.5",
		},
		"banner de outro servico": {
			fmt.Errorf("iniciar conversa SMTP: %w", errors.New("short response: SSH-2.0-OpenSSH_9.6")),
			"nao foi possivel concluir", "OpenSSH",
		},
		"host inexistente": {
			errors.New("dial tcp: lookup smtp.interno.local: no such host"),
			"servidor nao encontrado", "interno.local",
		},
	}
	for nome, caso := range casos {
		t.Run(nome, func(t *testing.T) {
			msg := categorizar(caso.erro).Error()
			assert.Contains(t, msg, caso.esperado)
			assert.NotContains(t, msg, caso.proibido)
		})
	}
}

func TestCategorizarMantemARespostaDoServidorSMTP(t *testing.T) {
	msg := categorizar(fmt.Errorf("autenticar: %w", &textproto.Error{Code: 535, Msg: "5.7.8 Authentication failed"})).Error()

	assert.Contains(t, msg, "usuario ou senha recusados")
	assert.Contains(t, msg, "535 5.7.8 Authentication failed")
}

func TestLoginAuthRespondeOsDesafiosEExigeTLS(t *testing.T) {
	a := &loginAuth{usuario: "pcp@empresa.com.br", senha: "segredo", host: "smtp.empresa.com.br"}

	_, _, err := a.Start(&netsmtp.ServerInfo{Name: "smtp.empresa.com.br", TLS: false})
	assert.Error(t, err, "sem TLS a senha nao sai")

	mecanismo, _, err := a.Start(&netsmtp.ServerInfo{Name: "smtp.empresa.com.br", TLS: true})
	require.NoError(t, err)
	assert.Equal(t, "LOGIN", mecanismo)

	resposta, err := a.Next([]byte("Username:"), true)
	require.NoError(t, err)
	assert.Equal(t, "pcp@empresa.com.br", string(resposta))
	resposta, err = a.Next([]byte("Password:"), true)
	require.NoError(t, err)
	assert.Equal(t, "segredo", string(resposta))

	_, _, err = a.Start(&netsmtp.ServerInfo{Name: "smtp.atacante.com", TLS: true})
	assert.Error(t, err, "nome diferente do configurado")
}
