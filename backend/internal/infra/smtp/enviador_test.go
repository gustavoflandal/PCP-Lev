package smtp_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/email"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/smtp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestServidorQueNaoRespondeEsgotaOPrazo(t *testing.T) {
	// Aceita a conexao e nunca manda o "220" de boas-vindas.
	ouvinte, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer ouvinte.Close()
	go func() {
		conexao, err := ouvinte.Accept()
		if err == nil {
			time.Sleep(3 * time.Second)
			_ = conexao.Close()
		}
	}()
	porta := ouvinte.Addr().(*net.TCPAddr).Port

	ctx, cancelar := context.WithTimeout(context.Background(), time.Second)
	defer cancelar()
	inicio := time.Now()
	err = smtp.NovoEnviador().Enviar(ctx, email.Servidor{Host: "127.0.0.1", Porta: porta, Criptografia: email.SemCriptografia},
		email.Mensagem{RemetenteEmail: "a@b.com", Destinatario: "c@d.com"})

	assert.Error(t, err)
	assert.Less(t, time.Since(inicio), 2*time.Second, "respeita o prazo do contexto")
}

func TestConexaoRecusadaDevolveErroLegivel(t *testing.T) {
	err := smtp.NovoEnviador().Enviar(context.Background(),
		email.Servidor{Host: "127.0.0.1", Porta: 1, Criptografia: email.SemCriptografia},
		email.Mensagem{RemetenteEmail: "a@b.com", Destinatario: "c@d.com"})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "conexao recusada")
	assert.NotContains(t, err.Error(), "127.0.0.1", "sem detalhe de rede na mensagem")
}

// Envio real contra o Mailpit do docker-compose (perfil dev). So roda com
// PCP_TEST_SMTP=host:porta-smtp e PCP_TEST_SMTP_API=http://host:porta-web.
func TestEnvioRealNoMailpit(t *testing.T) {
	alvo, api := os.Getenv("PCP_TEST_SMTP"), os.Getenv("PCP_TEST_SMTP_API")
	if alvo == "" || api == "" {
		t.Skip("PCP_TEST_SMTP/PCP_TEST_SMTP_API nao definidos (Mailpit fora do ar)")
	}
	host, portaTexto, err := net.SplitHostPort(alvo)
	require.NoError(t, err)
	porta, _ := strconv.Atoi(portaTexto)
	assunto := fmt.Sprintf("Teste automatizado %d", time.Now().UnixNano())

	err = smtp.NovoEnviador().Enviar(context.Background(),
		email.Servidor{Host: host, Porta: porta, Criptografia: email.SemCriptografia},
		email.Mensagem{
			RemetenteEmail: "pcp@empresa.com.br", RemetenteNome: "Sistema PCP — Produção\r\nBcc: intruso@x.com",
			Destinatario: "destino@empresa.com.br", Assunto: assunto, Corpo: "Corpo com acentuação: ção.",
		})
	require.NoError(t, err)

	resposta, err := http.Get(api + "/api/v1/search?query=" + strings.ReplaceAll(assunto, " ", "+"))
	require.NoError(t, err)
	defer resposta.Body.Close()
	var achados struct {
		Messages []struct {
			Subject string
			From    struct{ Name, Address string }
			Bcc     []struct{ Address string }
		} `json:"messages"`
	}
	require.NoError(t, json.NewDecoder(resposta.Body).Decode(&achados))
	require.Len(t, achados.Messages, 1)
	m := achados.Messages[0]
	assert.Equal(t, assunto, m.Subject)
	assert.Equal(t, "pcp@empresa.com.br", m.From.Address)
	assert.Contains(t, m.From.Name, "Produção", "nome com acento decodificado certo")
	assert.Empty(t, m.Bcc, "quebra de linha no nome nao injeta cabecalho")
}
