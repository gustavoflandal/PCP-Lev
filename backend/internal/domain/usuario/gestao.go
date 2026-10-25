package usuario

import (
	"context"
	"errors"
	"net/mail"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

// Gestao de usuarios pelo Administrador (Fase 2.2b, doc 0 secao 4.7.3).
// Spec: docs/superpowers/specs/2026-10-24-usuarios-design.md. As regras desta
// parte existem para que configuracoes.usuarios NAO seja um atalho para virar
// ADMIN: ninguem altera a si mesmo, ninguem atribui perfil ou concede
// permissao que nao tem, e so um ADMIN mexe em outro ADMIN.

var (
	ErrUsernameInvalido      = errors.New("o usuario (login) deve ter de 3 a 50 caracteres: letras minusculas, numeros, ponto, hifen ou sublinhado")
	ErrNomeObrigatorio       = errors.New("informe o nome (ate 100 caracteres)")
	ErrEmailInvalido         = errors.New("informe um e-mail valido (ate 100 caracteres)")
	ErrCampoLongo            = errors.New("matricula e telefone vao ate 30 caracteres; setor, ate 60")
	ErrPerfilObrigatorio     = errors.New("informe o perfil")
	ErrPerfilInexistente     = errors.New("o perfil informado nao existe")
	ErrDuplicado             = errors.New("ja existe um usuario com este login, e-mail ou matricula")
	ErrSituacaoInvalida      = errors.New("situacao invalida")
	ErrAlterarASiMesmo       = errors.New("ninguem altera o proprio cadastro, perfil, situacao ou permissoes por aqui -- peca a outro administrador")
	ErrAtribuirPerfilSemTer  = errors.New("so e possivel atribuir um perfil cujas permissoes o seu proprio perfil tem")
	ErrSoAdminAlteraAdmin    = errors.New("so um Administrador altera um usuario Administrador")
	ErrUltimoAdmin           = errors.New("este e o ultimo Administrador ativo -- ative ou crie outro antes")
	ErrJustificativaCurta    = errors.New("a justificativa deve ter ao menos 10 caracteres (ate 255)")
	ErrAdminSemIndividuais   = errors.New("o Administrador tem todas as permissoes -- permissoes individuais nao se aplicam")
	ErrPermissaoForaCatalogo = errors.New("permissao fora do catalogo")
	ErrConcederSemTer        = errors.New("so e possivel conceder permissoes que o seu proprio perfil tem")
	ErrIndividualInexistente = errors.New("este usuario nao tem esta permissao individual")
	ErrAlvoComMaisPermissoes = errors.New("este usuario tem permissoes que voce nao tem -- peca a quem as tenha (ou a um Administrador)")
	ErrAlteradoPorOutro      = errors.New("o usuario foi alterado por outra pessoa enquanto voce editava -- recarregue e tente de novo")
)

var padraoUsername = regexp.MustCompile(`^[a-z0-9._-]{3,50}$`)

// SituacoesValidas e o conjunto fechado (mesmo CHECK da migration 015).
var SituacoesValidas = []string{string(SituacaoAtivo), string(SituacaoInativo), string(SituacaoBloqueado)}

// ColunasOrdenaveis restringe o ordenar_por da listagem.
var ColunasOrdenaveis = []string{"nome", "username", "perfil", "situacao", "ultimo_login", "created_at"}

// Dados sao os campos do cadastro. Username so vale na criacao (imutavel).
type Dados struct {
	Username     string
	Nome         string
	Email        string
	Matricula    *string
	Telefone     string
	Setor        string
	Perfil       Perfil
	DataAdmissao tempo.Data
}

// Normalizar limpa espacos; login e e-mail em minusculas; matricula vazia vira nula.
func (d *Dados) Normalizar() {
	d.Username = strings.ToLower(strings.TrimSpace(d.Username))
	d.Nome = strings.TrimSpace(d.Nome)
	d.Email = strings.ToLower(strings.TrimSpace(d.Email))
	d.Telefone = strings.TrimSpace(d.Telefone)
	d.Setor = strings.TrimSpace(d.Setor)
	d.Perfil = Perfil(strings.TrimSpace(string(d.Perfil)))
	if d.Matricula != nil {
		m := strings.TrimSpace(*d.Matricula)
		if m == "" {
			d.Matricula = nil
		} else {
			d.Matricula = &m
		}
	}
}

// Validar confere forma. checarUsername e falso na edicao (login imutavel).
func (d Dados) Validar(checarUsername bool) error {
	if checarUsername && !padraoUsername.MatchString(d.Username) {
		return ErrUsernameInvalido
	}
	if d.Nome == "" || utf8.RuneCountInString(d.Nome) > 100 {
		return ErrNomeObrigatorio
	}
	if utf8.RuneCountInString(d.Email) > 100 {
		return ErrEmailInvalido
	}
	if analisado, err := mail.ParseAddress(d.Email); err != nil || analisado.Address != d.Email {
		return ErrEmailInvalido
	}
	if (d.Matricula != nil && utf8.RuneCountInString(*d.Matricula) > 30) ||
		utf8.RuneCountInString(d.Telefone) > 30 || utf8.RuneCountInString(d.Setor) > 60 {
		return ErrCampoLongo
	}
	if d.Perfil == "" {
		return ErrPerfilObrigatorio
	}
	return nil
}

// PermissaoIndividual sobrepoe o perfil para um usuario.
type PermissaoIndividual struct {
	Codigo        string    `json:"codigo"`
	Concedida     bool      `json:"concedida"`
	Justificativa string    `json:"justificativa"`
	CreatedAt     time.Time `json:"created_at"`
	CreatedBy     *string   `json:"created_by,omitempty"`
}

// Estado e o que a escrita confere antes de gravar (checagem otimista): se
// perfil ou situacao mudaram desde a leitura, a escrita e recusada com
// ErrAlteradoPorOutro -- as regras foram avaliadas sobre o estado lido.
type Estado struct {
	Perfil   Perfil
	Situacao Situacao
}

// RepositorioGestao e a porta de persistencia da gestao de usuarios. As
// escritas que podem tirar o ultimo ADMIN ativo do ar recusam com
// ErrUltimoAdmin de forma atomica (a conferencia do servico e so a mensagem
// rapida; o repositorio fecha a corrida).
type RepositorioGestao interface {
	BuscarPorID(ctx context.Context, id int64) (*Usuario, error)
	Listar(ctx context.Context, params consulta.Parametros, perfil string) ([]Usuario, int, error)
	Criar(ctx context.Context, d Dados, senhaHash, autor string) (*Usuario, error)
	AtualizarCadastro(ctx context.Context, id int64, esperado Estado, d Dados, autor string) (*Usuario, error)
	AlterarSituacao(ctx context.Context, id int64, esperado Estado, situacao Situacao, desligamento tempo.Data, autor string) (*Usuario, error)
	DefinirSenhaTemporaria(ctx context.Context, id int64, esperado Estado, senhaHash, autor string) error
	ContarAdminsAtivos(ctx context.Context, exceto int64) (int, error)
	PermissoesIndividuais(ctx context.Context, id int64) ([]PermissaoIndividual, error)
	DefinirPermissaoIndividual(ctx context.Context, id int64, codigo string, concedida bool, justificativa, autor string) error
	RemoverPermissaoIndividual(ctx context.Context, id int64, codigo string) error
}

// Acessos e o que a gestao usa do RBAC (acesso.Servico).
type Acessos interface {
	PermissoesDoPerfil(ctx context.Context, perfil string) (map[string]bool, error)
	PermissoesConfiguradas(ctx context.Context, usuarioID int64) (map[string]bool, error)
	Invalidar()
}

// ServicoGestao reune os casos de uso da tela de usuarios.
type ServicoGestao struct {
	repo    RepositorioGestao
	acessos Acessos
}

// NovoServicoGestao monta o servico.
func NovoServicoGestao(repo RepositorioGestao, acessos Acessos) *ServicoGestao {
	return &ServicoGestao{repo: repo, acessos: acessos}
}

// Listar devolve uma pagina de usuarios (sem hash de senha: SenhaHash tem json:"-").
func (s *ServicoGestao) Listar(ctx context.Context, params consulta.Parametros, perfil string) ([]Usuario, int, error) {
	return s.repo.Listar(ctx, params, perfil)
}

// BuscarPorID devolve um usuario.
func (s *ServicoGestao) BuscarPorID(ctx context.Context, id int64) (*Usuario, error) {
	return s.repo.BuscarPorID(ctx, id)
}

// conferirPerfil: o editor so atribui um perfil cujas permissoes ele tem; o
// ADMIN, so outro ADMIN.
func (s *ServicoGestao) conferirPerfil(ctx context.Context, editor acesso.Acesso, perfil Perfil) error {
	if string(perfil) == acesso.PerfilAdmin {
		if editor.Perfil != acesso.PerfilAdmin {
			return ErrAtribuirPerfilSemTer
		}
		return nil
	}
	permissoes, err := s.acessos.PermissoesDoPerfil(ctx, string(perfil))
	if err != nil {
		return err
	}
	for p := range permissoes {
		if !editor.Permissoes[p] {
			return ErrAtribuirPerfilSemTer
		}
	}
	return nil
}

// alvo carrega o usuario a alterar e aplica as regras comuns: nao a si
// mesmo, ADMIN so por ADMIN e -- a regra que fecha a tomada de conta -- o
// editor precisa ter todas as permissoes que o alvo tem (configuradas, mesmo
// que ele esteja inativo agora). Sem isso, quem tem configuracoes.usuarios
// redefiniria a senha de alguem com mais poderes e entraria como ele.
func (s *ServicoGestao) alvo(ctx context.Context, editor acesso.Acesso, id int64) (*Usuario, error) {
	if id == editor.UsuarioID {
		return nil, ErrAlterarASiMesmo
	}
	u, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if string(u.Perfil) == acesso.PerfilAdmin && editor.Perfil != acesso.PerfilAdmin {
		return nil, ErrSoAdminAlteraAdmin
	}
	if editor.Perfil != acesso.PerfilAdmin {
		doAlvo, err := s.acessos.PermissoesConfiguradas(ctx, id)
		if err != nil {
			return nil, err
		}
		for p := range doAlvo {
			if !editor.Permissoes[p] {
				return nil, ErrAlvoComMaisPermissoes
			}
		}
	}
	return u, nil
}

func estadoDe(u *Usuario) Estado { return Estado{Perfil: u.Perfil, Situacao: u.Situacao} }

// Criar cadastra um usuario com senha temporaria (troca obrigatoria no
// primeiro acesso).
func (s *ServicoGestao) Criar(ctx context.Context, editor acesso.Acesso, d Dados, senhaTemporaria, autor string) (*Usuario, error) {
	d.Normalizar()
	if err := d.Validar(true); err != nil {
		return nil, err
	}
	if err := s.conferirPerfil(ctx, editor, d.Perfil); err != nil {
		return nil, err
	}
	if err := ValidarSenhaDoUsuario(senhaTemporaria, d.Username); err != nil {
		return nil, err
	}
	hash, err := GerarHashSenha(senhaTemporaria)
	if err != nil {
		return nil, err
	}
	return s.repo.Criar(ctx, d, hash, autor)
}

// Atualizar altera o cadastro (login nao muda).
func (s *ServicoGestao) Atualizar(ctx context.Context, editor acesso.Acesso, id int64, d Dados, autor string) (*Usuario, error) {
	atual, err := s.alvo(ctx, editor, id)
	if err != nil {
		return nil, err
	}
	d.Normalizar()
	if err := d.Validar(false); err != nil {
		return nil, err
	}
	if d.Perfil != atual.Perfil {
		if err := s.conferirPerfil(ctx, editor, d.Perfil); err != nil {
			return nil, err
		}
		if err := s.conferirUltimoAdmin(ctx, atual); err != nil {
			return nil, err
		}
	}
	u, err := s.repo.AtualizarCadastro(ctx, id, estadoDe(atual), d, autor)
	if err == nil {
		s.acessos.Invalidar()
	}
	return u, err
}

// conferirUltimoAdmin impede que o sistema fique sem Administrador ativo.
func (s *ServicoGestao) conferirUltimoAdmin(ctx context.Context, atual *Usuario) error {
	if string(atual.Perfil) != acesso.PerfilAdmin || atual.Situacao != SituacaoAtivo {
		return nil
	}
	outros, err := s.repo.ContarAdminsAtivos(ctx, atual.ID)
	if err != nil {
		return err
	}
	if outros == 0 {
		return ErrUltimoAdmin
	}
	return nil
}

// AlterarSituacao ativa, inativa ou bloqueia. Ao inativar sem data, o
// desligamento fica em branco (bloqueio nao e desligamento).
func (s *ServicoGestao) AlterarSituacao(ctx context.Context, editor acesso.Acesso, id int64, situacao Situacao, desligamento tempo.Data, autor string) (*Usuario, error) {
	if !slices.Contains(SituacoesValidas, string(situacao)) {
		return nil, ErrSituacaoInvalida
	}
	atual, err := s.alvo(ctx, editor, id)
	if err != nil {
		return nil, err
	}
	if situacao != SituacaoAtivo {
		if err := s.conferirUltimoAdmin(ctx, atual); err != nil {
			return nil, err
		}
	}
	u, err := s.repo.AlterarSituacao(ctx, id, estadoDe(atual), situacao, desligamento, autor)
	if err == nil {
		s.acessos.Invalidar()
	}
	return u, err
}

// RedefinirSenha define uma senha temporaria; o usuario troca no proximo acesso.
func (s *ServicoGestao) RedefinirSenha(ctx context.Context, editor acesso.Acesso, id int64, senhaTemporaria, autor string) error {
	atual, err := s.alvo(ctx, editor, id)
	if err != nil {
		return err
	}
	if err := ValidarSenhaDoUsuario(senhaTemporaria, atual.Username); err != nil {
		return err
	}
	hash, err := GerarHashSenha(senhaTemporaria)
	if err != nil {
		return err
	}
	if err := s.repo.DefinirSenhaTemporaria(ctx, id, estadoDe(atual), hash, autor); err != nil {
		return err
	}
	s.acessos.Invalidar()
	return nil
}

// PermissoesDoUsuario devolve as individuais e as configuradas (o que vale
// quando o usuario esta ativo e com a senha em dia -- um recem-criado ainda
// sem acesso tambem precisa mostrar "do perfil").
func (s *ServicoGestao) PermissoesDoUsuario(ctx context.Context, id int64) ([]PermissaoIndividual, []string, error) {
	individuais, err := s.repo.PermissoesIndividuais(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	configuradas, err := s.acessos.PermissoesConfiguradas(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	return individuais, acesso.EmOrdemDeCatalogo(configuradas), nil
}

// DefinirPermissao concede (ou retira) uma permissao individual.
func (s *ServicoGestao) DefinirPermissao(ctx context.Context, editor acesso.Acesso, id int64, codigo string, concedida bool, justificativa, autor string) error {
	u, err := s.alvo(ctx, editor, id)
	if err != nil {
		return err
	}
	if string(u.Perfil) == acesso.PerfilAdmin {
		return ErrAdminSemIndividuais
	}
	if !slices.Contains(acesso.Catalogo, codigo) {
		return ErrPermissaoForaCatalogo
	}
	justificativa = strings.TrimSpace(justificativa)
	if utf8.RuneCountInString(justificativa) < 10 || utf8.RuneCountInString(justificativa) > 255 {
		return ErrJustificativaCurta
	}
	if concedida && !editor.Permissoes[codigo] {
		return ErrConcederSemTer
	}
	if err := s.repo.DefinirPermissaoIndividual(ctx, id, codigo, concedida, justificativa, autor); err != nil {
		return err
	}
	s.acessos.Invalidar()
	return nil
}

// RemoverPermissao desfaz uma permissao individual. Desfazer uma RETIRADA
// devolve a permissao do perfil -- equivale a conceder, entao o editor
// precisa te-la.
func (s *ServicoGestao) RemoverPermissao(ctx context.Context, editor acesso.Acesso, id int64, codigo string) error {
	if _, err := s.alvo(ctx, editor, id); err != nil {
		return err
	}
	individuais, err := s.repo.PermissoesIndividuais(ctx, id)
	if err != nil {
		return err
	}
	i := slices.IndexFunc(individuais, func(p PermissaoIndividual) bool { return p.Codigo == codigo })
	if i < 0 {
		return ErrIndividualInexistente
	}
	if !individuais[i].Concedida && !editor.Permissoes[codigo] {
		return ErrConcederSemTer
	}
	if err := s.repo.RemoverPermissaoIndividual(ctx, id, codigo); err != nil {
		return err
	}
	s.acessos.Invalidar()
	return nil
}
