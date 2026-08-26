// Package db cuida da conexao com o PostgreSQL e da aplicacao das migrations.
package db

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var arquivosMigration embed.FS

// chaveLockMigracao identifica o advisory lock que serializa a migracao.
// Sem ele, duas replicas subindo juntas leem schema_version vazia e ambas
// tentam aplicar a mesma migration — a segunda falha e a API nao sobe.
const chaveLockMigracao int64 = 8271_2026

const sqlSchemaVersion = `
CREATE TABLE IF NOT EXISTS schema_version (
  id INT PRIMARY KEY,
  descricao VARCHAR(255) NOT NULL,
  data_aplicacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`

type migration struct {
	id        int
	descricao string
	arquivo   string
}

// Aplicar executa, em ordem, todas as migrations ainda nao registradas em
// schema_version. Cada migration roda dentro da sua propria transacao: uma
// falha no meio do arquivo nao deixa o schema pela metade.
func Aplicar(ctx context.Context, pool *pgxpool.Pool) error {
	// O lock e mantido por uma conexao dedicada durante toda a migracao:
	// quem chegar depois espera aqui e encontra o schema ja pronto.
	conexao, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("obter conexao para migrar: %w", err)
	}
	defer conexao.Release()

	if _, err := conexao.Exec(ctx, `SELECT pg_advisory_lock($1)`, chaveLockMigracao); err != nil {
		return fmt.Errorf("obter lock de migracao: %w", err)
	}
	defer func() {
		// Contexto proprio: o lock precisa ser liberado mesmo se o ctx da
		// chamada ja tiver sido cancelado.
		ctxLiberacao, cancelar := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancelar()
		if _, err := conexao.Exec(ctxLiberacao, `SELECT pg_advisory_unlock($1)`, chaveLockMigracao); err != nil {
			slog.Warn("nao foi possivel liberar o lock de migracao", "erro", err)
		}
	}()

	if _, err := conexao.Exec(ctx, sqlSchemaVersion); err != nil {
		return fmt.Errorf("criar schema_version: %w", err)
	}

	aplicadas, err := versoesAplicadas(ctx, conexao)
	if err != nil {
		return err
	}

	pendentes, err := carregarMigrations()
	if err != nil {
		return err
	}

	for _, m := range pendentes {
		if aplicadas[m.id] {
			continue
		}
		if err := aplicarUma(ctx, pool, m); err != nil {
			return fmt.Errorf("migration %03d (%s): %w", m.id, m.descricao, err)
		}
		slog.Info("migration aplicada", "id", m.id, "descricao", m.descricao)
	}
	return nil
}

func aplicarUma(ctx context.Context, pool *pgxpool.Pool, m migration) error {
	conteudo, err := arquivosMigration.ReadFile(m.arquivo)
	if err != nil {
		return fmt.Errorf("ler arquivo: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, string(conteudo)); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO schema_version (id, descricao) VALUES ($1, $2)`, m.id, m.descricao); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func versoesAplicadas(ctx context.Context, conexao *pgxpool.Conn) (map[int]bool, error) {
	linhas, err := conexao.Query(ctx, `SELECT id FROM schema_version`)
	if err != nil {
		return nil, fmt.Errorf("ler schema_version: %w", err)
	}
	defer linhas.Close()

	aplicadas := map[int]bool{}
	for linhas.Next() {
		var id int
		if err := linhas.Scan(&id); err != nil {
			return nil, err
		}
		aplicadas[id] = true
	}
	return aplicadas, linhas.Err()
}

// carregarMigrations le os arquivos embarcados e os ordena pelo prefixo
// numerico do nome (001_, 002_, ...).
func carregarMigrations() ([]migration, error) {
	entradas, err := fs.ReadDir(arquivosMigration, "migrations")
	if err != nil {
		return nil, err
	}

	migrations := make([]migration, 0, len(entradas))
	for _, e := range entradas {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		prefixo, resto, encontrou := strings.Cut(e.Name(), "_")
		if !encontrou {
			return nil, fmt.Errorf("migration %q nao segue o padrao NNN_descricao.sql", e.Name())
		}
		id, err := strconv.Atoi(prefixo)
		if err != nil {
			return nil, fmt.Errorf("migration %q tem prefixo numerico invalido", e.Name())
		}
		migrations = append(migrations, migration{
			id:        id,
			descricao: strings.TrimSuffix(resto, ".sql"),
			arquivo:   path.Join("migrations", e.Name()),
		})
	}

	sort.Slice(migrations, func(i, j int) bool { return migrations[i].id < migrations[j].id })
	return migrations, nil
}
