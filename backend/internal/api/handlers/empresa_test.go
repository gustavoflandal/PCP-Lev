package handlers_test

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/png"
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/empresa"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func apiEmpresa(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	handler := handlers.NovoEmpresaHandler(empresa.NovoServico(repository.NovoEmpresaRepositorio(pool)))
	handler.Registrar(api.echo.Group("/api/v1"), api.autenticacao())
	return api
}

func pngBase64(t *testing.T, lado int) string {
	t.Helper()
	img := image.NewGray(image.Rect(0, 0, lado, lado))
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	return base64.StdEncoding.EncodeToString(buf.Bytes())
}

func TestBuscarEmpresaNaoExigeToken(t *testing.T) {
	api := apiEmpresa(t)

	rec := api.semToken(http.MethodGet, "/api/v1/configuracoes/empresa")

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "", dados(t, rec)["razao_social"])
}

func TestAtualizarEmpresaSemTokenResponde401(t *testing.T) {
	api := apiEmpresa(t)

	rec := api.semToken(http.MethodPut, "/api/v1/configuracoes/empresa")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAtualizarEmpresaComoGestorResponde403(t *testing.T) {
	api := apiEmpresa(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/empresa",
		`{"razao_social": "Industria de Paineis VMS Ltda"}`, usuario.PerfilGestor)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestAtualizarEmpresaComoOperadorResponde403(t *testing.T) {
	api := apiEmpresa(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/empresa",
		`{"razao_social": "Industria de Paineis VMS Ltda"}`, usuario.PerfilOperador)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestAtualizarEmpresaComRazaoSocialVaziaResponde400(t *testing.T) {
	api := apiEmpresa(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/empresa", `{"razao_social": ""}`, usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAtualizarEmpresaValidoReflecteNoGetSeguinte(t *testing.T) {
	api := apiEmpresa(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/empresa",
		`{"razao_social": "Industria de Paineis VMS Ltda", "cnpj": "11.222.333/0001-81", "cidade": "Sao Jose dos Campos"}`,
		usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = api.semToken(http.MethodGet, "/api/v1/configuracoes/empresa")

	require.Equal(t, http.StatusOK, rec.Code)
	corpo := dados(t, rec)
	assert.Equal(t, "Industria de Paineis VMS Ltda", corpo["razao_social"])
	assert.Equal(t, "11222333000181", corpo["cnpj"])
	assert.Equal(t, "Sao Jose dos Campos", corpo["cidade"])
}

func TestLogoClaroAusenteResponde404(t *testing.T) {
	api := apiEmpresa(t)

	rec := api.semToken(http.MethodGet, "/api/v1/configuracoes/empresa/logotipo/claro")

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestAtualizarLogoClaroValidoEDepoisServidoPublicamente(t *testing.T) {
	api := apiEmpresa(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/empresa/logotipo/claro",
		`{"dados_base64": "`+pngBase64(t, 64)+`", "mime": "image/png"}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.True(t, dados(t, rec)["tem_logo_claro"].(bool))

	rec = api.semToken(http.MethodGet, "/api/v1/configuracoes/empresa/logotipo/claro")

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "image/png", rec.Header().Get("Content-Type"))
	assert.NotEmpty(t, rec.Body.Bytes())
}

func TestAtualizarLogoClaroComImagemPequenaDemaisResponde400(t *testing.T) {
	api := apiEmpresa(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/empresa/logotipo/claro",
		`{"dados_base64": "`+pngBase64(t, 8)+`", "mime": "image/png"}`, usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, "ERRO_VALIDACAO", codigoErro(t, rec))
}

func TestAtualizarLogoClaroComoOperadorResponde403(t *testing.T) {
	api := apiEmpresa(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/empresa/logotipo/claro",
		`{"dados_base64": "`+pngBase64(t, 64)+`", "mime": "image/png"}`, usuario.PerfilOperador)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestAtualizarFaviconComSVGResponde400(t *testing.T) {
	api := apiEmpresa(t)
	svgBase64 := base64.StdEncoding.EncodeToString([]byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`))

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/empresa/favicon",
		`{"dados_base64": "`+svgBase64+`", "mime": "image/svg+xml"}`, usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAtualizarLogoClaroComBase64InvalidoResponde400(t *testing.T) {
	api := apiEmpresa(t)

	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/empresa/logotipo/claro",
		`{"dados_base64": "*** nao e base64 ***", "mime": "image/png"}`, usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestRemoverLogoClaroComDadosVazios(t *testing.T) {
	api := apiEmpresa(t)
	rec := api.chamar(http.MethodPut, "/api/v1/configuracoes/empresa/logotipo/claro",
		`{"dados_base64": "`+pngBase64(t, 64)+`", "mime": "image/png"}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code)

	rec = api.chamar(http.MethodPut, "/api/v1/configuracoes/empresa/logotipo/claro", `{"dados_base64": ""}`, usuario.PerfilAdmin)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.False(t, dados(t, rec)["tem_logo_claro"].(bool))
}
