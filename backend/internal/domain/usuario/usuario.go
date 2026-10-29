// Package usuario contem a entidade de usuario e as regras de credencial.
// Ref: docs/1_ESPECIFICACAO_REQUISITOS.md (RNF3 - Seguranca).
package usuario

import (
	"errors"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/i18n"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"golang.org/x/crypto/bcrypt"
)

// Politica de senha (RNF3, endurecida na Fase 5): de 10 caracteres ate o
// limite do bcrypt (72 bytes -- acima disso ele recusa o hash), fora da lista
// de senhas comuns e sem conter o login.
const (
	tamanhoMinimoSenha = 10
	tamanhoMaximoSenha = 72
)

// Falhas seguidas antes do bloqueio temporario da conta (migration 021).
const TentativasAntesDoBloqueio = 5

// custoBcrypt acima do padrao (10) para encarecer ataques de dicionario.
const custoBcrypt = 12

var (
	// ErrSenhaFraca indica senha abaixo da politica minima.
	ErrSenhaFraca = errors.New("a senha deve ter de 10 a 72 caracteres, nao pode ser uma senha comum nem conter o login")
	// ErrMuitasTentativas: conta bloqueada por um tempo apos falhas seguidas.
	ErrMuitasTentativas = errors.New("muitas tentativas de senha: aguarde alguns minutos e tente de novo")
	// ErrCredenciaisInvalidas cobre usuario inexistente e senha errada.
	// A mensagem e deliberadamente generica: distinguir os dois casos
	// permitiria enumerar usuarios validos.
	ErrCredenciaisInvalidas = errors.New("usuario ou senha invalidos")
	// ErrUsuarioInativo indica conta desativada.
	ErrUsuarioInativo = errors.New("usuario inativo")
	// ErrUsuarioBloqueado indica conta bloqueada pelo Administrador.
	ErrUsuarioBloqueado = errors.New("usuario bloqueado")
	// ErrNaoEncontrado indica usuario ausente no repositorio.
	ErrNaoEncontrado = errors.New("usuario nao encontrado")
	// ErrPreferenciaInvalida cobre tema/densidade/tamanho de fonte fora do
	// conjunto permitido (§4.6.1).
	ErrPreferenciaInvalida = errors.New("preferencia de aparencia invalida")
)

// Valores possiveis de Preferencias.Tema.
const (
	TemaClaro      = "claro"
	TemaEscuro     = "escuro"
	TemaAutomatico = "automatico"
)

// Valores possiveis de Preferencias.Densidade.
const (
	DensidadeCompacta    = "compacta"
	DensidadeConfortavel = "confortavel"
)

// Valores possiveis de Preferencias.TamanhoFonte.
const (
	FontePadrao      = "padrao"
	FonteGrande      = "grande"
	FonteExtraGrande = "extra-grande"
)

// Perfil define o nivel de acesso (RNF3).
type Perfil string

const (
	PerfilAdmin    Perfil = "ADMIN"
	PerfilGestor   Perfil = "GESTOR"
	PerfilOperador Perfil = "OPERADOR"
)

// Situacao do cadastro (doc 0, secao 4.7.3). Usuario nunca e excluido.
type Situacao string

const (
	SituacaoAtivo     Situacao = "ATIVO"
	SituacaoInativo   Situacao = "INATIVO"
	SituacaoBloqueado Situacao = "BLOQUEADO"
)

// Usuario e a entidade de acesso ao sistema.
type Usuario struct {
	ID               int64      `json:"id"`
	Username         string     `json:"username"`
	Nome             string     `json:"nome"`
	Email            string     `json:"email"`
	SenhaHash        string     `json:"-"`
	Perfil           Perfil     `json:"perfil"`
	Ativo            bool       `json:"ativo"`
	Situacao         Situacao   `json:"situacao"`
	Matricula        *string    `json:"matricula,omitempty"`
	Telefone         string     `json:"telefone"`
	Setor            string     `json:"setor"`
	DataAdmissao     tempo.Data `json:"data_admissao,omitzero"`
	DataDesligamento tempo.Data `json:"data_desligamento,omitzero"`
	DeveTrocarSenha  bool       `json:"deve_trocar_senha"`
	TentativasFalhas int        `json:"-"`
	BloqueadoAte     *time.Time `json:"-"`
	VersaoSessao     int        `json:"-"`
	UltimoLogin      *time.Time `json:"ultimo_login,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	// Preferencias de aparencia (§4.6.1) -- por usuario, aplicadas no
	// frontend via CSS custom properties.
	Tema          string `json:"tema"`
	AltoContraste bool   `json:"alto_contraste"`
	Densidade     string `json:"densidade"`
	TamanhoFonte  string `json:"tamanho_fonte"`
	// Idioma da interface e das mensagens da API: "pt-BR" ou "es".
	Idioma string `json:"idioma"`
}

// Preferencias sao os campos informados em PUT /auth/preferencias.
type Preferencias struct {
	Tema          string
	AltoContraste bool
	Densidade     string
	TamanhoFonte  string
	// Idioma vazio mantem o idioma ja gravado (clientes antigos nao o enviam).
	Idioma string
}

// Conjuntos fechados aceitos por Preferencias.Validar -- variaveis de
// pacote, nao alocadas a cada chamada.
var (
	temasValidos      = []string{TemaClaro, TemaEscuro, TemaAutomatico}
	densidadesValidas = []string{DensidadeCompacta, DensidadeConfortavel}
	fontesValidas     = []string{FontePadrao, FonteGrande, FonteExtraGrande}
)

// Validar aplica o conjunto fechado de valores permitidos por campo -- um
// valor fora da lista quebraria o CHECK constraint da migration com um 500
// generico em vez de um 400 explicando o motivo.
func (p Preferencias) Validar() error {
	if !slices.Contains(temasValidos, p.Tema) ||
		!slices.Contains(densidadesValidas, p.Densidade) ||
		!slices.Contains(fontesValidas, p.TamanhoFonte) ||
		(p.Idioma != "" && !slices.Contains(i18n.Validos, p.Idioma)) {
		return ErrPreferenciaInvalida
	}
	return nil
}

// senhasComuns: as primeiras tentativas de qualquer ataque de dicionario
// (comparadas sem caixa) -- com 10+ caracteres sobram poucas, mas sobram.
var senhasComuns = map[string]bool{
	"1234567890": true, "12345678910": true, "0123456789": true, "123456789a": true, "a123456789": true,
	"1234567890a": true, "qwertyuiop": true, "asdfghjkl1": true, "password12": true, "password123": true,
	"senha12345": true, "senha123456": true, "mudar12345": true, "mudar123456": true, "admin12345": true,
	"admin123456": true, "administrador": true, "administrator": true, "trocar12345": true, "brasil2026": true,
	"pcp1234567": true, "pcp12345678": true, "1q2w3e4r5t": true, "q1w2e3r4t5": true, "abc1234567": true,
	"abcd123456": true, "1111111111": true, "0000000000": true, "iloveyou12": true, "princesa12": true,
}

// ValidarSenha aplica a politica de senha (sem o login).
func ValidarSenha(senha string) error {
	n := utf8.RuneCountInString(senha)
	if n < tamanhoMinimoSenha || len(senha) > tamanhoMaximoSenha || senhasComuns[strings.ToLower(senha)] {
		return ErrSenhaFraca
	}
	if strings.Count(senha, string([]rune(senha)[0])) == n {
		return ErrSenhaFraca // um caractere repetido
	}
	return nil
}

// ValidarSenhaDoUsuario soma a regra do login: a senha nao pode conte-lo.
func ValidarSenhaDoUsuario(senha, username string) error {
	if err := ValidarSenha(senha); err != nil {
		return err
	}
	if login := strings.ToLower(strings.TrimSpace(username)); len(login) >= 3 && strings.Contains(strings.ToLower(senha), login) {
		return ErrSenhaFraca
	}
	return nil
}

// hashFicticio e comparado quando o login nao existe, para o tempo de
// resposta nao revelar quais logins existem (sem ele, usuario inexistente
// responde em 1 ms e o existente em ~250 ms).
var hashFicticio, _ = bcrypt.GenerateFromPassword([]byte("senha-ficticia-que-nunca-confere"), custoBcrypt)

// ConferirSenhaFicticia gasta o mesmo tempo de uma conferencia real.
func ConferirSenhaFicticia(senha string) {
	_ = bcrypt.CompareHashAndPassword(hashFicticio, []byte(senha))
}

// Bloqueado diz se a conta esta em bloqueio temporario por falhas seguidas.
func (u *Usuario) Bloqueado(agora time.Time) bool {
	return u.BloqueadoAte != nil && agora.Before(*u.BloqueadoAte)
}

// GerarHashSenha aplica a politica de senha e devolve o hash bcrypt.
func GerarHashSenha(senha string) (string, error) {
	if err := ValidarSenha(senha); err != nil {
		return "", err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(senha), custoBcrypt)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// SenhaConfere compara a senha informada com o hash armazenado.
func (u *Usuario) SenhaConfere(senha string) bool {
	if u.SenhaHash == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(u.SenhaHash), []byte(senha)) == nil
}
