// Package testsupport reune utilitarios compartilhados pelos testes que
// dependem de um PostgreSQL real.
package testsupport

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DSNTeste devolve a conexao do banco de testes.
func DSNTeste() string {
	if dsn := os.Getenv("PCP_TEST_DSN"); dsn != "" {
		return dsn
	}
	return "postgres://pcp_user:senha_segura@localhost:5442/pcp_db_test?sslmode=disable"
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

// PoolLimpo devolve um pool ligado a um schema exclusivo e vazio.
//
// Cada teste recebe o seu proprio schema: `go test ./...` roda os pacotes em
// paralelo, e um schema compartilhado faria um teste apagar as tabelas do
// outro no meio da execucao.
func PoolLimpo(t *testing.T) *pgxpool.Pool {
	t.Helper()
	ctx := context.Background()

	schema := nomeDeSchema(t)
	if err := criarSchema(ctx, schema); err != nil {
		t.Skipf("banco de testes indisponivel em %s: %v", DSNTeste(), err)
	}

	cfg, err := pgxpool.ParseConfig(DSNTeste())
	if err != nil {
		t.Fatalf("dsn de teste invalida: %v", err)
	}
	// Toda conexao do pool passa a enxergar apenas o schema do teste.
	cfg.ConnConfig.RuntimeParams["search_path"] = schema

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatalf("abrir pool de teste: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
		removerSchema(schema)
	})
	return pool
}

// BancoMigrado devolve um pool com o schema exclusivo ja migrado — o ponto de
// partida dos testes de repositorio.
func BancoMigrado(t *testing.T) *pgxpool.Pool {
	t.Helper()
	pool := PoolLimpo(t)
	if err := db.Aplicar(context.Background(), pool); err != nil {
		t.Fatalf("aplicar migrations no banco de teste: %v", err)
	}
	return pool
}

func nomeDeSchema(t *testing.T) string {
	t.Helper()
	sufixo := make([]byte, 6)
	if _, err := rand.Read(sufixo); err != nil {
		t.Fatalf("gerar nome de schema: %v", err)
	}
	return "teste_" + hex.EncodeToString(sufixo)
}

func criarSchema(ctx context.Context, schema string) error {
	pool, err := pgxpool.New(ctx, DSNTeste())
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		return err
	}
	_, err = pool.Exec(ctx, fmt.Sprintf("CREATE SCHEMA %s", schema))
	return err
}

func removerSchema(schema string) {
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, DSNTeste())
	if err != nil {
		return
	}
	defer pool.Close()
	_, _ = pool.Exec(ctx, fmt.Sprintf("DROP SCHEMA IF EXISTS %s CASCADE", schema))
}
