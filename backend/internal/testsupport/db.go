// Package testsupport reune utilitarios compartilhados pelos testes que
// dependem de um PostgreSQL real.
package testsupport

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DSNTeste devolve a conexao do banco de testes.
func DSNTeste() string {
	if dsn := os.Getenv("PCP_TEST_DSN"); dsn != "" {
		return dsn
	}
	return "postgres://pcp_user:senha_segura@localhost:5442/pcp_db_test?sslmode=disable"
}

// PoolLimpo abre um pool contra o banco de testes e zera o schema public,
// garantindo que cada teste comece de um estado conhecido.
func PoolLimpo(t *testing.T) *pgxpool.Pool {
	t.Helper()
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, DSNTeste())
	if err != nil {
		t.Skipf("banco de testes indisponivel: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Skipf("banco de testes indisponivel em %s: %v", DSNTeste(), err)
	}

	if _, err := pool.Exec(ctx, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`); err != nil {
		pool.Close()
		t.Fatalf("nao foi possivel limpar o schema de teste: %v", err)
	}

	t.Cleanup(pool.Close)
	return pool
}

// PularSemBanco interrompe o teste quando o PostgreSQL de testes nao esta no ar.
func PularSemBanco(t *testing.T) {
	t.Helper()
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, DSNTeste())
	if err != nil {
		t.Skipf("banco de testes indisponivel: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("banco de testes indisponivel em %s: %v", DSNTeste(), err)
	}
}
