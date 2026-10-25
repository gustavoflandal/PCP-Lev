// Package email contem a configuracao do servidor SMTP (doc 0, secao 4.7.7) e
// o envio de teste. Singleton, mesmo molde de internal/domain/regional. A
// senha so circula em texto claro dentro deste pacote, no instante do envio:
// gravada cifrada (Cifrador) e nunca devolvida pela API.
package email

import (
	"errors"
	"net/mail"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

// Criptografia da conexao com o servidor SMTP.
type Criptografia string

const (
	SemCriptografia Criptografia = "NENHUMA"
	StartTLS        Criptografia = "STARTTLS"
	TLSImplicito    Criptografia = "TLS"
)

var criptografiasValidas = []Criptografia{SemCriptografia, StartTLS, TLSImplicito}

var (
	ErrPortaInvalida           = errors.New("a porta deve ficar entre 1 e 65535")
	ErrCriptografiaInvalida    = errors.New("criptografia invalida")
	ErrHostObrigatorio         = errors.New("informe o servidor (host) para habilitar o envio de e-mail")
	ErrRemetenteInvalido       = errors.New("informe um e-mail de remetente valido")
	ErrSenhaETrocaConflitantes = errors.New("informe a nova senha ou peca para remover a senha, nao os dois")
	ErrChaveMestraAusente      = errors.New("a chave mestra de segredos (CHAVE_MESTRA_SEGREDOS) nao esta configurada no servidor -- sem ela a senha nao pode ser gravada")
	ErrNaoConfigurado          = errors.New("configure e salve o servidor de e-mail antes de enviar o teste")
	ErrDestinatarioInvalido    = errors.New("informe um e-mail de destinatario valido")
	ErrEnvioFalhou             = errors.New("o servidor de e-mail recusou ou nao respondeu")
	ErrSenhaIlegivel           = errors.New("a senha gravada nao pode ser decifrada (chave mestra trocada ou destino alterado) -- grave a senha de novo")
	ErrSenhaAoTrocarDestino    = errors.New("ao trocar servidor, porta ou usuario, digite a senha de novo (ou remova a senha gravada)")
	ErrAutenticacaoSemTLS      = errors.New("usuario e senha exigem criptografia (STARTTLS ou TLS) -- sem criptografia, deixe usuario e senha em branco")
	ErrCampoLongoDemais        = errors.New("um dos campos passou do tamanho maximo (servidor, usuario e e-mail: 255; nome: 100)")
)

// Configuracao e o singleton lido por GET /configuracoes/smtp. Nao tem campo
// de senha: so a indicacao de que ha uma gravada.
type Configuracao struct {
	Habilitado     bool         `json:"habilitado"`
	Host           string       `json:"host"`
	Porta          int          `json:"porta"`
	Criptografia   Criptografia `json:"criptografia"`
	Usuario        string       `json:"usuario"`
	SenhaDefinida  bool         `json:"senha_definida"`
	RemetenteEmail string       `json:"remetente_email"`
	RemetenteNome  string       `json:"remetente_nome"`
	UpdatedAt      time.Time    `json:"updated_at"`
	UpdatedBy      *string      `json:"updated_by,omitempty"`
}

// Dados sao os campos do PUT. Senha vazia mantem a atual; RemoverSenha apaga.
type Dados struct {
	Habilitado     bool
	Host           string
	Porta          int
	Criptografia   Criptografia
	Usuario        string
	Senha          string
	RemoverSenha   bool
	RemetenteEmail string
	RemetenteNome  string
}

// Normalizar limpa espacos (exceto da senha, que vale como digitada).
func (d *Dados) Normalizar() {
	d.Host = strings.TrimSpace(d.Host)
	d.Usuario = strings.TrimSpace(d.Usuario)
	d.RemetenteEmail = strings.TrimSpace(d.RemetenteEmail)
	d.RemetenteNome = strings.TrimSpace(d.RemetenteNome)
}

// Validar confere forma. Host e remetente so sao obrigatorios com o envio
// habilitado -- da para salvar um rascunho da configuracao desligada.
func (d Dados) Validar() error {
	if d.Porta < 1 || d.Porta > 65535 {
		return ErrPortaInvalida
	}
	if !slices.Contains(criptografiasValidas, d.Criptografia) {
		return ErrCriptografiaInvalida
	}
	if d.Senha != "" && d.RemoverSenha {
		return ErrSenhaETrocaConflitantes
	}
	if d.RemetenteEmail != "" && !emailValido(d.RemetenteEmail) {
		return ErrRemetenteInvalido
	}
	// Mesmos tamanhos das colunas da migration 013 -- acima disso o banco
	// recusaria com um 500 generico.
	if utf8.RuneCountInString(d.Host) > 255 || utf8.RuneCountInString(d.Usuario) > 255 ||
		utf8.RuneCountInString(d.RemetenteEmail) > 255 || utf8.RuneCountInString(d.RemetenteNome) > 100 {
		return ErrCampoLongoDemais
	}
	// A tela promete "Nenhuma: so servidor interno, sem usuario e senha"; o
	// net/smtp tambem recusaria mandar a senha sem TLS -- melhor dizer ao salvar
	// do que so no teste.
	if d.Criptografia == SemCriptografia && (d.Usuario != "" || d.Senha != "") {
		return ErrAutenticacaoSemTLS
	}
	if d.Habilitado {
		if d.Host == "" {
			return ErrHostObrigatorio
		}
		if d.RemetenteEmail == "" {
			return ErrRemetenteInvalido
		}
	}
	return nil
}

// contextoDaSenha amarra a senha cifrada ao destino (AAD do GCM): trocar host,
// porta ou usuario torna a senha gravada ilegivel, entao ela nunca e enviada a
// outro servidor sem alguem digita-la de novo.
func contextoDaSenha(host string, porta int, usuario string) string {
	return "configuracao_smtp.senha|" + strings.ToLower(host) + "|" + strconv.Itoa(porta) + "|" + usuario
}

// emailValido aceita so o endereco puro ("a@b.com"), nao "Nome <a@b.com>".
func emailValido(endereco string) bool {
	analisado, err := mail.ParseAddress(endereco)
	return err == nil && analisado.Address == endereco
}

// Servidor e o destino de um envio, com a senha ja decifrada.
type Servidor struct {
	Host         string
	Porta        int
	Criptografia Criptografia
	Usuario      string
	Senha        string
}

// Mensagem e um e-mail de texto simples.
type Mensagem struct {
	RemetenteEmail string
	RemetenteNome  string
	Destinatario   string
	Assunto        string
	Corpo          string
}
