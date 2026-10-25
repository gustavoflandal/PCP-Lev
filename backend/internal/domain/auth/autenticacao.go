package auth

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
)

// ErrSenhaRepetida impede trocar a senha por ela mesma: a troca costuma ser
// pedida justamente porque a senha atual foi exposta.
var ErrSenhaRepetida = errors.New("a nova senha deve ser diferente da atual")

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
			// Mesmo erro e mesmo tempo da senha errada, para nao permitir
			// enumerar usuarios.
			usuario.ConferirSenhaFicticia(senha)
			return nil, usuario.ErrCredenciaisInvalidas
		}
		return nil, err
	}
	if u.Bloqueado(time.Now()) {
		return nil, usuario.ErrMuitasTentativas
	}

	if !u.SenhaConfere(senha) {
		s.registrarFalha(ctx, u.ID)
		return nil, usuario.ErrCredenciaisInvalidas
	}
	if err := situacaoDeAcesso(u); err != nil {
		return nil, err
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

// registrarFalha conta a senha errada; falhar ao gravar nao muda a resposta
// (o limite por IP continua valendo).
func (s *ServicoAutenticacao) registrarFalha(ctx context.Context, id int64) {
	if err := s.repo.RegistrarFalha(ctx, id); err != nil {
		slog.Warn("nao foi possivel registrar a falha de senha", "usuario_id", id, "erro", err)
	}
}

// situacaoDeAcesso recusa usuario bloqueado ou inativo, cada um com o seu erro.
func situacaoDeAcesso(u *usuario.Usuario) error {
	switch {
	case u.Situacao == usuario.SituacaoBloqueado:
		return usuario.ErrUsuarioBloqueado
	case u.Situacao == usuario.SituacaoInativo, !u.Ativo:
		return usuario.ErrUsuarioInativo
	}
	return nil
}

// TrocarSenha altera a senha do usuario da sessao e devolve um token novo:
// a troca sobe a versao da sessao, o que derruba os tokens antigos -- inclusive
// um roubado -- e o de quem trocou junto.
//
// Exigir a senha atual protege contra troca por terceiro que tenha apenas o
// token — sessao aberta em maquina compartilhada do chao de fabrica. A senha
// atual errada conta para o bloqueio da conta (senao a rota seria um oraculo
// de senha sem limite para quem tem so o token).
func (s *ServicoAutenticacao) TrocarSenha(ctx context.Context, usuarioID int64, senhaAtual, novaSenha string) (*ResultadoLogin, error) {
	u, err := s.repo.BuscarPorID(ctx, usuarioID)
	if err != nil {
		return nil, err
	}
	// Token de antes do bloqueio/inativacao nao serve para trocar a senha.
	if err := situacaoDeAcesso(u); err != nil {
		return nil, err
	}
	if u.Bloqueado(time.Now()) {
		return nil, usuario.ErrMuitasTentativas
	}
	if !u.SenhaConfere(senhaAtual) {
		s.registrarFalha(ctx, u.ID)
		return nil, usuario.ErrCredenciaisInvalidas
	}
	if senhaAtual == novaSenha {
		return nil, ErrSenhaRepetida
	}
	if err := usuario.ValidarSenhaDoUsuario(novaSenha, u.Username); err != nil {
		return nil, err
	}

	hash, err := usuario.GerarHashSenha(novaSenha)
	if err != nil {
		return nil, err
	}
	if err := s.repo.AtualizarSenha(ctx, usuarioID, hash, u.Username); err != nil {
		return nil, err
	}
	atualizado, err := s.repo.BuscarPorID(ctx, usuarioID)
	if err != nil {
		return nil, err
	}
	token, expiraEm, err := s.tokens.Gerar(atualizado)
	if err != nil {
		return nil, err
	}
	atualizado.SenhaHash = ""
	return &ResultadoLogin{AccessToken: token, TipoToken: "Bearer", ExpiraEm: expiraEm, Usuario: atualizado}, nil
}

// BuscarUsuarioAtual devolve os dados de sessao atualizados do usuario --
// usado por GET /auth/eu, que precisa refletir mudancas (como preferencias)
// sem exigir um novo login.
func (s *ServicoAutenticacao) BuscarUsuarioAtual(ctx context.Context, usuarioID int64) (*usuario.Usuario, error) {
	u, err := s.repo.BuscarPorID(ctx, usuarioID)
	if err != nil {
		return nil, err
	}
	u.SenhaHash = ""
	return u, nil
}

// AtualizarPreferencias grava as preferencias de aparencia do usuario da
// sessao e devolve os dados atualizados.
func (s *ServicoAutenticacao) AtualizarPreferencias(ctx context.Context, usuarioID int64, p usuario.Preferencias) (*usuario.Usuario, error) {
	if err := p.Validar(); err != nil {
		return nil, err
	}
	if err := s.repo.AtualizarPreferencias(ctx, usuarioID, p); err != nil {
		return nil, err
	}
	return s.BuscarUsuarioAtual(ctx, usuarioID)
}
