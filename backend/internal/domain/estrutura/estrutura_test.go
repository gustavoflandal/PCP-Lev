package estrutura_test

import (
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/stretchr/testify/require"
)

func TestValidarExigeItens(t *testing.T) {
	inicio, _ := tempo.DeString("2026-09-01")
	d := estrutura.Dados{DataVigenciaInicio: inicio}
	require.ErrorIs(t, d.Validar(), estrutura.ErrItensObrigatorios)
}

func TestValidarExigeQuantidadePositiva(t *testing.T) {
	inicio, _ := tempo.DeString("2026-09-01")
	d := estrutura.Dados{DataVigenciaInicio: inicio, Itens: []estrutura.ItemDados{{PartePecaID: 1, Quantidade: 0}}}
	require.ErrorIs(t, d.Validar(), estrutura.ErrQuantidadeInvalida)
}

func TestValidarExigeVigenciaInicio(t *testing.T) {
	d := estrutura.Dados{Itens: []estrutura.ItemDados{{PartePecaID: 1, Quantidade: 2}}}
	require.ErrorIs(t, d.Validar(), estrutura.ErrDataVigenciaObrigatoria)
}

func TestValidarRejeitaFimAnteriorOuIgualAoInicio(t *testing.T) {
	inicio, _ := tempo.DeString("2026-09-01")
	fim, _ := tempo.DeString("2026-09-01")
	d := estrutura.Dados{
		DataVigenciaInicio: inicio, DataVigenciaFim: fim,
		Itens: []estrutura.ItemDados{{PartePecaID: 1, Quantidade: 2}},
	}
	require.ErrorIs(t, d.Validar(), estrutura.ErrDataVigenciaFimInvalida)
}

func TestValidarAceitaDadosCompletos(t *testing.T) {
	inicio, _ := tempo.DeString("2026-09-01")
	d := estrutura.Dados{DataVigenciaInicio: inicio, Itens: []estrutura.ItemDados{{PartePecaID: 1, Quantidade: 2}}}
	require.NoError(t, d.Validar())
}

func TestValidarProdutoExigeProdutoAcabadoID(t *testing.T) {
	d := estrutura.Dados{}
	require.ErrorIs(t, d.ValidarProduto(), estrutura.ErrProdutoAcabadoObrigatorio)
}
