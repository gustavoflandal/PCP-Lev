package db

import (
	"context"
	"fmt"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

const tempoLimiteConexao = 10 * time.Second

// Conectar abre o pool de conexoes e valida o acesso ao banco com um ping.
// Falhar aqui, na subida da API, e preferivel a falhar na primeira requisicao.
func Conectar(ctx context.Context, cfg *config.Config) (*pgxpool.Pool, error) {
	pgCfg, err := pgxpool.ParseConfig(cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("dsn invalida: %w", err)
	}
	pgCfg.MaxConns = int32(cfg.DBMaxConns)
	pgCfg.MaxConnLifetime = time.Hour
	pgCfg.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, pgCfg)
	if err != nil {
		return nil, fmt.Errorf("abrir pool: %w", err)
	}

	ctxPing, cancelar := context.WithTimeout(ctx, tempoLimiteConexao)
	defer cancelar()

	if err := pool.Ping(ctxPing); err != nil {
		pool.Close()
		return nil, fmt.Errorf("conectar em %s:%d/%s: %w", cfg.DBHost, cfg.DBPort, cfg.DBName, err)
	}
	return pool, nil
}
