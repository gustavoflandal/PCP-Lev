package config_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func ambienteMinimo(t *testing.T) {
	t.Helper()
	t.Setenv("DB_HOST", "localhost")
	t.Setenv("DB_PORT", "5442")
	t.Setenv("DB_USER", "pcp_user")
	t.Setenv("DB_PASSWORD", "senha_segura")
	t.Setenv("DB_NAME", "pcp_db")
	t.Setenv("JWT_SECRET", "chave_de_teste_com_mais_de_32_caracteres_ok")
}

func TestCarregarUsaValoresPadraoQuandoOpcionaisAusentes(t *testing.T) {
	ambienteMinimo(t)

	cfg, err := config.Carregar()

	require.NoError(t, err)
	assert.Equal(t, 8000, cfg.APIPort)
	assert.Equal(t, "development", cfg.APIEnv)
	assert.Equal(t, 8, cfg.JWTExpiraHoras)
	assert.Equal(t, "disable", cfg.DBSSLMode)
}

func TestCarregarFalhaSemJWTSecret(t *testing.T) {
	ambienteMinimo(t)
	t.Setenv("JWT_SECRET", "")

	_, err := config.Carregar()

	require.Error(t, err)
	assert.Contains(t, err.Error(), "JWT_SECRET")
}

func TestCarregarRejeitaJWTSecretCurto(t *testing.T) {
	ambienteMinimo(t)
	t.Setenv("JWT_SECRET", "curto")

	_, err := config.Carregar()

	require.Error(t, err)
	assert.Contains(t, err.Error(), "32")
}

func TestCarregarFalhaSemBancoDeDados(t *testing.T) {
	ambienteMinimo(t)
	t.Setenv("DB_NAME", "")

	_, err := config.Carregar()

	require.Error(t, err)
	assert.Contains(t, err.Error(), "DB_NAME")
}

func TestDSNMontaStringDeConexaoPostgres(t *testing.T) {
	ambienteMinimo(t)

	cfg, err := config.Carregar()

	require.NoError(t, err)
	assert.Equal(t,
		"postgres://pcp_user:senha_segura@localhost:5442/pcp_db?sslmode=disable",
		cfg.DSN())
}

func TestCarregarLeCorsOrigensComoLista(t *testing.T) {
	ambienteMinimo(t)
	t.Setenv("CORS_ORIGENS", "http://localhost:5173, http://localhost:3010")

	cfg, err := config.Carregar()

	require.NoError(t, err)
	assert.Equal(t, []string{"http://localhost:5173", "http://localhost:3010"}, cfg.CorsOrigens)
}
