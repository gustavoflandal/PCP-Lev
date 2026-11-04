package importacao_test

import (
	"bytes"
	"context"
	"fmt"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cliente"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/importacao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"
)

// CNPJs validos (digitos verificadores corretos).
const (
	cnpjA = "11222333000181"
	cnpjB = "11444777000161"
)

// planilhaCom parte do gabarito e preenche as linhas (a partir da 2) de uma aba.
func planilhaCom(t *testing.T, preencher func(f *excelize.File)) *bytes.Reader {
	t.Helper()
	bruto, err := importacao.Gabarito()
	require.NoError(t, err)
	f, err := excelize.OpenReader(bytes.NewReader(bruto))
	require.NoError(t, err)
	defer f.Close()
	preencher(f)
	var buf bytes.Buffer
	require.NoError(t, f.Write(&buf))
	return bytes.NewReader(buf.Bytes())
}

func linha(t *testing.T, f *excelize.File, aba string, n int, valores ...string) {
	t.Helper()
	for i, v := range valores {
		nome, _ := excelize.CoordinatesToCellName(i+1, n)
		require.NoError(t, f.SetCellValue(aba, nome, v))
	}
}

func TestGabaritoTemTodasAsAbasECabecalhos(t *testing.T) {
	bruto, err := importacao.Gabarito()
	require.NoError(t, err)
	f, err := excelize.OpenReader(bytes.NewReader(bruto))
	require.NoError(t, err)
	defer f.Close()

	assert.Equal(t, "Instruções", f.GetSheetList()[0])
	for _, aba := range importacao.Abas {
		linhas, err := f.GetRows(aba.Nome)
		require.NoError(t, err, aba.Nome)
		require.Len(t, linhas, 1, "o gabarito vem sem dados: %s", aba.Nome)
		assert.Len(t, linhas[0], len(aba.Colunas), aba.Nome)
	}
	// Um gabarito vazio e lido sem erro e sem linhas.
	planilha, erros, err := importacao.Ler(bytes.NewReader(bruto))
	require.NoError(t, err)
	assert.Empty(t, erros)
	assert.Empty(t, planilha)
}

func TestLerRejeitaArquivoQueNaoEPlanilha(t *testing.T) {
	_, _, err := importacao.Ler(bytes.NewReader([]byte("isto nao e xlsx")))
	assert.Error(t, err)
}

func novoImportador(t *testing.T) (*importacao.Importador, db.Executor) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	return &importacao.Importador{
		Clientes:     cliente.NovoServico(repository.NovoClienteRepositorio(pool)),
		Fornecedores: fornecedor.NovoServico(repository.NovoFornecedorRepositorio(pool)),
		Produtos:     produto.NovoServico(repository.NovoProdutoRepositorio(pool)),
		Pecas:        peca.NovoServico(repository.NovoPecaRepositorio(pool)),
	}, pool
}

func contar(t *testing.T, exec db.Executor, tabela string) int {
	t.Helper()
	var n int
	require.NoError(t, exec.QueryRow(context.Background(), fmt.Sprintf("SELECT count(*) FROM %s", tabela)).Scan(&n))
	return n
}

// fotografia conta os registros que o banco migrado ja traz (dados de demonstracao).
func fotografia(t *testing.T, exec db.Executor) map[string]int {
	t.Helper()
	m := map[string]int{}
	for _, tabela := range []string{"clientes", "fornecedores", "produtos_acabados", "partes_pecas"} {
		m[tabela] = contar(t, exec, tabela)
	}
	return m
}

func TestImportarGravaTudoQuandoNaoHaErros(t *testing.T) {
	im, exec := novoImportador(t)
	antes := fotografia(t, exec)
	r := planilhaCom(t, func(f *excelize.File) {
		linha(t, f, importacao.AbaClientes, 2, "Órgão público", "Prefeitura de Teste", cnpjA, "", "", "", "contato@exemplo.com", "11987654321", "", "Campinas", "SP")
		linha(t, f, importacao.AbaFornecedor, 2, "Eletrônica Ltda", cnpjB, "10")
		linha(t, f, importacao.AbaProdutos, 2, "vms-01", "Radar de velocidade", "UN", "12.345,50", "7", "Sim", "Sim")
		// A peca usa o fornecedor criado na propria planilha.
		linha(t, f, importacao.AbaPecas, 2, "res-10k", "Resistor 10k", "UN", "0", "100", "5", "11.444.777/0001-61")
	})

	planilha, errosLeitura, err := importacao.Ler(r)
	require.NoError(t, err)
	res, err := im.Executar(context.Background(), exec, planilha, errosLeitura, "teste")

	require.NoError(t, err)
	require.True(t, res.Importado, "erros: %+v", res.Erros)
	assert.Empty(t, res.Erros)
	assert.Equal(t, antes["clientes"]+1, contar(t, exec, "clientes"))
	assert.Equal(t, antes["fornecedores"]+1, contar(t, exec, "fornecedores"))
	assert.Equal(t, antes["produtos_acabados"]+1, contar(t, exec, "produtos_acabados"))
	// Peca digitada + espelho do produto que pode ser componente.
	assert.Equal(t, antes["partes_pecas"]+2, contar(t, exec, "partes_pecas"))

	var preco int64
	require.NoError(t, exec.QueryRow(context.Background(), `SELECT (preco_venda*100)::bigint FROM produtos_acabados WHERE codigo = 'VMS-01'`).Scan(&preco))
	assert.EqualValues(t, 1234550, preco)
}

func TestImportarNadaGravaQuandoHaErro(t *testing.T) {
	im, exec := novoImportador(t)
	antes := fotografia(t, exec)
	r := planilhaCom(t, func(f *excelize.File) {
		// Cliente valido e fornecedor valido...
		linha(t, f, importacao.AbaClientes, 2, "Outro", "Cliente Bom", cnpjA)
		linha(t, f, importacao.AbaFornecedor, 2, "Fornecedor Bom", cnpjB, "10")
		// ...mas a peca aponta para um fornecedor que nao existe (integridade referencial)
		linha(t, f, importacao.AbaPecas, 2, "PEC-1", "Peça sem fornecedor", "UN", "0", "10", "5", "45.997.418/0001-53")
		// ...e o produto tem preco invalido e descricao curta.
		linha(t, f, importacao.AbaProdutos, 2, "PRO-1", "abc", "UN", "0", "7")
	})

	planilha, errosLeitura, err := importacao.Ler(r)
	require.NoError(t, err)
	res, err := im.Executar(context.Background(), exec, planilha, errosLeitura, "teste")

	require.NoError(t, err)
	assert.False(t, res.Importado)
	require.NotEmpty(t, res.Erros)

	var achouFornecedor, achouProduto bool
	for _, e := range res.Erros {
		if e.Aba == importacao.AbaPecas && e.Linha == 2 && e.Coluna == "CNPJ do fornecedor padrão" {
			achouFornecedor = true
		}
		if e.Aba == importacao.AbaProdutos && e.Linha == 2 {
			achouProduto = true
		}
	}
	assert.True(t, achouFornecedor, "deve apontar a referencia quebrada com aba, linha e coluna: %+v", res.Erros)
	assert.True(t, achouProduto, "deve apontar o produto invalido: %+v", res.Erros)

	// Tudo ou nada: o cliente e o fornecedor validos tambem nao foram gravados.
	assert.Equal(t, antes, fotografia(t, exec))
}

func TestImportarIgnoraExistentesERepeticaoNaPlanilhaEErro(t *testing.T) {
	im, exec := novoImportador(t)
	antes := fotografia(t, exec)
	primeira := planilhaCom(t, func(f *excelize.File) {
		linha(t, f, importacao.AbaFornecedor, 2, "Fornecedor Um", cnpjA, "10")
	})
	planilha, _, err := importacao.Ler(primeira)
	require.NoError(t, err)
	res, err := im.Executar(context.Background(), exec, planilha, nil, "teste")
	require.NoError(t, err)
	require.True(t, res.Importado, "%+v", res.Erros)

	// Segunda carga: o mesmo CNPJ ja existe (ignorado) e um novo entra.
	segunda := planilhaCom(t, func(f *excelize.File) {
		linha(t, f, importacao.AbaFornecedor, 2, "Fornecedor Um (outro nome)", cnpjA, "99")
		linha(t, f, importacao.AbaFornecedor, 3, "Fornecedor Dois", cnpjB, "10")
	})
	planilha, _, err = importacao.Ler(segunda)
	require.NoError(t, err)
	res, err = im.Executar(context.Background(), exec, planilha, nil, "teste")
	require.NoError(t, err)
	require.True(t, res.Importado, "%+v", res.Erros)
	assert.Equal(t, 1, res.Resumo[0].Importadas)
	assert.Equal(t, 1, res.Resumo[0].Ignoradas)
	assert.Equal(t, antes["fornecedores"]+2, contar(t, exec, "fornecedores"))

	var nome string
	require.NoError(t, exec.QueryRow(context.Background(), `SELECT razao_social FROM fornecedores WHERE cnpj = $1`, cnpjA).Scan(&nome))
	assert.Equal(t, "Fornecedor Um", nome, "o cadastro existente nao e alterado")

	// Repetir o CNPJ dentro da propria planilha e erro.
	terceira := planilhaCom(t, func(f *excelize.File) {
		linha(t, f, importacao.AbaClientes, 2, "Outro", "Cliente X", "45997418000153")
		linha(t, f, importacao.AbaClientes, 3, "Outro", "Cliente Y", "45.997.418/0001-53")
	})
	planilha, _, err = importacao.Ler(terceira)
	require.NoError(t, err)
	res, err = im.Executar(context.Background(), exec, planilha, nil, "teste")
	require.NoError(t, err)
	assert.False(t, res.Importado)
	require.Len(t, res.Erros, 1)
	assert.Equal(t, 3, res.Erros[0].Linha)
	assert.Contains(t, res.Erros[0].Mensagem, "repetido na planilha")
}
