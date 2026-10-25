package repository_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func repoFornecedor(t *testing.T) (*repository.FornecedorRepositorio, *pgxpool.Pool) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return repository.NovoFornecedorRepositorio(pool), pool
}

// As colunas de contato e endereco sao opcionais no schema. Uma linha gravada
// fora da API (carga inicial, correcao manual) chega com NULL, e a leitura nao
// pode quebrar por causa disso.
func TestBuscarFornecedorComContatoNulo(t *testing.T) {
	ctx := context.Background()
	repo, pool := repoFornecedor(t)
	id := criarFornecedorDeApoio(t, pool)

	f, err := repo.BuscarPorID(ctx, id)

	require.NoError(t, err)
	assert.Equal(t, "Componentes Eletronicos LTDA", f.RazaoSocial)
	assert.Empty(t, f.ContatoNome)
	assert.Empty(t, f.ContatoEmail)
	assert.Empty(t, f.ContatoTelefone)
	assert.Empty(t, f.Endereco)
	assert.Empty(t, f.CondicaoPagamento)
}

func TestListarFornecedorComContatoNulo(t *testing.T) {
	ctx := context.Background()
	repo, pool := repoFornecedor(t)
	criarFornecedorDeApoio(t, pool)

	params, err := consulta.Analisar(nil, []string{"razao_social"}, "razao_social")
	require.NoError(t, err)

	itens, total, err := repo.Listar(ctx, params)

	require.NoError(t, err)
	assert.Equal(t, 1, total)
	require.Len(t, itens, 1)
	assert.Empty(t, itens[0].ContatoEmail)
}
