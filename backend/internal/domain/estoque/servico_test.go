package estoque_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/require"
)

func TestAjustarRejeitaQuantidadeZero(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	servico := estoque.NovoServico(repository.NovoEstoqueRepositorio(pool))

	_, err := servico.Ajustar(context.Background(), estoque.AjusteDados{PartePecaID: 1, Quantidade: 0, Motivo: "x"}, "teste")

	require.ErrorIs(t, err, estoque.ErrQuantidadeAjusteObrigatoria)
}

func TestAjustarNormalizaEAplica(t *testing.T) {
	pool := testsupport.BancoMigrado(t)
	pecaRepo := repository.NovoPecaRepositorio(pool)
	p := &peca.PartePeca{Codigo: "SRV-001", Descricao: "Peca do servico", UnidadeMedida: "und", EstoqueMinimo: 1, EstoqueMaximo: 100, LeadTimeCompra: 5, Ativo: true}
	require.NoError(t, pecaRepo.Criar(context.Background(), p, "teste"))

	servico := estoque.NovoServico(repository.NovoEstoqueRepositorio(pool))
	saldo, err := servico.Ajustar(context.Background(), estoque.AjusteDados{
		PartePecaID: p.ID, Quantidade: 15, Motivo: "  Inventario  ", Observacoes: "  recontagem  ",
	}, "teste")

	require.NoError(t, err)
	require.Equal(t, 15, saldo.QuantidadeAtual)
}
