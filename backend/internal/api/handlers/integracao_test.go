package handlers_test

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cliente"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/integracao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/negocio"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidovenda"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func apiIntegracao(t *testing.T) *apiProtegida {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)

	chaves := integracao.NovoServico(repository.NovoIntegracaoRepositorio(pool))
	handlers.NovoIntegracaoHandler(chaves).Registrar(api.echo.Group("/api/v1"), api.autenticacao())

	estoqueServico := estoque.NovoServico(repository.NovoEstoqueRepositorio(pool))
	handlers.NovoIntegracaoPublicaHandler(handlers.ServicosIntegracao{
		Clientes:     cliente.NovoServico(repository.NovoClienteRepositorio(pool)),
		Fornecedores: fornecedor.NovoServico(repository.NovoFornecedorRepositorio(pool)),
		Produtos:     produto.NovoServico(repository.NovoProdutoRepositorio(pool)),
		Pecas:        peca.NovoServico(repository.NovoPecaRepositorio(pool)),
		Estoque:      estoqueServico,
		PedidosVenda: pedidovenda.NovoServico(repository.NovoPedidoVendaRepositorio(pool)),
		PedidosCompra: pedidocompra.NovoServico(repository.NovoPedidoCompraRepositorio(pool), estoqueServico,
			negocio.NovoServico(repository.NovoNegocioRepositorio(pool))),
		Estruturas: estrutura.NovoServico(repository.NovoEstruturaRepositorio(pool)),
	}).Registrar(api.echo, middleware.AutenticacaoPorChave(chaves))
	return api
}

// consultarComChave chama a API publica como o ERP: sem JWT, so com X-API-Key.
func (a *apiProtegida) consultarComChave(rota, chave string) *httptest.ResponseRecorder {
	a.t.Helper()
	req := httptest.NewRequest(http.MethodGet, rota, nil)
	if chave != "" {
		req.Header.Set(middleware.CabecalhoChaveAPI, chave)
	}
	rec := httptest.NewRecorder()
	a.echo.ServeHTTP(rec, req)
	return rec
}

func TestIntegracaoSoQuemTemPermissaoGerenciaChaves(t *testing.T) {
	api := apiIntegracao(t)

	// GESTOR nao recebe a permissao por padrao (so o ADMIN tem tudo).
	rec := api.chamar(http.MethodGet, "/api/v1/integracao/chaves", "", usuario.PerfilGestor)
	assert.Equal(t, http.StatusForbidden, rec.Code)
	rec = api.chamar(http.MethodPost, "/api/v1/integracao/chaves", `{"nome":"ERP"}`, usuario.PerfilGestor)
	assert.Equal(t, http.StatusForbidden, rec.Code)
	rec = api.chamar(http.MethodGet, "/api/v1/integracao/endpoints", "", usuario.PerfilGestor)
	assert.Equal(t, http.StatusForbidden, rec.Code)

	assert.Equal(t, http.StatusUnauthorized, api.semToken(http.MethodGet, "/api/v1/integracao/chaves").Code)
}

func TestIntegracaoCriarChaveMostraSegredoUmaVezEListagemNao(t *testing.T) {
	api := apiIntegracao(t)

	rec := api.chamar(http.MethodPost, "/api/v1/integracao/chaves", `{"nome":"ERP Protheus","descricao":"leitura"}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
	criada := dados(t, rec)
	segredo, _ := criada["chave"].(string)
	assert.NotEmpty(t, segredo)
	assert.Equal(t, "gestor01", criada["criado_por"])

	rec = api.chamar(http.MethodGet, "/api/v1/integracao/chaves", "", usuario.PerfilAdmin)
	require.Equal(t, http.StatusOK, rec.Code)
	itens := lista(t, rec)
	require.Len(t, itens, 1)
	assert.NotContains(t, rec.Body.String(), segredo, "a listagem nunca devolve o segredo")
	assert.Equal(t, segredo[:12], itens[0].(map[string]any)["prefixo"])
}

func TestIntegracaoCriarChaveValidaNome(t *testing.T) {
	api := apiIntegracao(t)

	rec := api.chamar(http.MethodPost, "/api/v1/integracao/chaves", `{"nome":"  "}`, usuario.PerfilAdmin)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestIntegracaoPublicaExigeChaveEListaSomenteLeitura(t *testing.T) {
	api := apiIntegracao(t)
	rec := api.chamar(http.MethodPost, "/api/v1/integracao/chaves", `{"nome":"ERP"}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusCreated, rec.Code)
	chave := dados(t, rec)["chave"].(string)

	// Sem chave, com chave errada ou so com JWT: 401.
	assert.Equal(t, http.StatusUnauthorized, api.consultarComChave("/api/integracao/v1/clientes", "").Code)
	assert.Equal(t, http.StatusUnauthorized, api.consultarComChave("/api/integracao/v1/clientes", "pcp_errada").Code)
	assert.Equal(t, http.StatusUnauthorized, api.semToken(http.MethodGet, "/api/integracao/v1/clientes").Code)

	// Com a chave: lista paginada (vazia num banco limpo), com o mesmo envelope das telas.
	rec = api.consultarComChave("/api/integracao/v1/clientes?limite=10", chave)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	corpo := corpoJSON(t, rec)
	assert.Equal(t, true, corpo["sucesso"])
	assert.NotNil(t, corpo["paginacao"])

	// Parametro invalido da listagem segue a mesma regra das telas.
	assert.Equal(t, http.StatusBadRequest, api.consultarComChave("/api/integracao/v1/clientes?limite=9999", chave).Code)

	// Demais recursos respondem 200.
	for _, rota := range []string{"fornecedores", "produtos-acabados", "partes-pecas", "estoque", "pedidos-venda", "pedidos-compra"} {
		rec = api.consultarComChave("/api/integracao/v1/"+rota, chave)
		assert.Equal(t, http.StatusOK, rec.Code, "%s: %s", rota, rec.Body.String())
	}
	// Registro inexistente: 404.
	assert.Equal(t, http.StatusNotFound, api.consultarComChave("/api/integracao/v1/clientes/999999", chave).Code)

	// Somente leitura: escrita nao existe na API publica.
	req := httptest.NewRequest(http.MethodPost, "/api/integracao/v1/clientes", nil)
	req.Header.Set(middleware.CabecalhoChaveAPI, chave)
	post := httptest.NewRecorder()
	api.echo.ServeHTTP(post, req)
	assert.Contains(t, []int{http.StatusNotFound, http.StatusMethodNotAllowed}, post.Code)
}

func TestIntegracaoRevogarInvalidaAChaveNaProximaChamada(t *testing.T) {
	api := apiIntegracao(t)
	rec := api.chamar(http.MethodPost, "/api/v1/integracao/chaves", `{"nome":"ERP"}`, usuario.PerfilAdmin)
	require.Equal(t, http.StatusCreated, rec.Code)
	criada := dados(t, rec)
	chave := criada["chave"].(string)
	id := int64(criada["id"].(float64))
	require.Equal(t, http.StatusOK, api.consultarComChave("/api/integracao/v1/clientes", chave).Code)

	rec = api.chamar(http.MethodDelete, "/api/v1/integracao/chaves/"+strconv.FormatInt(id, 10), "", usuario.PerfilAdmin)
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())

	assert.Equal(t, http.StatusUnauthorized, api.consultarComChave("/api/integracao/v1/clientes", chave).Code)
	// Revogar de novo: conflito; inexistente: 404.
	assert.Equal(t, http.StatusConflict, api.chamar(http.MethodDelete, "/api/v1/integracao/chaves/"+strconv.FormatInt(id, 10), "", usuario.PerfilAdmin).Code)
	assert.Equal(t, http.StatusNotFound, api.chamar(http.MethodDelete, "/api/v1/integracao/chaves/999999", "", usuario.PerfilAdmin).Code)

	// A chave revogada continua na listagem, marcada como inativa.
	rec = api.chamar(http.MethodGet, "/api/v1/integracao/chaves", "", usuario.PerfilAdmin)
	item := lista(t, rec)[0].(map[string]any)
	assert.Equal(t, false, item["ativo"])
	assert.NotEmpty(t, item["revogada_em"])
}

func TestIntegracaoEndpointsDocumentaTodasAsRotasPublicas(t *testing.T) {
	api := apiIntegracao(t)

	rec := api.chamar(http.MethodGet, "/api/v1/integracao/endpoints", "", usuario.PerfilAdmin)

	require.Equal(t, http.StatusOK, rec.Code)
	documentadas := map[string]bool{}
	for _, item := range lista(t, rec) {
		e := item.(map[string]any)
		assert.Equal(t, "GET", e["metodo"])
		documentadas[e["caminho"].(string)] = true
	}
	// Toda rota publica registrada precisa estar na documentacao.
	for _, r := range api.echo.Routes() {
		// O Echo registra um "*" interno para o 404 do grupo; so as rotas reais contam.
		if r.Method == http.MethodGet && len(r.Path) > len(handlers.PrefixoAPIIntegracao) && r.Path[:len(handlers.PrefixoAPIIntegracao)] == handlers.PrefixoAPIIntegracao {
			caminho := paraDocumentacao(r.Path)
			assert.True(t, documentadas[caminho], "rota sem documentacao: %s %s", r.Method, caminho)
		}
	}
}

// paraDocumentacao troca ":id" por "{id}", o formato usado na documentacao.
func paraDocumentacao(caminho string) string {
	partes := strings.Split(caminho, "/")
	for i, p := range partes {
		if strings.HasPrefix(p, ":") {
			partes[i] = "{" + p[1:] + "}"
		}
	}
	return strings.Join(partes, "/")
}
