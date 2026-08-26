package db_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/config"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConectarAbrePoolValido(t *testing.T) {
	testsupport.PularSemBanco(t)

	pool, err := db.Conectar(context.Background(), &config.Config{
		DBHost: "localhost", DBPort: 5442, DBUser: "pcp_user",
		DBPassword: "senha_segura", DBName: "pcp_db_test",
		DBSSLMode: "disable", DBMaxConns: 5,
	})

	require.NoError(t, err)
	defer pool.Close()
	assert.NoError(t, pool.Ping(context.Background()))
}

func TestConectarFalhaComBancoInexistente(t *testing.T) {
	testsupport.PularSemBanco(t)

	_, err := db.Conectar(context.Background(), &config.Config{
		DBHost: "localhost", DBPort: 5442, DBUser: "pcp_user",
		DBPassword: "senha_segura", DBName: "banco_que_nao_existe",
		DBSSLMode: "disable", DBMaxConns: 5,
	})

	require.Error(t, err)
}
