package pedidovenda_test

import (
	"strings"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidovenda"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func data(t *testing.T, s string) tempo.Data {
	t.Helper()
	d, err := tempo.DeString(s)
	require.NoError(t, err)
	return d
}

func pedidoValido(t *testing.T) pedidovenda.Dados {
	return pedidovenda.Dados{
		NumeroPedido: "PV-001", ClienteID: 1,
		DataPedido: data(t, "2026-10-01"), DataEntregaPrometida: data(t, "2026-10-20"),
		Itens: []pedidovenda.ItemDados{{ProdutoAcabadoID: 7, Quantidade: 2, PrecoUnitario: dinheiro.DeCentavos(900000)}},
	}
}

func TestValidarPedidoDeVenda(t *testing.T) {
	assert.NoError(t, pedidoValido(t).Validar())

	casos := []struct {
		nome     string
		mudar    func(*pedidovenda.Dados)
		esperado error
	}{
		{"sem numero", func(d *pedidovenda.Dados) { d.NumeroPedido = "" }, pedidovenda.ErrNumeroObrigatorio},
		{"numero longo", func(d *pedidovenda.Dados) { d.NumeroPedido = strings.Repeat("9", 51) }, pedidovenda.ErrNumeroObrigatorio},
		{"sem cliente", func(d *pedidovenda.Dados) { d.ClienteID = 0 }, pedidovenda.ErrClienteObrigatorio},
		{"entrega antes do pedido", func(d *pedidovenda.Dados) { d.DataEntregaPrometida = data(t, "2026-09-30") }, pedidovenda.ErrDatasInvalidas},
		{"entrega no mesmo dia", func(d *pedidovenda.Dados) { d.DataEntregaPrometida = d.DataPedido }, pedidovenda.ErrDatasInvalidas},
		{"sem data do pedido", func(d *pedidovenda.Dados) { d.DataPedido = tempo.Data{} }, pedidovenda.ErrDatasInvalidas},
		{"observacoes longas", func(d *pedidovenda.Dados) { d.Observacoes = strings.Repeat("a", 1001) }, pedidovenda.ErrObservacoesLongas},
		{"sem itens", func(d *pedidovenda.Dados) { d.Itens = nil }, pedidovenda.ErrSemItens},
		{"quantidade zero", func(d *pedidovenda.Dados) { d.Itens[0].Quantidade = 0 }, pedidovenda.ErrItemInvalido},
		{"preco zero", func(d *pedidovenda.Dados) { d.Itens[0].PrecoUnitario = 0 }, pedidovenda.ErrItemInvalido},
		{"sem produto", func(d *pedidovenda.Dados) { d.Itens[0].ProdutoAcabadoID = 0 }, pedidovenda.ErrItemInvalido},
		{"produto repetido", func(d *pedidovenda.Dados) { d.Itens = append(d.Itens, d.Itens[0]) }, pedidovenda.ErrProdutoRepetido},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			d := pedidoValido(t)
			c.mudar(&d)
			assert.ErrorIs(t, d.Validar(), c.esperado)
		})
	}
}

func TestNormalizarLimpaEspacos(t *testing.T) {
	d := pedidovenda.Dados{NumeroPedido: "  PV-9 ", Observacoes: " urgente  "}
	d.Normalizar()
	assert.Equal(t, "PV-9", d.NumeroPedido)
	assert.Equal(t, "urgente", d.Observacoes)
}
