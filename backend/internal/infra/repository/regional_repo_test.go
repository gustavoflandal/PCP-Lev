package repository_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegionalBuscarDevolveOsDefaultsSemeadosPelaMigration(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoRegionalRepositorio(testsupport.BancoMigrado(t))

	cfg, err := repo.Buscar(ctx)

	require.NoError(t, err)
	assert.Equal(t, regional.FormatoDataBR, cfg.FormatoData)
	assert.Equal(t, regional.FormatoHora24, cfg.FormatoHora)
	assert.Nil(t, cfg.UpdatedBy)
}

func TestRegionalAtualizarGravaEDevolveALinhaAtual(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoRegionalRepositorio(testsupport.BancoMigrado(t))

	atualizada, err := repo.Atualizar(ctx, regional.Dados{
		FormatoData: regional.FormatoDataISO,
		FormatoHora: regional.FormatoHora12,
	}, "admin")

	require.NoError(t, err)
	assert.Equal(t, regional.FormatoDataISO, atualizada.FormatoData)
	require.NotNil(t, atualizada.UpdatedBy)
	assert.Equal(t, "admin", *atualizada.UpdatedBy)

	relida, err := repo.Buscar(ctx)
	require.NoError(t, err)
	assert.Equal(t, regional.FormatoDataISO, relida.FormatoData)
	assert.Equal(t, regional.FormatoHora12, relida.FormatoHora)
}
