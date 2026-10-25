package handlers_test

import (
	"bytes"
	"fmt"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/arquivo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/testsupport"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func apiArquivos(t *testing.T) (*apiProtegida, int64) {
	t.Helper()
	pool := testsupport.BancoMigrado(t)
	api := novaAPIProtegida(t, pool)
	grupo := api.echo.Group("/api/v1")
	servico := arquivo.NovoServico(repository.NovoArquivoRepositorio(pool), arquivo.NovoAssinador(segredoTeste))
	handlers.NovoArquivoHandler(servico).Registrar(grupo, api.autenticacao())
	handlers.NovoPecaHandler(peca.NovoServico(repository.NovoPecaRepositorio(pool))).ComFotos(servico).Registrar(grupo, api.autenticacao())
	var pecaID int64
	require.NoError(t, pool.QueryRow(t.Context(), `INSERT INTO partes_pecas (codigo, descricao, unidade_medida, item_critico)
		VALUES ('CON-01', 'Conector de painel', 'UN', TRUE) RETURNING id`).Scan(&pecaID))
	return api, pecaID
}

func imagemPNG(t *testing.T, semente int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 300+semente, 200))
	var b bytes.Buffer
	require.NoError(t, png.Encode(&b, img))
	return b.Bytes()
}

func (a *apiProtegida) enviar(perfil usuario.Perfil, nome string, conteudo []byte) *httptest.ResponseRecorder {
	a.t.Helper()
	var corpo bytes.Buffer
	w := multipart.NewWriter(&corpo)
	parte, err := w.CreateFormFile("arquivo", nome)
	require.NoError(a.t, err)
	_, _ = parte.Write(conteudo)
	require.NoError(a.t, w.Close())
	req := httptest.NewRequest(http.MethodPost, "/api/v1/arquivos", &corpo)
	req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+a.tokenDe(perfil))
	rec := httptest.NewRecorder()
	a.echo.ServeHTTP(rec, req)
	return rec
}

func TestArquivosFotoPrincipalGaleriaEUrlAssinada(t *testing.T) {
	api, pecaID := apiArquivos(t)

	rec := api.enviar(usuario.PerfilGestor, "conector.png", imagemPNG(t, 0))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	arq := dados(t, rec)
	assert.Equal(t, "image/png", arq["tipo_mime"])
	assert.Equal(t, true, arq["tem_miniatura"])
	// Mesmo conteudo de novo: deduplicado pelo SHA-256.
	assert.Equal(t, arq["id"], dados(t, api.enviar(usuario.PerfilGestor, "copia.png", imagemPNG(t, 0)))["id"])

	assert.Equal(t, http.StatusForbidden, api.enviar(perfilConsulta, "x.png", imagemPNG(t, 1)).Code, "consulta nao envia")

	rec = api.chamar(http.MethodPost, "/api/v1/anexos", fmt.Sprintf(`{"entidade":"parte_peca","entidade_id":%d,
		"arquivo_id":%q,"tipo":"FOTO","principal":true}`, pecaID, arq["id"]), usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	principal := dados(t, rec)
	assert.NotEmpty(t, principal["miniatura_url"])

	// A lista de pecas traz a miniatura assinada; a URL serve a imagem sem sessao.
	rec = api.chamar(http.MethodGet, fmt.Sprintf("/api/v1/partes-pecas/%d", pecaID), "", perfilConsulta)
	require.Equal(t, http.StatusOK, rec.Code)
	url := dados(t, rec)["foto_url"].(string)
	require.NotEmpty(t, url)
	img := httptest.NewRecorder()
	api.echo.ServeHTTP(img, httptest.NewRequest(http.MethodGet, url, nil))
	require.Equal(t, http.StatusOK, img.Code)
	assert.Equal(t, "image/jpeg", img.Header().Get("Content-Type"), "miniatura em JPEG")
	assert.Equal(t, "nosniff", img.Header().Get("X-Content-Type-Options"))
	adulterada := httptest.NewRecorder()
	api.echo.ServeHTTP(adulterada, httptest.NewRequest(http.MethodGet, strings.Replace(url, "mini=1", "mini=0", 1), nil))
	assert.Equal(t, http.StatusForbidden, adulterada.Code)

	// Item critico: a foto principal nao sai.
	rec = api.chamar(http.MethodDelete, fmt.Sprintf("/api/v1/anexos/%s", formatarID(principal["id"])), "", usuario.PerfilGestor)
	assert.Equal(t, http.StatusConflict, rec.Code)

	// Galeria: ate 10 alem da principal.
	for i := 1; i <= 11; i++ {
		id := dados(t, api.enviar(usuario.PerfilGestor, "g.png", imagemPNG(t, i)))["id"]
		rec = api.chamar(http.MethodPost, "/api/v1/anexos", fmt.Sprintf(`{"entidade":"parte_peca","entidade_id":%d,
			"arquivo_id":%q,"tipo":"FOTO"}`, pecaID, id), usuario.PerfilGestor)
		if i <= 10 {
			require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
		} else {
			assert.Equal(t, http.StatusConflict, rec.Code, "11a foto da galeria")
		}
	}
}

func TestArquivosDocumentoVersionadoComCategoria(t *testing.T) {
	api, pecaID := apiArquivos(t)
	v1 := dados(t, api.enviar(usuario.PerfilGestor, "datasheet.pdf", []byte("%PDF-1.4\nv1\n%%EOF")))["id"]
	v2 := dados(t, api.enviar(usuario.PerfilGestor, "datasheet-r2.pdf", []byte("%PDF-1.4\nv2\n%%EOF")))["id"]
	foto := dados(t, api.enviar(usuario.PerfilGestor, "f.png", imagemPNG(t, 3)))["id"]

	rec := api.chamar(http.MethodPost, "/api/v1/anexos", fmt.Sprintf(`{"entidade":"parte_peca","entidade_id":%d,
		"arquivo_id":%q,"tipo":"DOCUMENTO","categoria":"Receita de bolo"}`, pecaID, v1), usuario.PerfilGestor)
	assert.Equal(t, http.StatusBadRequest, rec.Code, "categoria fora da lista")
	rec = api.chamar(http.MethodPost, "/api/v1/anexos", fmt.Sprintf(`{"entidade":"parte_peca","entidade_id":%d,
		"arquivo_id":%q,"tipo":"DOCUMENTO","categoria":"Datasheet"}`, pecaID, foto), usuario.PerfilGestor)
	assert.Equal(t, http.StatusBadRequest, rec.Code, "documento tecnico e PDF")

	rec = api.chamar(http.MethodPost, "/api/v1/anexos", fmt.Sprintf(`{"entidade":"parte_peca","entidade_id":%d,
		"arquivo_id":%q,"tipo":"DOCUMENTO","categoria":"Datasheet","titulo":"Datasheet do conector","versao":"A",
		"data_validade":%q}`, pecaID, v1, dataFutura(10)), usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	primeira := formatarID(dados(t, rec)["id"])
	rec = api.chamar(http.MethodPost, "/api/v1/anexos", fmt.Sprintf(`{"entidade":"parte_peca","entidade_id":%d,
		"arquivo_id":%q,"tipo":"DOCUMENTO","categoria":"Datasheet","versao":"B","substitui_anexo_id":%s}`,
		pecaID, v2, primeira), usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	rec = api.chamar(http.MethodGet, fmt.Sprintf("/api/v1/anexos?entidade=parte_peca&entidade_id=%d", pecaID), "", perfilConsulta)
	require.Equal(t, http.StatusOK, rec.Code)
	docs := lista(t, rec)
	require.Len(t, docs, 2)
	vigentes := 0
	for _, d := range docs {
		if d.(map[string]any)["vigente"] == true {
			vigentes++
			assert.Equal(t, "B", d.(map[string]any)["versao"])
		}
	}
	assert.Equal(t, 1, vigentes, "so a versao nova fica vigente; a anterior e preservada")

	// Vencimentos: a versao A (com validade) deixou de ser vigente.
	rec = api.chamar(http.MethodGet, "/api/v1/anexos/vencimentos?dias=30", "", perfilConsulta)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Empty(t, lista(t, rec))
}

// Fase 3.1: anexos de fornecedor/PC com categoria fechada, remocao bloqueada
// em registro encerrado e vencimentos filtrados por permissao.
func TestAnexosDosRegistrosOperacionais(t *testing.T) {
	api, _ := apiArquivos(t)
	ctx := t.Context()
	var fornecedor, pc int64
	require.NoError(t, api.pool.QueryRow(ctx, `INSERT INTO fornecedores (razao_social, cnpj, lead_time_medio)
		VALUES ('Fornecedor Certificado', '11222333000181', 5) RETURNING id`).Scan(&fornecedor))
	require.NoError(t, api.pool.QueryRow(ctx, `INSERT INTO pedidos_compra (numero_pc, fornecedor_id, data_pedido, data_entrega_prevista,
		valor_total, status) VALUES ('PC-ANX', $1, CURRENT_DATE, CURRENT_DATE + 5, 100, 'Aguardando Entrega') RETURNING id`, fornecedor).Scan(&pc))
	arq := dados(t, api.enviar(usuario.PerfilGestor, "iso9001.pdf", []byte("%PDF-1.4\niso\n%%EOF")))["id"]

	anexar := func(entidade string, id int64, extra string, esperado int) map[string]any {
		rec := api.chamar(http.MethodPost, "/api/v1/anexos", fmt.Sprintf(`{"entidade":%q,"entidade_id":%d,"arquivo_id":%q%s}`,
			entidade, id, arq, extra), usuario.PerfilGestor)
		require.Equal(t, esperado, rec.Code, rec.Body.String())
		if esperado != http.StatusCreated {
			return nil
		}
		return dados(t, rec)
	}
	// Categoria fora da lista, sem categoria ou tipo DOCUMENTO: recusados.
	anexar("fornecedor", fornecedor, `,"tipo":"ANEXO","categoria":"Datasheet"`, http.StatusBadRequest)
	anexar("fornecedor", fornecedor, `,"tipo":"ANEXO"`, http.StatusBadRequest)
	anexar("fornecedor", fornecedor, `,"tipo":"DOCUMENTO","categoria":"Contrato"`, http.StatusBadRequest)
	anexar("fornecedor", fornecedor, fmt.Sprintf(`,"tipo":"ANEXO","categoria":"Certificado de Qualidade","titulo":"ISO 9001","data_validade":%q`,
		dataFutura(10)), http.StatusCreated)

	// Vencimentos: o certificado aparece para quem ve fornecedores, nao para o operador.
	rec := api.chamar(http.MethodGet, "/api/v1/anexos/vencimentos?dias=30", "", usuario.PerfilGestor)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "Fornecedor Certificado")
	rec = api.chamar(http.MethodGet, "/api/v1/anexos/vencimentos?dias=30", "", usuario.Perfil("OPERADOR"))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.NotContains(t, rec.Body.String(), "Fornecedor Certificado")

	// PC encerrado: anexa ainda, mas nao remove.
	proposta := anexar("pedido_compra", pc, `,"tipo":"ANEXO","categoria":"Proposta/Cotação"`, http.StatusCreated)
	_, err := api.pool.Exec(ctx, `UPDATE pedidos_compra SET status = 'Concluido' WHERE id = $1`, pc)
	require.NoError(t, err)
	anexar("pedido_compra", pc, `,"tipo":"ANEXO","categoria":"Comunicação","titulo":"aceite posterior"`, http.StatusCreated)
	rec = api.chamar(http.MethodDelete, "/api/v1/anexos/"+formatarID(proposta["id"]), "", usuario.PerfilGestor)
	assert.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())
}

// Quem conhece o UUID de um arquivo que nao pode ver nao o vincula a um
// registro seu para le-lo por ali (IDOR).
func TestAnexarArquivoAlheioERecusado(t *testing.T) {
	api, _ := apiArquivos(t)
	ctx := t.Context()
	var fornecedor, cliente int64
	require.NoError(t, api.pool.QueryRow(ctx, `INSERT INTO fornecedores (razao_social, cnpj, lead_time_medio)
		VALUES ('Fornecedor Sigiloso', '11222333000181', 5) RETURNING id`).Scan(&fornecedor))
	require.NoError(t, api.pool.QueryRow(ctx, `INSERT INTO clientes (tipo, razao_social, cnpj)
		VALUES ('ORGAO_PUBLICO', 'Cliente do Vendas', '45723174000110') RETURNING id`).Scan(&cliente))
	contrato := dados(t, api.enviar(usuario.PerfilGestor, "contrato.pdf", []byte("%PDF-1.4\ncontrato sigiloso\n%%EOF")))["id"]
	rec := api.chamar(http.MethodPost, "/api/v1/anexos", fmt.Sprintf(`{"entidade":"fornecedor","entidade_id":%d,"arquivo_id":%q,
		"tipo":"ANEXO","categoria":"Contrato"}`, fornecedor, contrato), usuario.PerfilGestor)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	// Vendas (outro login) edita clientes, mas nao ve fornecedores.
	token, _, err := api.tokens.Gerar(&usuario.Usuario{ID: api.usuarioDe("VENDAS"), Username: "vendas01", Perfil: "VENDAS", Ativo: true})
	require.NoError(t, err)
	comoVendas := func(metodo, rota, corpo string) int {
		req := httptest.NewRequest(metodo, rota, strings.NewReader(corpo))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
		rec := httptest.NewRecorder()
		api.echo.ServeHTTP(rec, req)
		return rec.Code
	}
	assert.Equal(t, http.StatusForbidden, comoVendas(http.MethodPost, "/api/v1/anexos", fmt.Sprintf(`{"entidade":"cliente","entidade_id":%d,
		"arquivo_id":%q,"tipo":"ANEXO","categoria":"Contrato"}`, cliente, contrato)))
	assert.Equal(t, http.StatusForbidden, comoVendas(http.MethodGet, fmt.Sprintf("/api/v1/arquivos/%s/url", contrato), ""))
}
