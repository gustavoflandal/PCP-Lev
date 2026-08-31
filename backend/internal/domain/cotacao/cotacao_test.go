package cotacao_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cotacao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func dadosValidos() cotacao.Dados {
	emissao, _ := tempo.DeString("2026-08-25")
	validade, _ := tempo.DeString("2026-09-25")
	preco, _ := dinheiro.DeString("50.00")

	return cotacao.Dados{
		NumeroCotacao: "COT-2026-001",
		FornecedorID:  1,
		DataEmissao:   emissao,
		DataValidade:  validade,
		Itens: []cotacao.ItemDados{
			{PartePecaID: 1, Quantidade: 100, PrecoUnitario: preco},
		},
	}
}

func TestDadosValidosPassamNaValidacao(t *testing.T) {
	require.NoError(t, dadosValidos().Validar())
}

func TestNumeroCotacaoEhGuardadoEmMaiusculas(t *testing.T) {
	dados := dadosValidos()
	dados.NumeroCotacao = "  cot-2026-001  "

	dados.Normalizar()

	assert.Equal(t, "COT-2026-001", dados.NumeroCotacao)
}

func TestFornecedorEhObrigatorio(t *testing.T) {
	dados := dadosValidos()
	dados.FornecedorID = 0

	require.ErrorIs(t, dados.Validar(), cotacao.ErrFornecedorObrigatorio)
}

func TestDataValidadeEhObrigatoria(t *testing.T) {
	dados := dadosValidos()
	dados.DataValidade = tempo.Data{}

	require.ErrorIs(t, dados.Validar(), cotacao.ErrDataValidadeObrigatoria)
}

func TestDataValidadeDeveSerPosteriorAEmissao(t *testing.T) {
	dados := dadosValidos()
	dados.DataValidade = dados.DataEmissao

	require.ErrorIs(t, dados.Validar(), cotacao.ErrDataValidadeInvalida)
}

func TestItensSaoObrigatorios(t *testing.T) {
	dados := dadosValidos()
	dados.Itens = nil

	require.ErrorIs(t, dados.Validar(), cotacao.ErrItensObrigatorios)
}

func TestQuantidadeDoItemDeveSerPositiva(t *testing.T) {
	dados := dadosValidos()
	dados.Itens[0].Quantidade = 0

	require.ErrorIs(t, dados.Validar(), cotacao.ErrQuantidadeInvalida)
}

func TestPrecoUnitarioDoItemDeveSerPositivo(t *testing.T) {
	dados := dadosValidos()
	dados.Itens[0].PrecoUnitario = dinheiro.DeCentavos(0)

	require.ErrorIs(t, dados.Validar(), cotacao.ErrPrecoInvalido)
}
