package repository_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cotacao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/require"
)

func TestCotacaoRepositorioCriaComItensETotalCorreto(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.BancoMigrado(t)

	forn, err := fornecedor.NovoServico(repository.NovoFornecedorRepositorio(pool)).Criar(ctx,
		fornecedor.Dados{RazaoSocial: "Fornecedor Teste", CNPJ: "11222333000181", LeadTimeMedio: 7}, "gestor01")
	require.NoError(t, err)
	p1, err := peca.NovoServico(repository.NovoPecaRepositorio(pool)).Criar(ctx,
		peca.Dados{Codigo: "RES-10K", Descricao: "Resistor", UnidadeMedida: "UN", EstoqueMaximo: 100, LeadTimeCompra: 5}, "gestor01")
	require.NoError(t, err)
	p2, err := peca.NovoServico(repository.NovoPecaRepositorio(pool)).Criar(ctx,
		peca.Dados{Codigo: "CAP-100N", Descricao: "Capacitor", UnidadeMedida: "UN", EstoqueMaximo: 100, LeadTimeCompra: 5}, "gestor01")
	require.NoError(t, err)

	preco1, _ := dinheiro.DeString("10.00")
	preco2, _ := dinheiro.DeString("5.50")
	emissao, _ := tempo.DeString("2026-08-25")
	validade, _ := tempo.DeString("2026-09-25")

	repo := repository.NovoCotacaoRepositorio(pool)
	c := &cotacao.Cotacao{
		NumeroCotacao: "COT-2026-100",
		FornecedorID:  forn.ID,
		DataEmissao:   emissao,
		DataValidade:  validade,
		Status:        cotacao.StatusRascunho,
		Itens: []cotacao.ItemCotacao{
			{PartePecaID: p1.ID, Quantidade: 10, PrecoUnitario: preco1, Total: preco1.Vezes(10)},
			{PartePecaID: p2.ID, Quantidade: 4, PrecoUnitario: preco2, Total: preco2.Vezes(4)},
		},
	}
	c.ValorTotal = c.Itens[0].Total.Mais(c.Itens[1].Total)

	require.NoError(t, repo.Criar(ctx, c, "gestor01"))

	encontrada, err := repo.BuscarPorID(ctx, c.ID)
	require.NoError(t, err)
	require.Len(t, encontrada.Itens, 2)
	require.Equal(t, "122.00", encontrada.ValorTotal.String())
}
