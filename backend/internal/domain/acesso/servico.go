package acesso

import (
	"context"
	"strings"
	"sync"
	"time"
)

// Repositorio e a porta de persistencia de perfis e permissoes.
type Repositorio interface {
	ListarPermissoes(ctx context.Context) ([]Permissao, error)
	ListarPerfis(ctx context.Context) ([]Perfil, error)
	BuscarPerfil(ctx context.Context, codigo string) (Perfil, error)
	CriarPerfil(ctx context.Context, codigo string, d Dados, autor string) (Perfil, error)
	AtualizarPerfil(ctx context.Context, codigo string, d Dados, autor string) (Perfil, error)
	ExcluirPerfil(ctx context.Context, codigo string) error
	PermissoesDoPerfil(ctx context.Context, codigo string) ([]string, error)
	DadosDeAcesso(ctx context.Context, usuarioID int64) (DadosDeAcesso, error)
}

// Servico reune os casos de uso de perfis e a resolucao de permissoes. A
// matriz de cada perfil fica em cache na memoria: toda requisicao autorizada
// consulta as permissoes, e elas so mudam quando o Administrador edita um
// perfil -- por este mesmo servico, que entao limpa o cache.
type Servico struct {
	repo Repositorio

	mu       sync.RWMutex
	cache    map[string]entradaCache
	usuarios map[int64]entradaUsuario
	// geracao muda a cada invalidacao: uma leitura do banco que comecou
	// ANTES de uma edicao nao pode gravar o conjunto velho depois dela (a
	// permissao revogada voltaria a valer ate a proxima edicao).
	geracao uint64
	agora   func() time.Time
}

type entradaCache struct {
	permissoes map[string]bool
	ate        time.Time
}

type entradaUsuario struct {
	acesso Acesso
	ate    time.Time
}

// validadeCache e a rede de seguranca para mudancas que nao passam por este
// processo (outra replica da API, SQL direto): no maximo este atraso.
const validadeCache = time.Minute

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo, cache: map[string]entradaCache{}, usuarios: map[int64]entradaUsuario{}, agora: time.Now}
}

// PermissoesDoPerfil devolve o conjunto de permissoes do perfil. ADMIN tem o
// catalogo inteiro; perfil inexistente (ex.: excluido depois do login) nao
// tem nenhuma.
func (s *Servico) PermissoesDoPerfil(ctx context.Context, codigo string) (map[string]bool, error) {
	if codigo == PerfilAdmin {
		todas := make(map[string]bool, len(Catalogo))
		for _, p := range Catalogo {
			todas[p] = true
		}
		return todas, nil
	}

	s.mu.RLock()
	entrada, ok := s.cache[codigo]
	geracao := s.geracao
	s.mu.RUnlock()
	if ok && s.agora().Before(entrada.ate) {
		return entrada.permissoes, nil
	}

	lista, err := s.repo.PermissoesDoPerfil(ctx, codigo)
	if err != nil {
		return nil, err
	}
	conjunto := make(map[string]bool, len(lista))
	for _, p := range lista {
		conjunto[p] = true
	}
	s.mu.Lock()
	if s.geracao == geracao {
		s.cache[codigo] = entradaCache{permissoes: conjunto, ate: s.agora().Add(validadeCache)}
	}
	s.mu.Unlock()
	return conjunto, nil
}

// ListaDePermissoes devolve as permissoes do perfil em ordem de catalogo
// (para o login e /auth/eu).
func (s *Servico) ListaDePermissoes(ctx context.Context, codigo string) ([]string, error) {
	conjunto, err := s.PermissoesDoPerfil(ctx, codigo)
	if err != nil {
		return nil, err
	}
	lista := make([]string, 0, len(conjunto))
	for _, p := range Catalogo {
		if conjunto[p] {
			lista = append(lista, p)
		}
	}
	return lista, nil
}

// NomeDoPerfil devolve o nome de exibicao do perfil, ou o proprio codigo se
// ele nao puder ser lido -- o cabecalho da tela nao pode quebrar o login.
func (s *Servico) NomeDoPerfil(ctx context.Context, codigo string) string {
	p, err := s.repo.BuscarPerfil(ctx, codigo)
	if err != nil {
		return codigo
	}
	return p.Nome
}

// Invalidar descarta todo o cache -- chamado por quem altera usuario
// (perfil, situacao, senha, permissoes individuais), alem das edicoes de
// perfil feitas por este servico.
func (s *Servico) Invalidar() { s.invalidar() }

// AcessoDoUsuario resolve o que o usuario pode fazer agora: permissoes do
// perfil ATUAL dele (nao do token), mais as concedidas individualmente, menos
// as retiradas. ADMIN tem tudo e ignora retiradas (ninguem tranca o sistema).
// Inativo, bloqueado ou com troca de senha pendente: nenhuma permissao.
func (s *Servico) AcessoDoUsuario(ctx context.Context, usuarioID int64) (Acesso, error) {
	s.mu.RLock()
	entrada, ok := s.usuarios[usuarioID]
	geracao := s.geracao
	s.mu.RUnlock()
	if ok && s.agora().Before(entrada.ate) {
		return entrada.acesso, nil
	}

	dados, err := s.repo.DadosDeAcesso(ctx, usuarioID)
	if err != nil {
		return Acesso{}, err
	}

	a := Acesso{
		UsuarioID:       usuarioID,
		Perfil:          dados.Perfil,
		Ativo:           dados.Situacao == "ATIVO",
		DeveTrocarSenha: dados.DeveTrocarSenha,
		VersaoSessao:    dados.VersaoSessao,
		Permissoes:      map[string]bool{},
	}
	if a.Ativo && !a.DeveTrocarSenha {
		if a.Permissoes, err = s.configuradas(ctx, dados); err != nil {
			return Acesso{}, err
		}
	}

	s.mu.Lock()
	if s.geracao == geracao {
		s.usuarios[usuarioID] = entradaUsuario{acesso: a, ate: s.agora().Add(validadeCache)}
	}
	s.mu.Unlock()
	return a, nil
}

// configuradas = perfil + concedidas - retiradas (ADMIN: tudo), sem olhar
// situacao nem troca de senha.
func (s *Servico) configuradas(ctx context.Context, dados DadosDeAcesso) (map[string]bool, error) {
	base, err := s.PermissoesDoPerfil(ctx, dados.Perfil)
	if err != nil {
		return nil, err
	}
	permissoes := make(map[string]bool, len(base))
	for p := range base {
		permissoes[p] = true
	}
	if dados.Perfil != PerfilAdmin {
		for _, p := range dados.Concedidas {
			permissoes[p] = true
		}
		for _, p := range dados.Retiradas {
			delete(permissoes, p)
		}
	}
	return permissoes, nil
}

// PermissoesConfiguradas devolve o que o usuario PODE quando ativo e com a
// senha em dia (gestao de usuarios: a tela de permissoes individuais e a
// regra "o editor precisa dominar o alvo"). Sem cache: caminho de escrita.
func (s *Servico) PermissoesConfiguradas(ctx context.Context, usuarioID int64) (map[string]bool, error) {
	dados, err := s.repo.DadosDeAcesso(ctx, usuarioID)
	if err != nil {
		return nil, err
	}
	return s.configuradas(ctx, dados)
}

// EmOrdemDeCatalogo lista o conjunto na ordem do catalogo.
func EmOrdemDeCatalogo(permissoes map[string]bool) []string {
	lista := make([]string, 0, len(permissoes))
	for _, p := range Catalogo {
		if permissoes[p] {
			lista = append(lista, p)
		}
	}
	return lista
}

// ListaDoUsuario devolve as permissoes efetivas em ordem de catalogo (login,
// /auth/eu) e o perfil atual.
func (s *Servico) ListaDoUsuario(ctx context.Context, usuarioID int64) ([]string, string, error) {
	a, err := s.AcessoDoUsuario(ctx, usuarioID)
	if err != nil {
		return nil, "", err
	}
	return EmOrdemDeCatalogo(a.Permissoes), a.Perfil, nil
}

func (s *Servico) invalidar() {
	s.mu.Lock()
	s.cache = map[string]entradaCache{}
	s.usuarios = map[int64]entradaUsuario{}
	s.geracao++
	s.mu.Unlock()
}

// Catalogo devolve o catalogo com descricoes, na ordem de exibicao.
func (s *Servico) Catalogo(ctx context.Context) ([]Permissao, error) {
	return s.repo.ListarPermissoes(ctx)
}

// ListarPerfis devolve todos os perfis. O ADMIN sai com o catalogo inteiro.
func (s *Servico) ListarPerfis(ctx context.Context) ([]Perfil, error) {
	perfis, err := s.repo.ListarPerfis(ctx)
	if err != nil {
		return nil, err
	}
	for i := range perfis {
		if perfis[i].Codigo == PerfilAdmin {
			perfis[i].Permissoes = append([]string(nil), Catalogo...)
		}
	}
	return perfis, nil
}

// BuscarPerfil devolve um perfil.
func (s *Servico) BuscarPerfil(ctx context.Context, codigo string) (Perfil, error) {
	p, err := s.repo.BuscarPerfil(ctx, codigo)
	if err == nil && p.Codigo == PerfilAdmin {
		p.Permissoes = append([]string(nil), Catalogo...)
	}
	return p, err
}

// conferirConcessao recusa conceder o que o editor nao tem. So as
// permissoes NOVAS contam: manter (ou retirar) uma que o perfil ja tinha e
// sempre permitido.
func conferirConcessao(editor Editor, atuais []string, novas []string) error {
	jaTinha := make(map[string]bool, len(atuais))
	for _, p := range atuais {
		jaTinha[p] = true
	}
	for _, p := range novas {
		if !jaTinha[p] && !editor.Permissoes[p] {
			return ErrConcederSemTer
		}
	}
	return nil
}

// CriarPerfil cria um perfil personalizado.
func (s *Servico) CriarPerfil(ctx context.Context, editor Editor, codigo string, d Dados, autor string) (Perfil, error) {
	codigo = strings.ToUpper(strings.TrimSpace(codigo))
	if err := ValidarCodigo(codigo); err != nil {
		return Perfil{}, err
	}
	d.Normalizar()
	if err := d.Validar(); err != nil {
		return Perfil{}, err
	}
	if err := conferirConcessao(editor, nil, d.Permissoes); err != nil {
		return Perfil{}, err
	}
	p, err := s.repo.CriarPerfil(ctx, codigo, d, autor)
	if err == nil {
		s.invalidar()
	}
	return p, err
}

// AtualizarPerfil troca nome, descricao e o conjunto inteiro de permissoes.
func (s *Servico) AtualizarPerfil(ctx context.Context, editor Editor, codigo string, d Dados, autor string) (Perfil, error) {
	if codigo == PerfilAdmin {
		return Perfil{}, ErrAdminImutavel
	}
	if codigo == editor.Perfil {
		return Perfil{}, ErrProprioPerfil
	}
	d.Normalizar()
	if err := d.Validar(); err != nil {
		return Perfil{}, err
	}
	atual, err := s.repo.BuscarPerfil(ctx, codigo)
	if err != nil {
		return Perfil{}, err
	}
	// Retirar tambem e poder: sem isto, quem tem configuracoes.perfis
	// esvaziaria um perfil mais poderoso que o seu (e travaria a operacao).
	for _, p := range atual.Permissoes {
		if !editor.Permissoes[p] {
			return Perfil{}, ErrPerfilAcimaDoEditor
		}
	}
	if err := conferirConcessao(editor, atual.Permissoes, d.Permissoes); err != nil {
		return Perfil{}, err
	}
	p, err := s.repo.AtualizarPerfil(ctx, codigo, d, autor)
	if err == nil {
		s.invalidar()
	}
	return p, err
}

// ExcluirPerfil remove um perfil personalizado sem usuarios.
func (s *Servico) ExcluirPerfil(ctx context.Context, codigo string) error {
	p, err := s.repo.BuscarPerfil(ctx, codigo)
	if err != nil {
		return err
	}
	if p.Sistema {
		return ErrPerfilDoSistema
	}
	if p.Usuarios > 0 {
		return ErrPerfilEmUso
	}
	if err := s.repo.ExcluirPerfil(ctx, codigo); err != nil {
		return err
	}
	s.invalidar()
	return nil
}
