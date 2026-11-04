package integracao_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/integracao"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// repoFalso guarda as chaves em memoria, como o banco faria.
type repoFalso struct {
	chaves  map[string]*integracao.ChaveAPI // por hash
	usos    int
	proximo int64
}

func novoRepo() *repoFalso { return &repoFalso{chaves: map[string]*integracao.ChaveAPI{}} }

func (r *repoFalso) Criar(_ context.Context, c *integracao.ChaveAPI, hash string) error {
	r.proximo++
	c.ID = r.proximo
	c.CreatedAt = time.Now()
	copia := *c
	r.chaves[hash] = &copia
	return nil
}

func (r *repoFalso) Listar(context.Context) ([]integracao.ChaveAPI, error) {
	lista := []integracao.ChaveAPI{}
	for _, c := range r.chaves {
		lista = append(lista, *c)
	}
	return lista, nil
}

func (r *repoFalso) BuscarAtivaPorHash(_ context.Context, hash string) (*integracao.ChaveAPI, error) {
	c, ok := r.chaves[hash]
	if !ok || !c.Ativo {
		return nil, integracao.ErrNaoEncontrada
	}
	copia := *c
	return &copia, nil
}

func (r *repoFalso) Revogar(_ context.Context, id int64, autor string) error {
	for _, c := range r.chaves {
		if c.ID == id {
			if !c.Ativo {
				return integracao.ErrJaRevogada
			}
			c.Ativo = false
			c.RevogadaPor = autor
			return nil
		}
	}
	return integracao.ErrNaoEncontrada
}

func (r *repoFalso) RegistrarUso(_ context.Context, id int64) error {
	r.usos++
	for _, c := range r.chaves {
		if c.ID == id {
			agora := time.Now()
			c.UltimoUso = &agora
		}
	}
	return nil
}

func TestCriarGeraSegredoEGuardaSoOHash(t *testing.T) {
	repo := novoRepo()
	servico := integracao.NovoServico(repo)

	criada, err := servico.Criar(context.Background(), "  ERP Protheus ", "producao", "gestor01")

	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(criada.Segredo, "pcp_"))
	assert.Len(t, criada.Segredo, len("pcp_")+48)
	assert.Equal(t, criada.Segredo[:12], criada.Prefixo)
	assert.Equal(t, "ERP Protheus", criada.Nome)
	assert.True(t, criada.Ativo)

	// O repositorio so conhece o hash, nunca o segredo.
	_, guardadoPeloSegredo := repo.chaves[criada.Segredo]
	assert.False(t, guardadoPeloSegredo)
	_, guardadoPeloHash := repo.chaves[integracao.HashDaChave(criada.Segredo)]
	assert.True(t, guardadoPeloHash)
}

func TestCriarGeraSegredosDiferentes(t *testing.T) {
	servico := integracao.NovoServico(novoRepo())
	a, err := servico.Criar(context.Background(), "A", "", "x")
	require.NoError(t, err)
	b, err := servico.Criar(context.Background(), "B", "", "x")
	require.NoError(t, err)
	assert.NotEqual(t, a.Segredo, b.Segredo)
}

func TestCriarValidaNomeEDescricao(t *testing.T) {
	servico := integracao.NovoServico(novoRepo())

	_, err := servico.Criar(context.Background(), "   ", "", "x")
	assert.ErrorIs(t, err, integracao.ErrNomeObrigatorio)

	_, err = servico.Criar(context.Background(), strings.Repeat("n", 81), "", "x")
	assert.ErrorIs(t, err, integracao.ErrNomeObrigatorio)

	_, err = servico.Criar(context.Background(), "ok", strings.Repeat("d", 256), "x")
	assert.ErrorIs(t, err, integracao.ErrDescricaoLonga)
}

func TestAutenticarAceitaChaveAtivaEmiteUsoUmaVezPorMinuto(t *testing.T) {
	repo := novoRepo()
	servico := integracao.NovoServico(repo)
	criada, err := servico.Criar(context.Background(), "ERP", "", "x")
	require.NoError(t, err)

	for range 3 {
		chave, err := servico.Autenticar(context.Background(), criada.Segredo)
		require.NoError(t, err)
		assert.Equal(t, criada.ID, chave.ID)
	}
	assert.Equal(t, 1, repo.usos, "ultimo_uso e gravado no maximo uma vez por minuto")
}

func TestAutenticarRecusaChaveInvalidaOuRevogada(t *testing.T) {
	repo := novoRepo()
	servico := integracao.NovoServico(repo)
	criada, err := servico.Criar(context.Background(), "ERP", "", "x")
	require.NoError(t, err)

	for _, segredo := range []string{"", "   ", "qualquer", "pcp_naoexiste", "pcp_" + strings.Repeat("0", 48)} {
		_, err := servico.Autenticar(context.Background(), segredo)
		assert.ErrorIs(t, err, integracao.ErrChaveInvalida, "segredo %q", segredo)
	}

	require.NoError(t, servico.Revogar(context.Background(), criada.ID, "gestor01"))
	_, err = servico.Autenticar(context.Background(), criada.Segredo)
	assert.ErrorIs(t, err, integracao.ErrChaveInvalida, "chave revogada deixa de valer")
	assert.ErrorIs(t, servico.Revogar(context.Background(), criada.ID, "gestor01"), integracao.ErrJaRevogada)
}
