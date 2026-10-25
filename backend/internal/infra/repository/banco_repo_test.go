package repository_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBancoMetricasLeOServidorEAsTabelasDoSchema(t *testing.T) {
	repo := repository.NovoBancoRepositorio(testsupport.BancoMigrado(t))

	m, err := repo.Metricas(context.Background())

	require.NoError(t, err)
	assert.NotEmpty(t, m.Versao)
	assert.NotEmpty(t, m.Banco)
	assert.Positive(t, m.TamanhoBytes)
	assert.Positive(t, m.ConexoesAtivas)
	assert.Positive(t, m.Pool.Maximo)
	require.NotEmpty(t, m.MaioresTabelas, "o schema migrado tem tabelas")
	assert.LessOrEqual(t, len(m.MaioresTabelas), 10)
	for i := 1; i < len(m.MaioresTabelas); i++ {
		assert.GreaterOrEqual(t, m.MaioresTabelas[i-1].TamanhoBytes, m.MaioresTabelas[i].TamanhoBytes)
	}
}

func TestBancoPingMedeLatencia(t *testing.T) {
	repo := repository.NovoBancoRepositorio(testsupport.BancoMigrado(t))

	latencia, err := repo.Ping(context.Background())

	require.NoError(t, err)
	assert.Positive(t, latencia)
}
