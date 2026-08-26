// Package auth emite e valida os tokens JWT usados na autenticacao.
// Ref: docs/3_ESPECIFICACAO_APIS.md (Autenticacao).
package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
)

var (
	// ErrTokenInvalido cobre assinatura errada, formato quebrado e algoritmo
	// nao suportado.
	ErrTokenInvalido = errors.New("token invalido")
	// ErrTokenExpirado indica sessao vencida.
	ErrTokenExpirado = errors.New("token expirado")
)

const emissor = "pcp-lev"

// Claims sao os dados que viajam dentro do token.
type Claims struct {
	UsuarioID int64          `json:"usuario_id"`
	Username  string         `json:"username"`
	Nome      string         `json:"nome"`
	Perfil    usuario.Perfil `json:"perfil"`
	jwt.RegisteredClaims
}

// ServicoToken emite e valida tokens com um segredo e uma duracao fixos.
type ServicoToken struct {
	segredo []byte
	duracao time.Duration
}

// NovoServicoToken cria o servico. A duracao pode ser negativa em testes para
// simular um token ja vencido.
func NovoServicoToken(segredo string, duracao time.Duration) *ServicoToken {
	return &ServicoToken{segredo: []byte(segredo), duracao: duracao}
}

// Gerar emite o token do usuario e devolve tambem o expires_in em segundos,
// no formato esperado pelo contrato de /auth/login.
func (s *ServicoToken) Gerar(u *usuario.Usuario) (string, int, error) {
	agora := time.Now()
	claims := Claims{
		UsuarioID: u.ID,
		Username:  u.Username,
		Nome:      u.Nome,
		Perfil:    u.Perfil,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    emissor,
			Subject:   fmt.Sprintf("%d", u.ID),
			IssuedAt:  jwt.NewNumericDate(agora),
			NotBefore: jwt.NewNumericDate(agora),
			ExpiresAt: jwt.NewNumericDate(agora.Add(s.duracao)),
		},
	}

	assinado, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.segredo)
	if err != nil {
		return "", 0, fmt.Errorf("assinar token: %w", err)
	}
	return assinado, int(s.duracao.Seconds()), nil
}

// Validar confere assinatura, validade e algoritmo do token.
func (s *ServicoToken) Validar(token string) (*Claims, error) {
	claims := &Claims{}

	_, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		// Sem esta checagem, um token com "alg: none" ou assinado com chave
		// publica RSA seria aceito (confusao de algoritmo).
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("algoritmo de assinatura inesperado: %v", t.Header["alg"])
		}
		return s.segredo, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithIssuer(emissor))

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrTokenExpirado
		}
		return nil, fmt.Errorf("%w: %v", ErrTokenInvalido, err)
	}
	return claims, nil
}
