package pedidocompra_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func dadosValidos() pedidocompra.Dados {
	pedido, _ := tempo.DeString("2026-08-25")
	entrega, _ := tempo.DeString("2026-09-25")
	preco, _ := dinheiro.DeString("50.00")

	return pedidocompra.Dados{
		NumeroPC:            "PC-2026-001",
		FornecedorID:        1,
		DataPedido:          pedido,
		DataEntregaPrevista: entrega,
		Itens: []pedidocompra.ItemDados{
			{PartePecaID: 1, QuantidadeSolicitada: 100, PrecoUnitario: preco},
		},
	}
}

func TestDadosValidosPassamNaValidacao(t *testing.T) {
	require.NoError(t, dadosValidos().Validar())
}

func TestNumeroPCEhGuardadoEmMaiusculas(t *testing.T) {
	dados := dadosValidos()
	dados.NumeroPC = "  pc-2026-001  "

	dados.Normalizar()

	assert.Equal(t, "PC-2026-001", dados.NumeroPC)
}

func TestFornecedorEhObrigatorio(t *testing.T) {
	dados := dadosValidos()
	dados.FornecedorID = 0

	require.ErrorIs(t, dados.Validar(), pedidocompra.ErrFornecedorObrigatorio)
}

func TestDataEntregaEhObrigatoria(t *testing.T) {
	dados := dadosValidos()
	dados.DataEntregaPrevista = tempo.Data{}

	require.ErrorIs(t, dados.Validar(), pedidocompra.ErrDataEntregaObrigatoria)
}

func TestDataEntregaDeveSerPosteriorAoPedido(t *testing.T) {
	dados := dadosValidos()
	dados.DataEntregaPrevista = dados.DataPedido

	require.ErrorIs(t, dados.Validar(), pedidocompra.ErrDataEntregaInvalida)
}

func TestItensSaoObrigatorios(t *testing.T) {
	dados := dadosValidos()
	dados.Itens = nil

	require.ErrorIs(t, dados.Validar(), pedidocompra.ErrItensObrigatorios)
}

func TestQuantidadeSolicitadaDeveSerPositiva(t *testing.T) {
	dados := dadosValidos()
	dados.Itens[0].QuantidadeSolicitada = 0

	require.ErrorIs(t, dados.Validar(), pedidocompra.ErrQuantidadeInvalida)
}

func TestPrecoUnitarioDeveSerPositivo(t *testing.T) {
	dados := dadosValidos()
	dados.Itens[0].PrecoUnitario = dinheiro.DeCentavos(0)

	require.ErrorIs(t, dados.Validar(), pedidocompra.ErrPrecoInvalido)
}
