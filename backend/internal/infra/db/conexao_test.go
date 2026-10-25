package db_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/config"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// configDeTeste deriva a configuracao de conexao de testsupport.DSNTeste(),
// em vez de host/porta fixos: a porta local de quem desenvolve (5442, do
// docker-compose deste repo) nao e a mesma do servico de banco no CI, que
// so expoe PCP_TEST_DSN.
func configDeTeste(t *testing.T, dbName string) *config.Config {
	t.Helper()
	pgCfg, err := pgxpool.ParseConfig(testsupport.DSNTeste())
	require.NoError(t, err, "PCP_TEST_DSN invalida")

	return &config.Config{
		DBHost: pgCfg.ConnConfig.Host, DBPort: int(pgCfg.ConnConfig.Port),
		DBUser: pgCfg.ConnConfig.User, DBPassword: pgCfg.ConnConfig.Password,
		DBName: dbName, DBSSLMode: "disable", DBMaxConns: 5,
	}
}

func TestConectarAbrePoolValido(t *testing.T) {
	testsupport.PularSemBanco(t)

	pool, err := db.Conectar(context.Background(), configDeTeste(t, "pcp_db_test"))

	require.NoError(t, err)
	defer pool.Close()
	assert.NoError(t, pool.Ping(context.Background()))
}

func TestConectarFalhaComBancoInexistente(t *testing.T) {
	testsupport.PularSemBanco(t)

	_, err := db.Conectar(context.Background(), configDeTeste(t, "banco_que_nao_existe"))

	require.Error(t, err)
}
