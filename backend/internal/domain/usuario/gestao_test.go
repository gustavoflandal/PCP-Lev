package usuario_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// repoGestaoFalso guarda usuarios em memoria.
type repoGestaoFalso struct {
	usuarios    map[int64]*usuario.Usuario
	individuais map[int64][]usuario.PermissaoIndividual
	criados     int
}

func novoRepoGestao(us ...usuario.Usuario) *repoGestaoFalso {
	r := &repoGestaoFalso{usuarios: map[int64]*usuario.Usuario{}, individuais: map[int64][]usuario.PermissaoIndividual{}}
	for i := range us {
		r.usuarios[us[i].ID] = &us[i]
	}
	return r
}

func (r *repoGestaoFalso) BuscarPorID(_ context.Context, id int64) (*usuario.Usuario, error) {
	u, ok := r.usuarios[id]
	if !ok {
		return nil, usuario.ErrNaoEncontrado
	}
	copia := *u
	return &copia, nil
}
func (r *repoGestaoFalso) Listar(context.Context, consulta.Parametros, string) ([]usuario.Usuario, int, error) {
	return nil, 0, nil
}
func (r *repoGestaoFalso) Criar(_ context.Context, d usuario.Dados, hash, _ string) (*usuario.Usuario, error) {
	r.criados++
	u := &usuario.Usuario{ID: 100, Username: d.Username, Perfil: d.Perfil, SenhaHash: hash, DeveTrocarSenha: true}
	return u, nil
}
func (r *repoGestaoFalso) AtualizarCadastro(_ context.Context, id int64, _ usuario.Estado, d usuario.Dados, _ string) (*usuario.Usuario, error) {
	r.usuarios[id].Perfil = d.Perfil
	return r.usuarios[id], nil
}
func (r *repoGestaoFalso) AlterarSituacao(_ context.Context, id int64, _ usuario.Estado, s usuario.Situacao, _ tempo.Data, _ string) (*usuario.Usuario, error) {
	r.usuarios[id].Situacao = s
	return r.usuarios[id], nil
}
func (r *repoGestaoFalso) DefinirSenhaTemporaria(context.Context, int64, usuario.Estado, string, string) error {
	return nil
}
func (r *repoGestaoFalso) ContarAdminsAtivos(_ context.Context, exceto int64) (int, error) {
	n := 0
	for id, u := range r.usuarios {
		if id != exceto && u.Perfil == usuario.PerfilAdmin && u.Situacao == usuario.SituacaoAtivo {
			n++
		}
	}
	return n, nil
}
func (r *repoGestaoFalso) PermissoesIndividuais(_ context.Context, id int64) ([]usuario.PermissaoIndividual, error) {
	return r.individuais[id], nil
}
func (r *repoGestaoFalso) DefinirPermissaoIndividual(_ context.Context, id int64, codigo string, concedida bool, j, _ string) error {
	r.individuais[id] = append(r.individuais[id], usuario.PermissaoIndividual{Codigo: codigo, Concedida: concedida, Justificativa: j})
	return nil
}
func (r *repoGestaoFalso) RemoverPermissaoIndividual(context.Context, int64, string) error {
	return nil
}

// acessosFalsos: GESTOR tem fornecedores.incluir; COMPRADOR, pedidos_compra.emitir.
type acessosFalsos struct {
	invalidacoes int
	repo         *repoGestaoFalso
}

func (a *acessosFalsos) PermissoesDoPerfil(_ context.Context, perfil string) (map[string]bool, error) {
	switch perfil {
	case "GESTOR":
		return map[string]bool{"fornecedores.incluir": true}, nil
	case "COMPRADOR":
		return map[string]bool{"pedidos_compra.emitir": true}, nil
	}
	return map[string]bool{}, nil
}
func (a *acessosFalsos) PermissoesConfiguradas(ctx context.Context, id int64) (map[string]bool, error) {
	if a.repo == nil {
		return map[string]bool{}, nil
	}
	u := a.repo.usuarios[id]
	if u.Perfil == usuario.PerfilAdmin {
		return map[string]bool{"fornecedores.incluir": true, "pedidos_compra.emitir": true, acesso.ConfigUsuarios: true}, nil
	}
	p, _ := a.PermissoesDoPerfil(ctx, string(u.Perfil))
	for _, i := range a.repo.individuais[id] {
		if i.Concedida {
			p[i.Codigo] = true
		} else {
			delete(p, i.Codigo)
		}
	}
	return p, nil
}
func (a *acessosFalsos) Invalidar() { a.invalidacoes++ }

var (
	admin  = acesso.Acesso{UsuarioID: 1, Perfil: "ADMIN", Ativo: true, Permissoes: map[string]bool{"fornecedores.incluir": true, "pedidos_compra.emitir": true, acesso.ConfigUsuarios: true}}
	gestor = acesso.Acesso{UsuarioID: 2, Perfil: "GESTOR", Ativo: true, Permissoes: map[string]bool{"fornecedores.incluir": true, acesso.ConfigUsuarios: true}}
)

func base() []usuario.Usuario {
	return []usuario.Usuario{
		{ID: 1, Username: "admin", Perfil: usuario.PerfilAdmin, Situacao: usuario.SituacaoAtivo},
		{ID: 2, Username: "gestor", Perfil: usuario.PerfilGestor, Situacao: usuario.SituacaoAtivo},
		{ID: 3, Username: "joao", Perfil: usuario.PerfilGestor, Situacao: usuario.SituacaoAtivo},
	}
}

func dadosValidos(perfil usuario.Perfil) usuario.Dados {
	return usuario.Dados{Username: " Maria.Silva ", Nome: "Maria Silva", Email: "Maria@Exemplo.com", Perfil: perfil}
}

func TestCriarNormalizaEExigeTrocaDeSenha(t *testing.T) {
	s := usuario.NovoServicoGestao(novoRepoGestao(base()...), &acessosFalsos{})

	u, err := s.Criar(context.Background(), gestor, dadosValidos(usuario.PerfilGestor), "temporaria1", "gestor")

	require.NoError(t, err)
	assert.Equal(t, "maria.silva", u.Username)
	assert.True(t, u.DeveTrocarSenha)
	assert.NotEqual(t, "temporaria1", u.SenhaHash)
}

func TestCriarValidaCampos(t *testing.T) {
	s := usuario.NovoServicoGestao(novoRepoGestao(), &acessosFalsos{})
	casos := map[string]struct {
		mudar func(*usuario.Dados)
		erro  error
	}{
		"login curto":    {func(d *usuario.Dados) { d.Username = "ab" }, usuario.ErrUsernameInvalido},
		"login espaco":   {func(d *usuario.Dados) { d.Username = "maria silva" }, usuario.ErrUsernameInvalido},
		"sem nome":       {func(d *usuario.Dados) { d.Nome = " " }, usuario.ErrNomeObrigatorio},
		"email ruim":     {func(d *usuario.Dados) { d.Email = "maria" }, usuario.ErrEmailInvalido},
		"email com nome": {func(d *usuario.Dados) { d.Email = "Maria <m@x.com>" }, usuario.ErrEmailInvalido},
		"sem perfil":     {func(d *usuario.Dados) { d.Perfil = "" }, usuario.ErrPerfilObrigatorio},
	}
	for nome, caso := range casos {
		t.Run(nome, func(t *testing.T) {
			d := dadosValidos(usuario.PerfilGestor)
			caso.mudar(&d)
			_, err := s.Criar(context.Background(), admin, d, "temporaria1", "admin")
			assert.ErrorIs(t, err, caso.erro)
		})
	}
	_, err := s.Criar(context.Background(), admin, dadosValidos(usuario.PerfilGestor), "curta", "admin")
	assert.ErrorIs(t, err, usuario.ErrSenhaFraca)
}

func TestNaoAtribuiPerfilComPermissaoQueNaoTem(t *testing.T) {
	repo := novoRepoGestao(base()...)
	s := usuario.NovoServicoGestao(repo, &acessosFalsos{})

	_, err := s.Criar(context.Background(), gestor, dadosValidos("COMPRADOR"), "temporaria1", "gestor")
	assert.ErrorIs(t, err, usuario.ErrAtribuirPerfilSemTer)

	_, err = s.Criar(context.Background(), gestor, dadosValidos(usuario.PerfilAdmin), "temporaria1", "gestor")
	assert.ErrorIs(t, err, usuario.ErrAtribuirPerfilSemTer, "so ADMIN cria ADMIN")

	_, err = s.Atualizar(context.Background(), gestor, 3, dadosValidos("COMPRADOR"), "gestor")
	assert.ErrorIs(t, err, usuario.ErrAtribuirPerfilSemTer)
	assert.Zero(t, repo.criados)

	_, err = s.Criar(context.Background(), admin, dadosValidos(usuario.PerfilAdmin), "temporaria1", "admin")
	assert.NoError(t, err)
}

func TestNinguemAlteraASiMesmo(t *testing.T) {
	s := usuario.NovoServicoGestao(novoRepoGestao(base()...), &acessosFalsos{})
	ctx := context.Background()

	_, err := s.Atualizar(ctx, gestor, 2, dadosValidos(usuario.PerfilGestor), "gestor")
	assert.ErrorIs(t, err, usuario.ErrAlterarASiMesmo)
	_, err = s.AlterarSituacao(ctx, gestor, 2, usuario.SituacaoInativo, tempo.Data{}, "gestor")
	assert.ErrorIs(t, err, usuario.ErrAlterarASiMesmo)
	assert.ErrorIs(t, s.RedefinirSenha(ctx, gestor, 2, "temporaria1", "gestor"), usuario.ErrAlterarASiMesmo)
	assert.ErrorIs(t, s.DefinirPermissao(ctx, gestor, 2, "pedidos_compra.emitir", true, "justificativa longa", "gestor"), usuario.ErrAlterarASiMesmo)
}

func TestSoAdminAlteraAdmin(t *testing.T) {
	s := usuario.NovoServicoGestao(novoRepoGestao(base()...), &acessosFalsos{})

	_, err := s.AlterarSituacao(context.Background(), gestor, 1, usuario.SituacaoBloqueado, tempo.Data{}, "gestor")
	assert.ErrorIs(t, err, usuario.ErrSoAdminAlteraAdmin)
	assert.ErrorIs(t, s.RedefinirSenha(context.Background(), gestor, 1, "temporaria1", "gestor"), usuario.ErrSoAdminAlteraAdmin)
}

func TestNaoInativaNemRebaixaOUltimoAdmin(t *testing.T) {
	us := append(base(), usuario.Usuario{ID: 4, Username: "admin2", Perfil: usuario.PerfilAdmin, Situacao: usuario.SituacaoAtivo})
	repo := novoRepoGestao(us...)
	s := usuario.NovoServicoGestao(repo, &acessosFalsos{})
	ctx := context.Background()
	outroAdmin := admin
	outroAdmin.UsuarioID = 4

	// Com dois ADMIN ativos, o admin2 inativa o admin.
	_, err := s.AlterarSituacao(ctx, outroAdmin, 1, usuario.SituacaoInativo, tempo.Data{}, "admin2")
	require.NoError(t, err)

	// Agora o admin2 e o ultimo: o admin (se reativado por outro) nao o derruba.
	terceiro := admin
	terceiro.UsuarioID = 99
	_, err = s.AlterarSituacao(ctx, terceiro, 4, usuario.SituacaoBloqueado, tempo.Data{}, "x")
	assert.ErrorIs(t, err, usuario.ErrUltimoAdmin)
	_, err = s.Atualizar(ctx, terceiro, 4, dadosValidos(usuario.PerfilGestor), "x")
	assert.ErrorIs(t, err, usuario.ErrUltimoAdmin)
}

func TestSituacaoInvalida(t *testing.T) {
	s := usuario.NovoServicoGestao(novoRepoGestao(base()...), &acessosFalsos{})
	_, err := s.AlterarSituacao(context.Background(), admin, 3, "SUSPENSO", tempo.Data{}, "admin")
	assert.ErrorIs(t, err, usuario.ErrSituacaoInvalida)
}

func TestEscritasInvalidamOCacheDeAcesso(t *testing.T) {
	acessos := &acessosFalsos{}
	s := usuario.NovoServicoGestao(novoRepoGestao(base()...), acessos)
	ctx := context.Background()

	_, err := s.AlterarSituacao(ctx, admin, 3, usuario.SituacaoBloqueado, tempo.Data{}, "admin")
	require.NoError(t, err)
	require.NoError(t, s.RedefinirSenha(ctx, admin, 3, "temporaria1", "admin"))
	require.NoError(t, s.DefinirPermissao(ctx, admin, 3, "pedidos_compra.emitir", true, "cobre ferias do comprador", "admin"))

	assert.Equal(t, 3, acessos.invalidacoes)
}

func TestPermissaoIndividual(t *testing.T) {
	s := usuario.NovoServicoGestao(novoRepoGestao(base()...), &acessosFalsos{})
	ctx := context.Background()

	assert.ErrorIs(t, s.DefinirPermissao(ctx, gestor, 3, "pedidos_compra.emitir", true, "cobre ferias do comprador", "gestor"),
		usuario.ErrConcederSemTer, "nao concede o que nao tem")
	assert.NoError(t, s.DefinirPermissao(ctx, gestor, 3, "pedidos_compra.emitir", false, "retirar e sempre permitido", "gestor"))
	assert.ErrorIs(t, s.DefinirPermissao(ctx, admin, 3, "fornecedores.incluir", true, "curta", "admin"),
		usuario.ErrJustificativaCurta)
	assert.ErrorIs(t, s.DefinirPermissao(ctx, admin, 3, "inexistente.x", true, "justificativa longa", "admin"),
		usuario.ErrPermissaoForaCatalogo)
	outroAdmin := admin
	outroAdmin.UsuarioID = 50
	assert.ErrorIs(t, s.DefinirPermissao(ctx, outroAdmin, 1, "pedidos_compra.emitir", false, "justificativa longa", "admin"),
		usuario.ErrAdminSemIndividuais)
}

func TestDesfazerRetiradaExigeTerAPermissao(t *testing.T) {
	repo := novoRepoGestao(base()...)
	repo.individuais[3] = []usuario.PermissaoIndividual{{Codigo: "pedidos_compra.emitir", Concedida: false}}
	s := usuario.NovoServicoGestao(repo, &acessosFalsos{})

	assert.ErrorIs(t, s.RemoverPermissao(context.Background(), gestor, 3, "pedidos_compra.emitir"), usuario.ErrConcederSemTer)
	assert.ErrorIs(t, s.RemoverPermissao(context.Background(), gestor, 3, "fornecedores.incluir"), usuario.ErrIndividualInexistente)
	assert.NoError(t, s.RemoverPermissao(context.Background(), admin, 3, "pedidos_compra.emitir"))
}

func TestNaoAlteraQuemTemPermissaoQueOEditorNaoTem(t *testing.T) {
	us := append(base(),
		usuario.Usuario{ID: 5, Username: "comprador", Perfil: "COMPRADOR", Situacao: usuario.SituacaoInativo},
		usuario.Usuario{ID: 6, Username: "joana", Perfil: usuario.PerfilGestor, Situacao: usuario.SituacaoAtivo})
	repo := novoRepoGestao(us...)
	repo.individuais[6] = []usuario.PermissaoIndividual{{Codigo: "pedidos_compra.emitir", Concedida: true}}
	s := usuario.NovoServicoGestao(repo, &acessosFalsos{repo: repo})
	ctx := context.Background()

	assert.ErrorIs(t, s.RedefinirSenha(ctx, gestor, 5, "temporaria1", "gestor"), usuario.ErrAlvoComMaisPermissoes,
		"tomar a conta de quem tem mais poderes (mesmo inativo)")
	_, err := s.AlterarSituacao(ctx, gestor, 5, usuario.SituacaoAtivo, tempo.Data{}, "gestor")
	assert.ErrorIs(t, err, usuario.ErrAlvoComMaisPermissoes)
	assert.ErrorIs(t, s.RedefinirSenha(ctx, gestor, 6, "temporaria1", "gestor"), usuario.ErrAlvoComMaisPermissoes,
		"concessao individual tambem conta")
	assert.NoError(t, s.RedefinirSenha(ctx, gestor, 3, "temporaria1", "gestor"))
	assert.NoError(t, s.RedefinirSenha(ctx, admin, 5, "temporaria1", "admin"))
}
