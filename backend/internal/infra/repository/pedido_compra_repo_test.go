package repository_test

import (
	"context"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/require"
)

func TestPedidoCompraRepositorioCriaComItensETotalCorreto(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.BancoMigrado(t)

	forn, err := fornecedor.NovoServico(repository.NovoFornecedorRepositorio(pool)).Criar(ctx,
		fornecedor.Dados{RazaoSocial: "Fornecedor Teste", CNPJ: "11222333000181", LeadTimeMedio: 7}, "gestor01")
	require.NoError(t, err)
	p1, err := peca.NovoServico(repository.NovoPecaRepositorio(pool)).Criar(ctx,
		peca.Dados{Codigo: "RES-10K", Descricao: "Resistor", UnidadeMedida: "UN", EstoqueMaximo: 100, LeadTimeCompra: 5}, "gestor01")
	require.NoError(t, err)

	preco, _ := dinheiro.DeString("12.00")
	pedido, _ := tempo.DeString("2026-08-25")
	entrega, _ := tempo.DeString("2026-09-25")

	repo := repository.NovoPedidoCompraRepositorio(pool)
	pc := &pedidocompra.PedidoCompra{
		NumeroPC:            "PC-2026-100",
		FornecedorID:        forn.ID,
		DataPedido:          pedido,
		DataEntregaPrevista: entrega,
		Status:              pedidocompra.StatusRascunho,
		Itens: []pedidocompra.ItemPedido{
			{PartePecaID: p1.ID, QuantidadeSolicitada: 20, PrecoUnitario: preco, Total: preco.Vezes(20)},
		},
	}
	pc.ValorTotal = pc.Itens[0].Total

	require.NoError(t, repo.Criar(ctx, pc, "gestor01"))

	encontrado, err := repo.BuscarPorID(ctx, pc.ID)
	require.NoError(t, err)
	require.Len(t, encontrado.Itens, 1)
	require.Equal(t, "240.00", encontrado.ValorTotal.String())
	require.Nil(t, encontrado.CotacaoID, "pedido criado manualmente nao tem cotacao de origem")
}
