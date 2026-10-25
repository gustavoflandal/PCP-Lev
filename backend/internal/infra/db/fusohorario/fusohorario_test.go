package fusohorario_test

import (
	"context"
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db/fusohorario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

func TestTimestampSemFusoEhLidoNoFusoDaSessao(t *testing.T) {
	testsupport.PularSemBanco(t)
	cfg, err := pgxpool.ParseConfig(testsupport.DSNTeste())
	require.NoError(t, err)
	cfg.ConnConfig.RuntimeParams["timezone"] = "America/Sao_Paulo"
	fusohorario.Configurar(cfg)
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	require.NoError(t, err)
	defer pool.Close()

	var lido time.Time
	require.NoError(t, pool.QueryRow(context.Background(), `SELECT TIMESTAMP '2026-10-24 13:45:00'`).Scan(&lido))

	require.Equal(t, "2026-10-24T13:45:00-03:00", lido.Format(time.RFC3339), "13:45 de parede em Sao Paulo = 16:45 UTC")
}
