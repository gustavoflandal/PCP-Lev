package handlers

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/importacao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

// TamanhoMaximoPlanilha e o limite do upload da planilha de importacao.
const TamanhoMaximoPlanilha = 10 << 20 // 10 MiB

// CaminhoImportacao e o endpoint de upload; o limite global de corpo (2 MiB)
// o libera e o handler aplica o proprio limite.
const CaminhoImportacao = "/api/v1/importacao"

const tipoXLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

// ImportacaoHandler atende o gabarito e a importacao de cadastros.
type ImportacaoHandler struct {
	pool       *pgxpool.Pool
	importador *importacao.Importador
}

// NovoImportacaoHandler cria o handler.
func NovoImportacaoHandler(pool *pgxpool.Pool, importador *importacao.Importador) *ImportacaoHandler {
	return &ImportacaoHandler{pool: pool, importador: importador}
}

// Registrar publica as rotas.
func (h *ImportacaoHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	rotas := grupo.Group("/importacao", autenticacao)
	rotas.GET("/gabarito", h.Gabarito, middleware.ExigirPermissao(acesso.ImportacaoExecutar))
	rotas.POST("", h.Importar, middleware.ExigirPermissao(acesso.ImportacaoExecutar))
}

// Gabarito devolve a planilha Excel vazia e estruturada.
func (h *ImportacaoHandler) Gabarito(c echo.Context) error {
	conteudo, err := importacao.Gabarito()
	if err != nil {
		return httpx.ErroInterno(c)
	}
	c.Response().Header().Set(echo.HeaderContentDisposition, `attachment; filename="gabarito-importacao.xlsx"`)
	return c.Blob(http.StatusOK, tipoXLSX, conteudo)
}

// Importar confere a planilha inteira e, sem nenhum erro, grava tudo numa
// unica transacao. Com erros, nada e gravado e eles voltam com aba/linha/coluna
// (200 com importado=false: o upload funcionou, a planilha e que tem problemas).
func (h *ImportacaoHandler) Importar(c echo.Context) error {
	c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, TamanhoMaximoPlanilha+1<<20)
	arquivo, err := c.FormFile("arquivo")
	if err != nil {
		return erroRequisicaoInvalida(c, "Envie a planilha (.xlsx) no campo 'arquivo'")
	}
	if arquivo.Size > TamanhoMaximoPlanilha {
		return erroRequisicaoInvalida(c, "A planilha passa do tamanho máximo de 10 MB")
	}
	if !strings.HasSuffix(strings.ToLower(arquivo.Filename), ".xlsx") {
		return erroRequisicaoInvalida(c, "Envie uma planilha Excel no formato .xlsx (use o gabarito do sistema)")
	}
	origem, err := arquivo.Open()
	if err != nil {
		return erroRequisicaoInvalida(c, "Não foi possível ler o arquivo enviado")
	}
	defer origem.Close()
	conteudo, err := io.ReadAll(origem)
	if err != nil {
		return erroRequisicaoInvalida(c, "Não foi possível ler o arquivo enviado")
	}

	planilha, errosLeitura, err := importacao.Ler(bytes.NewReader(conteudo))
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	ctx := c.Request().Context()
	resultado, err := h.importador.Executar(ctx, db.DoContexto(ctx, h.pool), planilha, errosLeitura, autorDaRequisicao(c))
	if err != nil {
		c.Logger().Errorf("importacao: %v", err)
		return httpx.ErroInterno(c)
	}
	return httpx.OK(c, resultado)
}
