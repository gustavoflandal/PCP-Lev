package handlers_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/centrotrabalho"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cliente"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func apiClientesCentros(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)
	grupo := api.echo.Group("/api/v1")
	handlers.NovoClienteHandler(cliente.NovoServico(repository.NovoClienteRepositorio(pool))).Registrar(grupo, api.autenticacao())
	handlers.NovoCentroTrabalhoHandler(centrotrabalho.NovoServico(repository.NovoCentroTrabalhoRepositorio(pool))).
		Registrar(grupo, api.autenticacao())
	return api
}

const clienteValido = `{
	"tipo": "ORGAO_PUBLICO",
	"razao_social": "Departamento de Estradas de Rodagem",
	"nome_fantasia": "DER",
	"cnpj": "11.222.333/0001-81",
	"contato_email": "Compras@DER.gov.br",
	"contato_telefone": "(31) 3333-4444",
	"cidade": "Belo Horizonte",
	"uf": "mg",
	"numero_contrato": "CT-2026/041",
	"vigencia_inicio": "2026-01-01",
	"vigencia_fim": "2026-12-31"
}`

func TestClientesCriarListarEditarInativar(t *testing.T) {
	api := apiClientesCentros(t)

	rec := api.chamar(http.MethodPost, "/api/v1/clientes", clienteValido, usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	criado := dados(t, rec)
	assert.Equal(t, "11222333000181", criado["cnpj"])
	assert.Equal(t, "MG", criado["uf"])
	assert.Equal(t, "compras@der.gov.br", criado["contato_email"])
	assert.Equal(t, "2026-12-31", criado["vigencia_fim"])
	id := formatarID(criado["id"])

	rec = api.chamar(http.MethodGet, "/api/v1/clientes?busca=der&tipo=ORGAO_PUBLICO", "", perfilConsulta)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Len(t, lista(t, rec), 1)

	rec = api.chamar(http.MethodGet, "/api/v1/clientes?busca=11.222.333/0001", "", perfilConsulta)
	assert.Len(t, lista(t, rec), 1, "busca por CNPJ pontuado")

	rec = api.chamar(http.MethodPost, "/api/v1/clientes", clienteValido, usuario.PerfilGestor)
	assert.Equal(t, http.StatusConflict, rec.Code, "CNPJ duplicado")

	rec = api.chamar(http.MethodPut, "/api/v1/clientes/"+id,
		`{"tipo":"CONCESSIONARIA","razao_social":"Concessionaria Rota","cnpj":"11222333000181","vigencia_inicio":null,"vigencia_fim":null}`,
		usuario.PerfilGestor)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.NotContains(t, dados(t, rec), "vigencia_fim", "limpar a vigencia")
	assert.Equal(t, "", dados(t, rec)["uf"], "UF vazia volta vazia, sem espacos")
	assert.Equal(t, true, dados(t, rec)["ativo"], "sem ativo informado, mantem")

	assert.Equal(t, http.StatusNoContent, api.chamar(http.MethodDelete, "/api/v1/clientes/"+id, "", usuario.PerfilGestor).Code)
	rec = api.chamar(http.MethodGet, "/api/v1/clientes?filtro_ativo=false", "", usuario.PerfilGestor)
	assert.Len(t, lista(t, rec), 1)
}

func TestClientesValidacoes(t *testing.T) {
	api := apiClientesCentros(t)
	casos := map[string]string{
		"tipo invalido":      `{"tipo":"X","razao_social":"A","cnpj":"11222333000181"}`,
		"cnpj invalido":      `{"tipo":"OUTRO","razao_social":"A","cnpj":"11222333000100"}`,
		"uf invalida":        `{"tipo":"OUTRO","razao_social":"A","cnpj":"11222333000181","uf":"XX"}`,
		"vigencia invertida": `{"tipo":"OUTRO","razao_social":"A","cnpj":"11222333000181","vigencia_inicio":"2026-05-01","vigencia_fim":"2026-04-01"}`,
		"email ruim":         `{"tipo":"OUTRO","razao_social":"A","cnpj":"11222333000181","contato_email":"x@"}`,
	}
	for nome, corpo := range casos {
		t.Run(nome, func(t *testing.T) {
			rec := api.chamar(http.MethodPost, "/api/v1/clientes", corpo, usuario.PerfilGestor)
			assert.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
		})
	}
}

func TestClientesPermissoesDaMatriz(t *testing.T) {
	api := apiClientesCentros(t)

	assert.Equal(t, http.StatusCreated, api.chamar(http.MethodPost, "/api/v1/clientes", clienteValido, usuario.Perfil("VENDAS")).Code)
	assert.Equal(t, http.StatusForbidden, api.chamar(http.MethodPost, "/api/v1/clientes", clienteValido, perfilConsulta).Code)
	assert.Equal(t, http.StatusForbidden, api.chamar(http.MethodGet, "/api/v1/clientes", "", usuario.Perfil("COMPRADOR")).Code)
	assert.Equal(t, http.StatusForbidden,
		api.chamar(http.MethodPost, "/api/v1/centros-trabalho", `{"codigo":"BANC-01","nome":"B","etapa":"MONTAGEM"}`, usuario.Perfil("VENDAS")).Code,
		"Vendas so ve centros")
}

func TestCentrosCriarListarEditar(t *testing.T) {
	api := apiClientesCentros(t)

	for i, etapa := range []string{"TESTES", "SEPARACAO", "MONTAGEM"} {
		rec := api.chamar(http.MethodPost, "/api/v1/centros-trabalho",
			fmt.Sprintf(`{"codigo":"banc-0%d","nome":"Bancada %d","etapa":%q,"capacidade_horas_dia":8.5}`, i, i, etapa), usuario.PerfilGestor)
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	}

	rec := api.chamar(http.MethodGet, "/api/v1/centros-trabalho?ordenar_por=etapa", "", usuario.Perfil("OPERADOR"))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	itens := lista(t, rec)
	require.Len(t, itens, 3)
	primeiro := itens[0].(map[string]any)
	assert.Equal(t, "SEPARACAO", primeiro["etapa"], "etapa ordena pelo fluxo")
	assert.Equal(t, "BANC-01", primeiro["codigo"], "codigo em maiusculas")
	assert.Equal(t, 8.5, primeiro["capacidade_horas_dia"])
	id := formatarID(primeiro["id"])

	rec = api.chamar(http.MethodGet, "/api/v1/centros-trabalho?etapa=TESTES", "", usuario.PerfilGestor)
	assert.Len(t, lista(t, rec), 1)

	rec = api.chamar(http.MethodPut, "/api/v1/centros-trabalho/"+id,
		`{"codigo":"OUTRO","nome":"Separacao A","etapa":"SEPARACAO","capacidade_horas_dia":null}`, usuario.PerfilGestor)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "BANC-01", dados(t, rec)["codigo"], "o codigo nao muda")
	assert.Nil(t, dados(t, rec)["capacidade_horas_dia"])

	rec = api.chamar(http.MethodPost, "/api/v1/centros-trabalho", `{"codigo":"BANC-01","nome":"X","etapa":"TESTES"}`, usuario.PerfilGestor)
	assert.Equal(t, http.StatusConflict, rec.Code)
	rec = api.chamar(http.MethodPost, "/api/v1/centros-trabalho", `{"codigo":"BANC-09","nome":"X","etapa":"TESTES","capacidade_horas_dia":25}`, usuario.PerfilGestor)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	for _, capacidade := range []string{"0.04", "7.25"} {
		rec = api.chamar(http.MethodPost, "/api/v1/centros-trabalho",
			`{"codigo":"BANC-08","nome":"X","etapa":"TESTES","capacidade_horas_dia":`+capacidade+`}`, usuario.PerfilGestor)
		assert.Equal(t, http.StatusBadRequest, rec.Code, "mais de uma casa decimal: %s", capacidade)
	}
	rec = api.chamar(http.MethodPost, "/api/v1/centros-trabalho", `{"codigo":"B","nome":"X","etapa":"TESTES"}`, usuario.PerfilGestor)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}
