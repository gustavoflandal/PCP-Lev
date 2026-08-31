package db_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Confere em tempo de compilacao que pool e conexao individual implementam
// a mesma interface -- e a base de toda a correcao do pinning de auditoria.
var (
	_ db.Executor = (*pgxpool.Pool)(nil)
	_ db.Executor = (*pgxpool.Conn)(nil)
)

func TestDoContextoSemValorDevolveOPadrao(t *testing.T) {
	pool := testsupport.BancoMigrado(t)

	executor := db.DoContexto(context.Background(), pool)

	assert.Same(t, db.Executor(pool), executor)
}

func TestDoContextoComValorDevolveAConexaoFixada(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	conexao, err := pool.Acquire(context.Background())
	require.NoError(t, err)
	defer conexao.Release()

	ctx := db.ComExecutor(context.Background(), conexao)
	executor := db.DoContexto(ctx, pool)

	assert.Same(t, db.Executor(conexao), executor)
}
