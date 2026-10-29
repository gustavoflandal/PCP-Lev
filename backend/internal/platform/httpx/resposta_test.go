package httpx_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/i18n"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func contexto(t *testing.T) (echo.Context, *httptest.ResponseRecorder) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	return echo.New().NewContext(req, rec), rec
}

func corpo(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &m))
	return m
}

func TestOKMontaEnvelopeDeSucesso(t *testing.T) {
	c, rec := contexto(t)

	require.NoError(t, httpx.OK(c, map[string]string{"codigo": "VMS-01"}))

	assert.Equal(t, http.StatusOK, rec.Code)
	body := corpo(t, rec)
	assert.Equal(t, true, body["sucesso"])
	assert.Equal(t, "VMS-01", body["dados"].(map[string]any)["codigo"])
	assert.NotContains(t, body, "erro")
}

func TestCriadoRespondeCom201(t *testing.T) {
	c, rec := contexto(t)

	require.NoError(t, httpx.Criado(c, map[string]int{"id": 1}))

	assert.Equal(t, http.StatusCreated, rec.Code)
	assert.Equal(t, true, corpo(t, rec)["sucesso"])
}

func TestSemConteudoRespondeCom204(t *testing.T) {
	c, rec := contexto(t)

	require.NoError(t, httpx.SemConteudo(c))

	assert.Equal(t, http.StatusNoContent, rec.Code)
	assert.Empty(t, rec.Body.String())
}

func TestListaIncluiPaginacao(t *testing.T) {
	c, rec := contexto(t)

	require.NoError(t, httpx.Lista(c, []string{"a", "b"}, httpx.NovaPaginacao(2, 50, 150)))

	body := corpo(t, rec)
	paginacao := body["paginacao"].(map[string]any)
	assert.Equal(t, float64(2), paginacao["pagina"])
	assert.Equal(t, float64(50), paginacao["limite"])
	assert.Equal(t, float64(150), paginacao["total"])
	assert.Equal(t, float64(3), paginacao["total_paginas"])
}

func TestNovaPaginacaoArredondaPaginaParcialParaCima(t *testing.T) {
	p := httpx.NovaPaginacao(1, 50, 101)

	assert.Equal(t, 3, p.TotalPaginas)
}

func TestNovaPaginacaoComTotalZeroNaoDivideporZero(t *testing.T) {
	p := httpx.NovaPaginacao(1, 50, 0)

	assert.Equal(t, 0, p.TotalPaginas)
}

func TestErroMontaEnvelopeDeErro(t *testing.T) {
	c, rec := contexto(t)

	require.NoError(t, httpx.Erro(c, http.StatusNotFound, httpx.CodigoNaoEncontrado, "Produto nao encontrado"))

	assert.Equal(t, http.StatusNotFound, rec.Code)
	body := corpo(t, rec)
	assert.Equal(t, false, body["sucesso"])
	erro := body["erro"].(map[string]any)
	assert.Equal(t, "NAO_ENCONTRADO", erro["codigo"])
	assert.Equal(t, "Produto nao encontrado", erro["mensagem"])
	assert.NotContains(t, body, "dados")
}

func TestErroValidacaoListaOsCamposInvalidos(t *testing.T) {
	c, rec := contexto(t)

	require.NoError(t, httpx.ErroValidacao(c, []httpx.CampoInvalido{
		{Campo: "codigo", Mensagem: "Campo obrigatorio"},
	}))

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	erro := corpo(t, rec)["erro"].(map[string]any)
	assert.Equal(t, "ERRO_VALIDACAO", erro["codigo"])
	detalhes := erro["detalhes"].([]any)
	require.Len(t, detalhes, 1)
	assert.Equal(t, "codigo", detalhes[0].(map[string]any)["campo"])
}

func TestErrosSaemNoIdiomaDoAcceptLanguage(t *testing.T) {
	e := echo.New()
	e.Use(i18n.Middleware())
	e.GET("/validar", func(c echo.Context) error {
		return httpx.ErroValidacao(c, httpx.Validar(struct {
			Nome string `json:"nome" validate:"required"`
		}{}))
	})
	e.GET("/erro", func(c echo.Context) error {
		return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoRequisicaoInvalida, "Corpo da requisicao invalido")
	})

	chamar := func(rota, idioma string) map[string]any {
		req := httptest.NewRequest(http.MethodGet, rota, nil)
		if idioma != "" {
			req.Header.Set("Accept-Language", idioma)
		}
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return corpo(t, rec)["erro"].(map[string]any)
	}

	es := chamar("/validar", "es-AR,es;q=0.9")
	assert.Equal(t, "Datos inválidos", es["mensagem"])
	assert.Equal(t, "Campo obligatorio", es["detalhes"].([]any)[0].(map[string]any)["mensagem"])
	assert.Equal(t, "Cuerpo de la solicitud inválido", chamar("/erro", "es")["mensagem"])

	pt := chamar("/validar", "pt-BR")
	assert.Equal(t, "Dados invalidos", pt["mensagem"])
	assert.Equal(t, "Corpo da requisicao invalido", chamar("/erro", "")["mensagem"], "sem cabecalho, portugues")
}
