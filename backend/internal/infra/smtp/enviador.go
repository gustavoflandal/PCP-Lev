// Package smtp entrega e-mails num servidor SMTP (implementa email.Enviador).
package smtp

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"log/slog"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/mail"
	netsmtp "net/smtp"
	"net/textproto"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/email"
)

// tempoMaximo vale para a conversa inteira (conexao, TLS, autenticacao e
// envio): um servidor que aceita a conexao e nao responde nao pode prender a
// requisicao do teste ate o timeout do navegador.
const tempoMaximo = 15 * time.Second

// Enviador fala SMTP com o servidor configurado.
type Enviador struct{}

// NovoEnviador cria o enviador.
func NovoEnviador() *Enviador { return &Enviador{} }

// Enviar abre a conexao (TLS implicito, STARTTLS ou sem criptografia),
// autentica se houver usuario e entrega a mensagem. O erro devolvido e uma
// categoria legivel (ver categorizar); o detalhe tecnico vai so para o log.
func (e *Enviador) Enviar(ctx context.Context, s email.Servidor, msg email.Mensagem) error {
	if err := e.enviar(ctx, s, msg); err != nil {
		slog.Warn("envio smtp falhou", "host", s.Host, "porta", s.Porta, "erro", err)
		return categorizar(err)
	}
	return nil
}

func (e *Enviador) enviar(ctx context.Context, s email.Servidor, msg email.Mensagem) error {
	ctx, cancelar := context.WithTimeout(ctx, tempoMaximo)
	defer cancelar()

	endereco := net.JoinHostPort(s.Host, strconv.Itoa(s.Porta))
	configTLS := &tls.Config{ServerName: s.Host, MinVersion: tls.VersionTLS12}

	discador := &net.Dialer{}
	var conexao net.Conn
	var err error
	if s.Criptografia == email.TLSImplicito {
		conexao, err = (&tls.Dialer{NetDialer: discador, Config: configTLS}).DialContext(ctx, "tcp", endereco)
	} else {
		conexao, err = discador.DialContext(ctx, "tcp", endereco)
	}
	if err != nil {
		return fmt.Errorf("conectar a %s: %w", endereco, err)
	}
	prazo, _ := ctx.Deadline()
	_ = conexao.SetDeadline(prazo)
	// Se a requisicao for cancelada antes do prazo (o navegador desistiu), a
	// conversa para junto em vez de seguir ate os 15s.
	parar := context.AfterFunc(ctx, func() { _ = conexao.Close() })
	defer parar()

	cliente, err := netsmtp.NewClient(conexao, s.Host)
	if err != nil {
		_ = conexao.Close()
		return fmt.Errorf("iniciar conversa SMTP: %w", err)
	}
	defer func() { _ = cliente.Close() }()

	if s.Criptografia == email.StartTLS {
		if ok, _ := cliente.Extension("STARTTLS"); !ok {
			return errSemStartTLS
		}
		if err := cliente.StartTLS(configTLS); err != nil {
			return fmt.Errorf("negociar STARTTLS: %w", err)
		}
	}

	if s.Usuario != "" {
		autenticador, err := escolherAutenticacao(cliente, s)
		if err != nil {
			return err
		}
		if err := cliente.Auth(autenticador); err != nil {
			return fmt.Errorf("autenticar: %w", err)
		}
	}

	if err := cliente.Mail(msg.RemetenteEmail); err != nil {
		return fmt.Errorf("remetente recusado: %w", err)
	}
	if err := cliente.Rcpt(msg.Destinatario); err != nil {
		return fmt.Errorf("destinatario recusado: %w", err)
	}
	escritor, err := cliente.Data()
	if err != nil {
		return fmt.Errorf("iniciar envio: %w", err)
	}
	if _, err := escritor.Write(montar(msg)); err != nil {
		return fmt.Errorf("enviar conteudo: %w", err)
	}
	if err := escritor.Close(); err != nil {
		return fmt.Errorf("concluir envio: %w", err)
	}
	return cliente.Quit()
}

var (
	errSemStartTLS  = errors.New("o servidor nao oferece STARTTLS -- escolha outra criptografia")
	errSemAuth      = errors.New("o servidor nao aceita autenticacao -- deixe usuario e senha em branco")
	errSemMecanismo = errors.New("o servidor nao oferece autenticacao PLAIN nem LOGIN")
)

// escolherAutenticacao usa PLAIN quando anunciado e LOGIN como alternativa
// (ha servidores corporativos que so anunciam LOGIN). Os dois so mandam a
// senha por conexao cifrada -- PlainAuth ja garante isso, e loginAuth repete
// a mesma regra.
func escolherAutenticacao(cliente *netsmtp.Client, s email.Servidor) (netsmtp.Auth, error) {
	ok, mecanismos := cliente.Extension("AUTH")
	if !ok {
		return nil, errSemAuth
	}
	anunciados := strings.Fields(strings.ToUpper(mecanismos))
	switch {
	case contem(anunciados, "PLAIN"):
		return netsmtp.PlainAuth("", s.Usuario, s.Senha, s.Host), nil
	case contem(anunciados, "LOGIN"):
		return &loginAuth{usuario: s.Usuario, senha: s.Senha, host: s.Host}, nil
	default:
		return nil, errSemMecanismo
	}
}

func contem(lista []string, item string) bool {
	for _, v := range lista {
		if v == item {
			return true
		}
	}
	return false
}

// loginAuth implementa o mecanismo AUTH LOGIN (usuario e senha em base64, um
// por desafio do servidor), que o net/smtp nao traz.
type loginAuth struct {
	usuario, senha, host string
}

func (a *loginAuth) Start(servidor *netsmtp.ServerInfo) (string, []byte, error) {
	if !servidor.TLS && !ehLocal(servidor.Name) {
		return "", nil, errors.New("conexao sem criptografia -- a senha nao sera enviada")
	}
	if servidor.Name != a.host {
		return "", nil, errors.New("nome do servidor diferente do configurado")
	}
	return "LOGIN", nil, nil
}

func (a *loginAuth) Next(desafio []byte, mais bool) ([]byte, error) {
	if !mais {
		return nil, nil
	}
	pergunta := strings.ToLower(strings.TrimSpace(string(desafio)))
	switch {
	case strings.Contains(pergunta, "username"):
		return []byte(a.usuario), nil
	case strings.Contains(pergunta, "password"):
		return []byte(a.senha), nil
	default:
		return nil, fmt.Errorf("desafio de autenticacao inesperado")
	}
}

func ehLocal(host string) bool {
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

// categorizar troca o erro tecnico por uma mensagem legivel e sem detalhes
// de rede interna: o "testar" e so de Administrador, mas devolver IP
// resolvido, banner de servico ou nome de certificado interno transformaria
// o botao num scanner de portas. A resposta propria do servidor SMTP (codigo
// + texto, ex.: "535 5.7.8 Authentication failed") continua -- e o que ajuda a
// resolver, e vem do servidor configurado.
func categorizar(err error) error {
	var erroSMTP *textproto.Error
	var erroRede net.Error
	var erroCertificado *tls.CertificateVerificationError
	var erroAutoridade x509.UnknownAuthorityError
	var erroNome x509.HostnameError
	switch {
	case errors.Is(err, errSemStartTLS), errors.Is(err, errSemAuth), errors.Is(err, errSemMecanismo):
		return err
	case errors.As(err, &erroSMTP):
		if erroSMTP.Code == 535 || erroSMTP.Code == 534 {
			return fmt.Errorf("usuario ou senha recusados pelo servidor (%d %s)", erroSMTP.Code, erroSMTP.Msg)
		}
		return fmt.Errorf("o servidor respondeu %d %s", erroSMTP.Code, erroSMTP.Msg)
	case errors.As(err, &erroCertificado), errors.As(err, &erroAutoridade), errors.As(err, &erroNome):
		return errors.New("o certificado TLS do servidor nao e valido ou nao e confiavel")
	case errors.As(err, &erroRede) && erroRede.Timeout(), errors.Is(err, context.DeadlineExceeded):
		return errors.New("o servidor nao respondeu a tempo")
	case conexaoRecusada(err):
		return errors.New("conexao recusada -- confira servidor e porta")
	case strings.Contains(err.Error(), "no such host"):
		return errors.New("servidor nao encontrado -- confira o nome (host)")
	case strings.Contains(err.Error(), "tls:"):
		return errors.New("falha ao negociar a criptografia TLS -- confira porta e criptografia")
	default:
		return errors.New("nao foi possivel concluir a conversa com o servidor de e-mail -- confira servidor, porta e criptografia")
	}
}

// montar gera a mensagem RFC 5322 em UTF-8: cabecalhos com acento codificados
// (RFC 2047) e corpo em quoted-printable.
func montar(msg email.Mensagem) []byte {
	var b bytes.Buffer
	remetente := mail.Address{Name: semQuebraDeLinha(msg.RemetenteNome), Address: msg.RemetenteEmail}
	b.WriteString("From: " + remetente.String() + "\r\n")
	b.WriteString("To: " + (&mail.Address{Address: msg.Destinatario}).String() + "\r\n")
	b.WriteString("Subject: " + mime.QEncoding.Encode("utf-8", semQuebraDeLinha(msg.Assunto)) + "\r\n")
	b.WriteString("Date: " + time.Now().Format(time.RFC1123Z) + "\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/plain; charset=utf-8\r\n")
	b.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")
	qp := quotedprintable.NewWriter(&b)
	_, _ = qp.Write([]byte(msg.Corpo))
	_ = qp.Close()
	return b.Bytes()
}

// semQuebraDeLinha impede injecao de cabecalho (um "\r\nBcc: ..." no nome do
// remetente ou no assunto).
func semQuebraDeLinha(texto string) string {
	return strings.NewReplacer("\r", " ", "\n", " ").Replace(texto)
}

// wsaeConnRefused e o codigo do Windows (WSAECONNREFUSED): la o erro nao e
// igual a syscall.ECONNREFUSED e o texto vem no idioma do sistema, entao
// comparar a mensagem em ingles nao basta.
const wsaeConnRefused = 10061

// conexaoRecusada diz se a falha foi uma conexao recusada pelo destino, em
// qualquer sistema operacional.
func conexaoRecusada(err error) bool {
	var errno syscall.Errno
	if errors.As(err, &errno) && (errno == syscall.ECONNREFUSED || uintptr(errno) == wsaeConnRefused) {
		return true
	}
	return strings.Contains(err.Error(), "connection refused")
}
