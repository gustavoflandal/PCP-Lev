package acesso

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// repoFalso guarda a matriz em memoria; `segurar` faz a proxima leitura de
// permissoes esperar, para reproduzir a corrida com uma edicao.
type repoFalso struct {
	mu       sync.Mutex
	matriz   map[string][]string
	segurar  chan struct{}
	leituras int
}

func (r *repoFalso) PermissoesDoPerfil(_ context.Context, codigo string) ([]string, error) {
	r.mu.Lock()
	lida := append([]string(nil), r.matriz[codigo]...)
	segurar := r.segurar
	r.segurar = nil
	r.leituras++
	r.mu.Unlock()
	if segurar != nil {
		<-segurar
	}
	return lida, nil
}

func (r *repoFalso) AtualizarPerfil(_ context.Context, codigo string, d Dados, _ string) (Perfil, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.matriz[codigo] = d.Permissoes
	return Perfil{Codigo: codigo, Permissoes: d.Permissoes}, nil
}

func (r *repoFalso) BuscarPerfil(_ context.Context, codigo string) (Perfil, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return Perfil{Codigo: codigo, Permissoes: r.matriz[codigo], Sistema: true}, nil
}

func (r *repoFalso) ListarPermissoes(context.Context) ([]Permissao, error) { return nil, nil }
func (r *repoFalso) ListarPerfis(context.Context) ([]Perfil, error)        { return nil, nil }
func (r *repoFalso) CriarPerfil(context.Context, string, Dados, string) (Perfil, error) {
	return Perfil{}, nil
}
func (r *repoFalso) ExcluirPerfil(context.Context, string) error { return nil }
func (r *repoFalso) DadosDeAcesso(context.Context, int64) (DadosDeAcesso, error) {
	return DadosDeAcesso{}, ErrUsuarioNaoEncontrado
}

func admin() Editor {
	todas := map[string]bool{}
	for _, p := range Catalogo {
		todas[p] = true
	}
	return Editor{Perfil: PerfilAdmin, Permissoes: todas}
}

// Achado A1 da revisao: uma leitura que comecou antes de uma edicao nao pode
// gravar o conjunto velho no cache depois dela.
func TestLeituraAntigaNaoRepoePermissaoRevogada(t *testing.T) {
	ctx := context.Background()
	repo := &repoFalso{matriz: map[string][]string{"COMPRADOR": {PedidosEmitir}}, segurar: make(chan struct{})}
	servico := NovoServico(repo)
	liberar := repo.segurar

	feito := make(chan map[string]bool)
	go func() {
		conjunto, _ := servico.PermissoesDoPerfil(ctx, "COMPRADOR")
		feito <- conjunto
	}()
	require.Eventually(t, func() bool { repo.mu.Lock(); defer repo.mu.Unlock(); return repo.leituras == 1 }, time.Second, time.Millisecond)

	_, err := servico.AtualizarPerfil(ctx, admin(), "COMPRADOR", Dados{Nome: "Comprador", Permissoes: []string{}}, "admin")
	require.NoError(t, err)
	close(liberar)
	<-feito

	depois, err := servico.PermissoesDoPerfil(ctx, "COMPRADOR")
	require.NoError(t, err)
	assert.False(t, depois[PedidosEmitir], "a revogacao vale, mesmo com a leitura velha terminando depois")
}

func TestCacheExpiraParaMudancasDeForaDoProcesso(t *testing.T) {
	ctx := context.Background()
	repo := &repoFalso{matriz: map[string][]string{"VENDAS": {ProdutosVisualizar}}}
	servico := NovoServico(repo)
	agora := time.Date(2026, 10, 24, 10, 0, 0, 0, time.UTC)
	servico.agora = func() time.Time { return agora }

	_, _ = servico.PermissoesDoPerfil(ctx, "VENDAS")
	repo.mu.Lock()
	repo.matriz["VENDAS"] = []string{} // ex.: outra replica da API retirou
	repo.mu.Unlock()

	ainda, _ := servico.PermissoesDoPerfil(ctx, "VENDAS")
	assert.True(t, ainda[ProdutosVisualizar], "dentro da validade, usa o cache")

	agora = agora.Add(validadeCache + time.Second)
	depois, _ := servico.PermissoesDoPerfil(ctx, "VENDAS")
	assert.False(t, depois[ProdutosVisualizar], "passada a validade, rele do banco")
}
