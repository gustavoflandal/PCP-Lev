package auditoria_test

import (
	"testing"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auditoria"
	"github.com/stretchr/testify/assert"
)

func TestNovosFiltrosComecaComPaginaUmELimitePadrao(t *testing.T) {
	f := auditoria.NovosFiltros()

	assert.Equal(t, 1, f.Pagina)
	assert.Equal(t, 50, f.Limite)
	assert.NoError(t, f.Validar())
}

func TestValidarAceitaFiltrosVazios(t *testing.T) {
	assert.NoError(t, auditoria.NovosFiltros().Validar())
}

func TestValidarRejeitaTabelaForaDaListaAuditada(t *testing.T) {
	f := auditoria.NovosFiltros()
	f.Tabela = "tabela_inexistente"

	assert.ErrorIs(t, f.Validar(), auditoria.ErrTabelaInvalida)
}

func TestValidarAceitaTabelaAuditada(t *testing.T) {
	f := auditoria.NovosFiltros()
	f.Tabela = "fornecedores"

	assert.NoError(t, f.Validar())
}

func TestValidarRejeitaOperacaoInvalida(t *testing.T) {
	f := auditoria.NovosFiltros()
	f.Operacao = "TRUNCATE"

	assert.ErrorIs(t, f.Validar(), auditoria.ErrOperacaoInvalida)
}

func TestValidarRejeitaPeriodoInvertido(t *testing.T) {
	inicio := time.Date(2026, 8, 31, 0, 0, 0, 0, time.UTC)
	fim := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	f := auditoria.NovosFiltros()
	f.DataInicio, f.DataFim = &inicio, &fim

	assert.ErrorIs(t, f.Validar(), auditoria.ErrPeriodoInvalido)
}

func TestOffsetConvertePaginaEmDeslocamento(t *testing.T) {
	f := auditoria.Filtros{Pagina: 3, Limite: 20}

	assert.Equal(t, 40, f.Offset())
}
