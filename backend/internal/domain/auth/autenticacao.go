package auth

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
)

// ResultadoLogin e o contrato de resposta de POST /auth/login
// (docs/3_ESPECIFICACAO_APIS.md).
type ResultadoLogin struct {
	AccessToken string           `json:"access_token"`
	TipoToken   string           `json:"token_type"`
	ExpiraEm    int              `json:"expires_in"`
	Usuario     *usuario.Usuario `json:"usuario"`
}

// ServicoAutenticacao concentra o caso de uso de login.
type ServicoAutenticacao struct {
	repo   usuario.Repositorio
	tokens *ServicoToken
}

// NovoServicoAutenticacao monta o caso de uso.
func NovoServicoAutenticacao(repo usuario.Repositorio, tokens *ServicoToken) *ServicoAutenticacao {
	return &ServicoAutenticacao{repo: repo, tokens: tokens}
}

// Autenticar valida as credenciais e emite o token da sessao.
func (s *ServicoAutenticacao) Autenticar(ctx context.Context, username, senha string) (*ResultadoLogin, error) {
	username = strings.TrimSpace(username)
	if username == "" || senha == "" {
		return nil, usuario.ErrCredenciaisInvalidas
	}

	u, err := s.repo.BuscarPorUsername(ctx, username)
	if err != nil {
		if errors.Is(err, usuario.ErrNaoEncontrado) {
			// Mesmo erro da senha errada, para nao permitir enumerar usuarios.
			return nil, usuario.ErrCredenciaisInvalidas
		}
		return nil, err
	}

	if !u.SenhaConfere(senha) {
		return nil, usuario.ErrCredenciaisInvalidas
	}
	if !u.Ativo {
		return nil, usuario.ErrUsuarioInativo
	}

	token, expiraEm, err := s.tokens.Gerar(u)
	if err != nil {
		return nil, err
	}

	// O login ja foi concedido; falhar ao carimbar o ultimo acesso e um
	// problema de auditoria, nao motivo para negar a sessao.
	if err := s.repo.RegistrarLogin(ctx, u.ID); err != nil {
		slog.Warn("nao foi possivel registrar o ultimo login", "usuario_id", u.ID, "erro", err)
	}

	u.SenhaHash = ""
	return &ResultadoLogin{
		AccessToken: token,
		TipoToken:   "Bearer",
		ExpiraEm:    expiraEm,
		Usuario:     u,
	}, nil
}
