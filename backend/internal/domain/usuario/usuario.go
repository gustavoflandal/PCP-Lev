// Package usuario contem a entidade de usuario e as regras de credencial.
// Ref: docs/1_ESPECIFICACAO_REQUISITOS.md (RNF3 - Seguranca).
package usuario

import (
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// tamanhoMinimoSenha vem do RNF3: senhas com no minimo 8 caracteres.
const tamanhoMinimoSenha = 8

// custoBcrypt acima do padrao (10) para encarecer ataques de dicionario.
const custoBcrypt = 12

var (
	// ErrSenhaFraca indica senha abaixo da politica minima.
	ErrSenhaFraca = errors.New("a senha deve ter no minimo 8 caracteres")
	// ErrCredenciaisInvalidas cobre usuario inexistente e senha errada.
	// A mensagem e deliberadamente generica: distinguir os dois casos
	// permitiria enumerar usuarios validos.
	ErrCredenciaisInvalidas = errors.New("usuario ou senha invalidos")
	// ErrUsuarioInativo indica conta desativada.
	ErrUsuarioInativo = errors.New("usuario inativo")
	// ErrNaoEncontrado indica usuario ausente no repositorio.
	ErrNaoEncontrado = errors.New("usuario nao encontrado")
)

// Perfil define o nivel de acesso (RNF3).
type Perfil string

const (
	PerfilAdmin    Perfil = "ADMIN"
	PerfilGestor   Perfil = "GESTOR"
	PerfilOperador Perfil = "OPERADOR"
)

// Valido informa se o perfil e um dos previstos no RNF3.
func (p Perfil) Valido() bool {
	switch p {
	case PerfilAdmin, PerfilGestor, PerfilOperador:
		return true
	default:
		return false
	}
}

// PodeGerenciarCadastros libera escrita nos cadastros base e nos modulos de
// compras, vendas e producao. O operador de chao de fabrica so movimenta o
// Kanban e registra apontamentos.
func (p Perfil) PodeGerenciarCadastros() bool {
	return p == PerfilAdmin || p == PerfilGestor
}

// Usuario e a entidade de acesso ao sistema.
type Usuario struct {
	ID          int64      `json:"id"`
	Username    string     `json:"username"`
	Nome        string     `json:"nome"`
	Email       string     `json:"email"`
	SenhaHash   string     `json:"-"`
	Perfil      Perfil     `json:"perfil"`
	Ativo       bool       `json:"ativo"`
	UltimoLogin *time.Time `json:"ultimo_login,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// GerarHashSenha aplica a politica de senha e devolve o hash bcrypt.
func GerarHashSenha(senha string) (string, error) {
	if len(senha) < tamanhoMinimoSenha {
		return "", ErrSenhaFraca
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
