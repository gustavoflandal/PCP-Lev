package regional_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func servicoComBanco(t *testing.T) *regional.Servico {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return regional.NovoServico(repository.NovoRegionalRepositorio(pool))
}

func TestServicoBuscarDevolveOsDefaults(t *testing.T) {
	ctx := context.Background()
	servico := servicoComBanco(t)

	cfg, err := servico.Buscar(ctx)

	require.NoError(t, err)
	assert.Equal(t, regional.FormatoDataBR, cfg.FormatoData)
	assert.Equal(t, regional.FormatoHora24, cfg.FormatoHora)
}

func TestServicoAtualizarGravaComValoresValidos(t *testing.T) {
	ctx := context.Background()
	servico := servicoComBanco(t)

	atualizada, err := servico.Atualizar(ctx, regional.Dados{
		FormatoData: regional.FormatoDataTraco,
		FormatoHora: regional.FormatoHora12,
	}, "admin")

	require.NoError(t, err)
	assert.Equal(t, regional.FormatoDataTraco, atualizada.FormatoData)
	assert.Equal(t, regional.FormatoHora12, atualizada.FormatoHora)
}

func TestServicoAtualizarRejeitaFormatoDataInvalido(t *testing.T) {
	ctx := context.Background()
	servico := servicoComBanco(t)

	_, err := servico.Atualizar(ctx, regional.Dados{
		FormatoData: "invalido", FormatoHora: regional.FormatoHora24,
	}, "admin")

	assert.ErrorIs(t, err, regional.ErrFormatoDataInvalido)
}
