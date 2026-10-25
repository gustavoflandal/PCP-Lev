package repository_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/negocio"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNegocioBuscarDevolveOsDefaultsDaMigration(t *testing.T) {
	repo := repository.NovoNegocioRepositorio(testsupport.BancoMigrado(t))

	cfg, err := repo.Buscar(context.Background())

	require.NoError(t, err)
	assert.Equal(t, negocio.CustoMedioPonderado, cfg.MetodoCusteio)
	assert.Equal(t, dinheiro.Dinheiro(0), cfg.ToleranciaExcessoRecebimentoPct)
	assert.Equal(t, 7, cfg.LeadTimePadraoDias)
	assert.Nil(t, cfg.LimiteEmissaoGestor, "sem alcada configurada")
	assert.Equal(t, 0, cfg.CotacoesMinimas)
}

func TestNegocioAtualizarGravaTudoInclusiveLimiteNulo(t *testing.T) {
	ctx := context.Background()
	repo := repository.NovoNegocioRepositorio(testsupport.BancoMigrado(t))
	limite, _ := dinheiro.DeString("10000.50")
	tolerancia, _ := dinheiro.DeString("12.75")

	atualizada, err := repo.Atualizar(ctx, negocio.Dados{
		MetodoCusteio: negocio.PrimeiroQueEntra, ToleranciaExcessoRecebimentoPct: tolerancia,
		LeadTimePadraoDias: 15, LimiteEmissaoGestor: &limite, CotacoesMinimas: 3,
		ValorExigeCotacoes: dinheiro.DeCentavos(500000),
	}, "admin")

	require.NoError(t, err)
	assert.Equal(t, negocio.PrimeiroQueEntra, atualizada.MetodoCusteio)
	assert.Equal(t, tolerancia, atualizada.ToleranciaExcessoRecebimentoPct)
	require.NotNil(t, atualizada.LimiteEmissaoGestor)
	assert.Equal(t, limite, *atualizada.LimiteEmissaoGestor)

	// Voltar a "sem limite" grava NULL de novo.
	atualizada.LimiteEmissaoGestor = nil
	relida, err := repo.Atualizar(ctx, atualizada.Dados, "admin")
	require.NoError(t, err)
	assert.Nil(t, relida.LimiteEmissaoGestor)
}
