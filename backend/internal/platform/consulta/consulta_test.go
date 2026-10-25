package consulta_test

import (
	"net/url"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var colunas = []string{"codigo", "descricao", "created_at"}

func analisar(t *testing.T, query string) (consulta.Parametros, error) {
	t.Helper()
	valores, err := url.ParseQuery(query)
	require.NoError(t, err)
	return consulta.Analisar(valores, colunas, "codigo")
}

func TestAnalisarAplicaOsPadroesDoDoc3(t *testing.T) {
	p, err := analisar(t, "")

	require.NoError(t, err)
	assert.Equal(t, 1, p.Pagina)
	assert.Equal(t, 50, p.Limite)
	assert.Equal(t, "codigo", p.OrdenarPor)
	assert.Equal(t, consulta.Crescente, p.Ordem)
	assert.Nil(t, p.FiltroAtivo, "sem filtro_ativo a listagem traz ativos e inativos")
}

func TestAnalisarLeOsParametrosInformados(t *testing.T) {
	p, err := analisar(t, "pagina=3&limite=20&ordenar_por=descricao&ordem=desc&filtro_ativo=true&busca=VMS")

	require.NoError(t, err)
	assert.Equal(t, 3, p.Pagina)
	assert.Equal(t, 20, p.Limite)
	assert.Equal(t, "descricao", p.OrdenarPor)
	assert.Equal(t, consulta.Decrescente, p.Ordem)
	require.NotNil(t, p.FiltroAtivo)
	assert.True(t, *p.FiltroAtivo)
	assert.Equal(t, "VMS", p.Busca)
}

func TestOffsetPulaAsPaginasAnteriores(t *testing.T) {
	p, err := analisar(t, "pagina=3&limite=20")

	require.NoError(t, err)
	assert.Equal(t, 40, p.Offset())
}

func TestAnalisarRejeitaColunaDeOrdenacaoDesconhecida(t *testing.T) {
	// A coluna e interpolada no SQL: aceitar valor livre abriria injecao.
	_, err := analisar(t, "ordenar_por=(select senha_hash from usuarios)")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "ordenar_por")
}

func TestAnalisarRejeitaPaginaInvalida(t *testing.T) {
	_, err := analisar(t, "pagina=0")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "pagina")
}

func TestAnalisarRejeitaLimiteAcimaDoTeto(t *testing.T) {
	_, err := analisar(t, "limite=5000")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "limite")
}

func TestAnalisarRejeitaOrdemDesconhecida(t *testing.T) {
	_, err := analisar(t, "ordem=aleatoria")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "ordem")
}

func TestAnalisarAceitaFiltroAtivoFalso(t *testing.T) {
	p, err := analisar(t, "filtro_ativo=false")

	require.NoError(t, err)
	require.NotNil(t, p.FiltroAtivo)
	assert.False(t, *p.FiltroAtivo)
}

func TestAnalisarIgnoraEspacosNaBusca(t *testing.T) {
	p, err := analisar(t, "busca=%20%20conector%20%20")

	require.NoError(t, err)
	assert.Equal(t, "conector", p.Busca)
}

var statusPermitidos = []string{"Rascunho", "Enviada", "Respondida", "Cancelada"}

func analisarComStatus(t *testing.T, query string) (consulta.Parametros, error) {
	t.Helper()
	valores, err := url.ParseQuery(query)
	require.NoError(t, err)
	return consulta.AnalisarComStatus(valores, colunas, "codigo", statusPermitidos)
}

func TestAnalisarComStatusSemStatusNaoFiltra(t *testing.T) {
	p, err := analisarComStatus(t, "")

	require.NoError(t, err)
	assert.Nil(t, p.FiltroStatus, "sem status a listagem traz todos")
}

func TestAnalisarComStatusAceitaStatusValido(t *testing.T) {
	p, err := analisarComStatus(t, "status=Enviada")

	require.NoError(t, err)
	require.NotNil(t, p.FiltroStatus)
	assert.Equal(t, "Enviada", *p.FiltroStatus)
}

func TestAnalisarComStatusRejeitaStatusDesconhecido(t *testing.T) {
	_, err := analisarComStatus(t, "status=Aprovada")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "status")
}

func TestAnalisarComStatusContinuaAplicandoOsPadroesComuns(t *testing.T) {
	p, err := analisarComStatus(t, "pagina=2&ordem=desc")

	require.NoError(t, err)
	assert.Equal(t, 2, p.Pagina)
	assert.Equal(t, consulta.Decrescente, p.Ordem)
}

func TestOrdemSQLDevolveApenasPalavrasChaveSeguras(t *testing.T) {
	crescente, err := analisar(t, "ordem=asc")
	require.NoError(t, err)
	decrescente, err := analisar(t, "ordem=desc")
	require.NoError(t, err)

	assert.Equal(t, "ASC", crescente.Ordem.SQL())
	assert.Equal(t, "DESC", decrescente.Ordem.SQL())
}
