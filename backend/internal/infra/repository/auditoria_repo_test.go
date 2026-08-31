package repository_test

import (
	"context"
	"strconv"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auditoria"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func semearFornecedor(t *testing.T, pool *pgxpool.Pool, cnpj string) int64 {
	t.Helper()
	var id int64
	err := pool.QueryRow(context.Background(),
		`INSERT INTO fornecedores (razao_social, cnpj, lead_time_medio, ativo, created_by, updated_by)
		 VALUES ('Fornecedor Auditoria', $1, 7, true, 'teste', 'teste') RETURNING id`, cnpj).Scan(&id)
	require.NoError(t, err)
	return id
}

func TestListarDevolveRegistroGravadoPeloTriggerNaCriacao(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoAuditoriaRepositorio(pool)

	semearFornecedor(t, pool, "11222333000181")

	registros, total, err := repo.Listar(ctx, auditoria.Filtros{Pagina: 1, Limite: 50, Tabela: "fornecedores"})

	require.NoError(t, err)
	require.GreaterOrEqual(t, total, 1)
	require.NotEmpty(t, registros)
	assert.Equal(t, "fornecedores", registros[0].Tabela)
	assert.Equal(t, "INSERT", registros[0].Operacao)
	assert.NotEmpty(t, registros[0].DadosNovos)
	assert.Empty(t, registros[0].DadosAntigos, "um INSERT nao tem dados_antigos")
}

func TestListarFiltraPorOperacao(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoAuditoriaRepositorio(pool)
	id := semearFornecedor(t, pool, "11222333000181")

	_, err := pool.Exec(ctx, `UPDATE fornecedores SET razao_social = 'Renomeado' WHERE id = $1`, id)
	require.NoError(t, err)

	registros, _, err := repo.Listar(ctx, auditoria.Filtros{
		Pagina: 1, Limite: 50, Tabela: "fornecedores", Operacao: "UPDATE",
	})

	require.NoError(t, err)
	for _, r := range registros {
		assert.Equal(t, "UPDATE", r.Operacao)
	}
	assert.NotEmpty(t, registros)
}

func TestListarFiltraPorTabelaSemNenhumRegistroNaoQuebra(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoAuditoriaRepositorio(pool)

	registros, total, err := repo.Listar(ctx, auditoria.Filtros{Pagina: 1, Limite: 50, Tabela: "partes_pecas"})

	require.NoError(t, err)
	assert.Equal(t, 0, total)
	assert.Empty(t, registros)
}

func TestListarParaExportarNaoPaginaEDevolveTodosOsRegistros(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoAuditoriaRepositorio(pool)
	semearFornecedor(t, pool, "11222333000181")
	semearFornecedor(t, pool, "34028316000103")

	registros, err := repo.ListarParaExportar(ctx, auditoria.Filtros{Tabela: "fornecedores", Operacao: "INSERT"})

	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(registros), 2)
}

// TestListarResolveNomeDoUsuarioViaJoin fixa uma unica conexao (Acquire) para
// gravar a variavel de sessao e inserir o fornecedor na MESMA conexao --
// pool.Exec/QueryRow isolados poderiam cair em conexoes fisicas diferentes
// do pool, exatamente o bug que o middleware de auditoria corrige em
// producao (ver internal/api/middleware/auditoria.go).
func TestListarResolveNomeDoUsuarioViaJoin(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.BancoMigrado(t)
	repo := repository.NovoAuditoriaRepositorio(pool)

	var adminID int64
	var adminNome string
	require.NoError(t, pool.QueryRow(ctx,
		`SELECT id, nome FROM usuarios WHERE username = 'admin'`).Scan(&adminID, &adminNome))

	conexao, err := pool.Acquire(ctx)
	require.NoError(t, err)
	defer conexao.Release()

	_, err = conexao.Exec(ctx, `SELECT set_config('pcp.usuario_id', $1, false)`,
		strconv.FormatInt(adminID, 10))
	require.NoError(t, err)
	var idFornecedor int64
	require.NoError(t, conexao.QueryRow(ctx,
		`INSERT INTO fornecedores (razao_social, cnpj, lead_time_medio, ativo, created_by, updated_by)
		 VALUES ('Fornecedor Com Usuario', '11222333000181', 7, true, 'teste', 'teste') RETURNING id`,
	).Scan(&idFornecedor))
	_, _ = conexao.Exec(ctx, `RESET pcp.usuario_id`)

	registros, _, err := repo.Listar(ctx, auditoria.Filtros{
		Pagina: 1, Limite: 1, Tabela: "fornecedores", Operacao: "INSERT",
	})

	require.NoError(t, err)
	require.NotEmpty(t, registros)
	require.NotNil(t, registros[0].UsuarioID)
	assert.Equal(t, adminID, *registros[0].UsuarioID)
	require.NotNil(t, registros[0].UsuarioNome)
	assert.Equal(t, adminNome, *registros[0].UsuarioNome)
}
