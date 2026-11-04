package handlers_test

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cliente"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/importacao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"
)

func apiImportacao(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)
	handlers.NovoImportacaoHandler(pool, &importacao.Importador{
		Clientes:     cliente.NovoServico(repository.NovoClienteRepositorio(pool)),
		Fornecedores: fornecedor.NovoServico(repository.NovoFornecedorRepositorio(pool)),
		Produtos:     produto.NovoServico(repository.NovoProdutoRepositorio(pool)),
		Pecas:        peca.NovoServico(repository.NovoPecaRepositorio(pool)),
	}).Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	return api
}

// enviarPlanilha faz o upload multipart da planilha como o perfil informado.
func enviarPlanilha(api *apiProtegida, perfil usuario.Perfil, nome string, conteudo []byte) *httptest.ResponseRecorder {
	api.t.Helper()
	var corpo bytes.Buffer
	escritor := multipart.NewWriter(&corpo)
	parte, err := escritor.CreateFormFile("arquivo", nome)
	require.NoError(api.t, err)
	_, err = parte.Write(conteudo)
	require.NoError(api.t, err)
	require.NoError(api.t, escritor.Close())

	req := httptest.NewRequest(http.MethodPost, "/api/v1/importacao", &corpo)
	req.Header.Set(echo.HeaderContentType, escritor.FormDataContentType())
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+api.tokenDe(perfil))
	rec := httptest.NewRecorder()
	api.echo.ServeHTTP(rec, req)
	return rec
}

func TestImportacaoGabaritoSoParaQuemTemPermissao(t *testing.T) {
	api := apiImportacao(t)

	rec := api.chamar(http.MethodGet, "/api/v1/importacao/gabarito", "", usuario.PerfilGestor)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Header().Get("Content-Type"), "spreadsheetml")
	assert.Contains(t, rec.Header().Get("Content-Disposition"), "gabarito-importacao.xlsx")
	_, err := excelize.OpenReader(bytes.NewReader(rec.Body.Bytes()))
	assert.NoError(t, err, "o gabarito baixado e um .xlsx valido")

	rec = api.chamar(http.MethodGet, "/api/v1/importacao/gabarito", "", perfilConsulta)
	assert.Equal(t, http.StatusForbidden, rec.Code)

	rec = api.semToken(http.MethodGet, "/api/v1/importacao/gabarito")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestImportacaoUploadRejeitaArquivoQueNaoEPlanilha(t *testing.T) {
	api := apiImportacao(t)

	rec := enviarPlanilha(api, usuario.PerfilGestor, "dados.txt", []byte("oi"))
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	rec = enviarPlanilha(api, usuario.PerfilGestor, "dados.xlsx", []byte("nao e excel"))
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	rec = enviarPlanilha(api, perfilConsulta, "dados.xlsx", []byte("x"))
	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestImportacaoUploadImportaOuDevolveOsErros(t *testing.T) {
	api := apiImportacao(t)

	preencher := func(cnpj string) []byte {
		bruto, err := importacao.Gabarito()
		require.NoError(t, err)
		f, err := excelize.OpenReader(bytes.NewReader(bruto))
		require.NoError(t, err)
		defer f.Close()
		for i, v := range []string{"Outro", "Cliente Importado", cnpj} {
			nome, _ := excelize.CoordinatesToCellName(i+1, 2)
			require.NoError(t, f.SetCellValue(importacao.AbaClientes, nome, v))
		}
		var buf bytes.Buffer
		require.NoError(t, f.Write(&buf))
		return buf.Bytes()
	}

	// CNPJ invalido: 200 com importado=false e a lista de erros.
	rec := enviarPlanilha(api, usuario.PerfilGestor, "c.xlsx", preencher("123"))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	d := dados(t, rec)
	assert.Equal(t, false, d["importado"])
	erros := d["erros"].([]any)
	require.Len(t, erros, 1)
	assert.Equal(t, "Clientes", erros[0].(map[string]any)["aba"])
	assert.EqualValues(t, 2, erros[0].(map[string]any)["linha"])

	// CNPJ valido: importa.
	rec = enviarPlanilha(api, usuario.PerfilGestor, "c.xlsx", preencher("45997418000153"))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	d = dados(t, rec)
	assert.Equal(t, true, d["importado"], rec.Body.String())

	// A rota de clientes nao esta registrada neste Echo de teste: confere no banco.
	var n int
	require.NoError(t, api.pool.QueryRow(t.Context(), `SELECT count(*) FROM clientes WHERE cnpj = '45997418000153'`).Scan(&n))
	assert.Equal(t, 1, n)
}
