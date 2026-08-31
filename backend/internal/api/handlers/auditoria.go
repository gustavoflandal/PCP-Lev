package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auditoria"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

const limiteMaximoAuditoria = 200

var errosAuditoria = mapaDeErros{
	{auditoria.ErrTabelaInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{auditoria.ErrOperacaoInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{auditoria.ErrPeriodoInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// AuditoriaHandler atende /auditoria (doc 0, secao 4.6.9).
type AuditoriaHandler struct {
	servico *auditoria.Servico
}

// NovoAuditoriaHandler cria o handler de auditoria.
func NovoAuditoriaHandler(servico *auditoria.Servico) *AuditoriaHandler {
	return &AuditoriaHandler{servico: servico}
}

// Registrar publica as rotas do modulo. Restrito a Administrador -- mesmo
// nivel de acesso de Dados da Empresa; a doc 0 classifica "acessar modulo
// de configuracoes" como permissao sensivel.
func (h *AuditoriaHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	admin := middleware.ExigirPerfil(usuario.PerfilAdmin)

	rotas := grupo.Group("/auditoria", autenticacao, admin)
	rotas.GET("", h.Listar)
	rotas.GET("/exportar", h.ExportarCSV)
}

// Listar devolve a pagina de registros que batem nos filtros.
func (h *AuditoriaHandler) Listar(c echo.Context) error {
	filtros, err := analisarFiltrosAuditoria(c)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	itens, total, err := h.servico.Listar(c.Request().Context(), filtros)
	if err != nil {
		return errosAuditoria.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(filtros.Pagina, filtros.Limite, total))
}

// ExportarCSV exporta os registros que batem no filtro, sem paginacao.
func (h *AuditoriaHandler) ExportarCSV(c echo.Context) error {
	filtros, err := analisarFiltrosAuditoria(c)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}

	itens, err := h.servico.ListarParaExportar(c.Request().Context(), filtros)
	if err != nil {
		return errosAuditoria.responder(c, err)
	}

	linhas := make([][]string, len(itens))
	for i, reg := range itens {
		usuarioNome := ""
		if reg.UsuarioNome != nil {
			usuarioNome = *reg.UsuarioNome
		}
		enderecoIP := ""
		if reg.EnderecoIP != nil {
			enderecoIP = *reg.EnderecoIP
		}
		registroID := ""
		if reg.RegistroID != nil {
			registroID = strconv.FormatInt(*reg.RegistroID, 10)
		}
		linhas[i] = []string{
			reg.DataHora.Format("2006-01-02 15:04:05"), usuarioNome, reg.Tabela, reg.Operacao,
			registroID, enderecoIP,
		}
	}
	return responderCSV(c, "auditoria.csv",
		[]string{"data_hora", "usuario", "tabela", "operacao", "registro_id", "endereco_ip"}, linhas)
}

// analisarFiltrosAuditoria interpreta a query string. Datas no formato
// AAAA-MM-DD (doc 0, secao 4.6.4 -- formato de referencia do sistema);
// data_fim e ajustada para o fim do dia, senao "31/08" excluiria o proprio
// dia 31 de um filtro "ate 31/08".
func analisarFiltrosAuditoria(c echo.Context) (auditoria.Filtros, error) {
	valores := c.QueryParams()
	filtros := auditoria.NovosFiltros()

	if bruto := valores.Get("pagina"); bruto != "" {
		pagina, err := strconv.Atoi(bruto)
		if err != nil || pagina < 1 {
			return filtros, errors.New("pagina deve ser um numero maior ou igual a 1")
		}
		filtros.Pagina = pagina
	}

	if bruto := valores.Get("limite"); bruto != "" {
		limite, err := strconv.Atoi(bruto)
		if err != nil || limite < 1 || limite > limiteMaximoAuditoria {
			return filtros, errors.New("limite deve ser um numero entre 1 e 200")
		}
		filtros.Limite = limite
	}

	if bruto := valores.Get("data_inicio"); bruto != "" {
		data, err := time.Parse("2006-01-02", bruto)
		if err != nil {
			return filtros, errors.New("data_inicio deve estar no formato AAAA-MM-DD")
		}
		filtros.DataInicio = &data
	}

	if bruto := valores.Get("data_fim"); bruto != "" {
		data, err := time.Parse("2006-01-02", bruto)
		if err != nil {
			return filtros, errors.New("data_fim deve estar no formato AAAA-MM-DD")
		}
		fimDoDia := data.Add(24*time.Hour - time.Nanosecond)
		filtros.DataFim = &fimDoDia
	}

	if bruto := valores.Get("usuario_id"); bruto != "" {
		id, err := strconv.ParseInt(bruto, 10, 64)
		if err != nil {
			return filtros, errors.New("usuario_id deve ser um numero")
		}
		filtros.UsuarioID = &id
	}

	filtros.Tabela = valores.Get("tabela")
	filtros.Operacao = valores.Get("operacao")

	return filtros, nil
}
