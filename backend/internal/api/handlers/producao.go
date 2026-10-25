package handlers

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"strconv"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/arquivo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/producao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/labstack/echo/v4"
)

// CodigoMaterialInsuficiente e o 409 da liberacao sem material; os detalhes
// listam cada peca ("campo" = codigo da peca).
const CodigoMaterialInsuficiente = "MATERIAL_INSUFICIENTE"

var errosProducao = mapaDeErros{
	{producao.ErrNaoEncontrada, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{producao.ErrItemNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{producao.ErrSerieNaoEncontrada, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{producao.ErrItemJaTemOP, http.StatusConflict, httpx.CodigoConflito},
	{producao.ErrPedidoNaoPermiteOP, http.StatusConflict, httpx.CodigoConflito},
	{producao.ErrSemEstruturaAtiva, http.StatusConflict, httpx.CodigoConflito},
	{producao.ErrStatusInvalidoParaAcao, http.StatusConflict, httpx.CodigoConflito},
	{producao.ErrApontamentoAberto, http.StatusConflict, httpx.CodigoConflito},
	{producao.ErrSemApontamentoAberto, http.StatusConflict, httpx.CodigoConflito},
	{producao.ErrSemApontamentoNaEtapa, http.StatusConflict, httpx.CodigoConflito},
	{producao.ErrSeriesPendentes, http.StatusConflict, httpx.CodigoConflito},
	{producao.ErrMetrologiaPendente, http.StatusConflict, httpx.CodigoConflito},
	{producao.ErrOPJaConsumiu, http.StatusConflict, httpx.CodigoConflito},
	{producao.ErrSerieForaDeTeste, http.StatusConflict, httpx.CodigoConflito},
	{producao.ErrProdutoSemMetrologia, http.StatusConflict, httpx.CodigoConflito},
	{producao.ErrCentroInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{producao.ErrResultadoObrigatorio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{producao.ErrMetrologiaInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{producao.ErrObservacoesLongas, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// ProducaoHandler atende /ops, /kanban, /series, /rastreabilidade e /metrologia.
type ProducaoHandler struct {
	servico *producao.Servico
	fotos   *arquivo.Servico
}

// ComFotos liga as miniaturas de produto e pecas nas respostas.
func (h *ProducaoHandler) ComFotos(s *arquivo.Servico) *ProducaoHandler {
	h.fotos = s
	return h
}

// NovoProducaoHandler cria o handler.
func NovoProducaoHandler(servico *producao.Servico) *ProducaoHandler {
	return &ProducaoHandler{servico: servico}
}

// Registrar publica as rotas.
func (h *ProducaoHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	ver := middleware.ExigirPermissao(acesso.ProducaoVisualizar)
	ops := grupo.Group("/ops", autenticacao)
	ops.GET("", h.Listar, ver)
	ops.GET("/:id", h.Obter, ver)
	ops.POST("", h.GerarOP, middleware.ExigirPermissao(acesso.ProducaoGerarOP))
	ops.POST("/:id/liberar", h.Liberar, middleware.ExigirPermissao(acesso.ProducaoLiberar))
	ops.POST("/:id/cancelar", h.Cancelar, middleware.ExigirPermissao(acesso.ProducaoCancelar))
	ops.POST("/:id/apontamentos", h.IniciarApontamento, middleware.ExigirPermissao(acesso.ProducaoApontar))
	ops.POST("/:id/apontamentos/encerrar", h.EncerrarApontamento, middleware.ExigirPermissao(acesso.ProducaoApontar))
	ops.POST("/:id/avancar", h.Avancar, middleware.ExigirPermissao(acesso.ProducaoAvancar))

	grupo.GET("/kanban", h.Kanban, autenticacao, ver)
	grupo.PUT("/series/:id/teste", h.RegistrarTeste, autenticacao, middleware.ExigirPermissao(acesso.ProducaoTestar))
	grupo.PUT("/series/:id/metrologia", h.RegistrarMetrologia, autenticacao, middleware.ExigirPermissao(acesso.ProducaoMetrologia))
	grupo.GET("/rastreabilidade/:numero", h.Rastreabilidade, autenticacao, ver)
	grupo.GET("/metrologia/vencimentos", h.Vencimentos, autenticacao, ver)
}

func (h *ProducaoHandler) responder(c echo.Context, err error) error {
	var falta *producao.ErroDeFalta
	if errors.As(err, &falta) {
		detalhes := make([]httpx.CampoInvalido, 0, len(falta.Faltas))
		for _, f := range falta.Faltas {
			detalhes = append(detalhes, httpx.CampoInvalido{
				Campo:    f.Codigo,
				Mensagem: fmt.Sprintf("%s: necessaria %d, disponivel %d", f.Descricao, f.Necessaria, f.Disponivel),
			})
		}
		return c.JSON(http.StatusConflict, httpx.RespostaErro{Erro: httpx.DetalheErro{
			Codigo: CodigoMaterialInsuficiente, Mensagem: err.Error(), Detalhes: detalhes,
		}})
	}
	return errosProducao.responder(c, err)
}

// usuarioDaRequisicao devolve o id do usuario da sessao (operador do apontamento).
func usuarioDaRequisicao(c echo.Context) int64 {
	if claims := middleware.ClaimsDoContexto(c); claims != nil {
		return claims.UsuarioID
	}
	return 0
}

// detalhe responde a OP; o custo so sai para quem tem producao.custos.
func (h *ProducaoHandler) detalhe(c echo.Context, id int64, status int) error {
	verCustos, err := middleware.TemPermissao(c, acesso.ProducaoCustos)
	if err != nil {
		slog.Error("falha ao conferir permissao de custos", "erro", err)
	}
	d, err := h.servico.BuscarDetalhe(c.Request().Context(), id, verCustos)
	if err != nil {
		return h.responder(c, err)
	}
	d.ProdutoFotoURL = miniaturas(c, h.fotos, arquivo.EntidadeProduto, []int64{d.ProdutoAcabadoID})[d.ProdutoAcabadoID]
	ids := make([]int64, len(d.Reservas))
	for i := range d.Reservas {
		ids[i] = d.Reservas[i].PartePecaID
	}
	urls := miniaturas(c, h.fotos, arquivo.EntidadePeca, ids)
	for i := range d.Reservas {
		d.Reservas[i].FotoURL = urls[d.Reservas[i].PartePecaID]
	}
	return c.JSON(status, httpx.RespostaSucesso{Sucesso: true, Dados: d})
}

// Listar devolve a pagina de OPs (filtros: status, etapa, busca).
func (h *ProducaoHandler) Listar(c echo.Context) error {
	params, err := consulta.AnalisarComStatus(c.QueryParams(), producao.ColunasOrdenaveis, "data_conclusao_prevista", producao.StatusPermitidos)
	if err != nil {
		return erroRequisicaoInvalida(c, err.Error())
	}
	etapa := c.QueryParam("etapa")
	if etapa != "" && !slices.Contains(producao.Etapas, etapa) {
		return erroRequisicaoInvalida(c, "etapa invalida")
	}
	itens, total, err := h.servico.Listar(c.Request().Context(), params, etapa)
	if err != nil {
		return h.responder(c, err)
	}
	return httpx.Lista(c, itens, httpx.NovaPaginacao(params.Pagina, params.Limite, total))
}

// Obter devolve o detalhe de uma OP.
func (h *ProducaoHandler) Obter(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da OP deve ser numerico")
	}
	return h.detalhe(c, id, http.StatusOK)
}

// GerarOP cria a OP de um item de pedido de venda.
func (h *ProducaoHandler) GerarOP(c echo.Context) error {
	var req struct {
		ItemPedidoVendaID int64 `json:"item_pedido_venda_id"`
	}
	if err := c.Bind(&req); err != nil || req.ItemPedidoVendaID <= 0 {
		return erroRequisicaoInvalida(c, "Informe item_pedido_venda_id")
	}
	d, err := h.servico.GerarOP(c.Request().Context(), req.ItemPedidoVendaID, autorDaRequisicao(c))
	if err != nil {
		return h.responder(c, err)
	}
	return h.detalhe(c, d.ID, http.StatusCreated)
}

// acao roda uma operacao sobre a OP e devolve o detalhe atualizado.
func (h *ProducaoHandler) acao(c echo.Context, f func(id int64) error) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da OP deve ser numerico")
	}
	if err := f(id); err != nil {
		return h.responder(c, err)
	}
	return h.detalhe(c, id, http.StatusOK)
}

// Liberar reserva o material e poe a OP no Kanban.
func (h *ProducaoHandler) Liberar(c echo.Context) error {
	return h.acao(c, func(id int64) error { return h.servico.Liberar(c.Request().Context(), id, autorDaRequisicao(c)) })
}

// Cancelar cancela a OP.
func (h *ProducaoHandler) Cancelar(c echo.Context) error {
	return h.acao(c, func(id int64) error { return h.servico.Cancelar(c.Request().Context(), id, autorDaRequisicao(c)) })
}

// IniciarApontamento abre um apontamento do usuario da sessao.
func (h *ProducaoHandler) IniciarApontamento(c echo.Context) error {
	var req struct {
		CentroTrabalhoID int64  `json:"centro_trabalho_id"`
		Observacoes      string `json:"observacoes"`
	}
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	return h.acao(c, func(id int64) error {
		return h.servico.IniciarApontamento(c.Request().Context(), id, req.CentroTrabalhoID, usuarioDaRequisicao(c), req.Observacoes)
	})
}

// EncerrarApontamento fecha o apontamento em andamento.
func (h *ProducaoHandler) EncerrarApontamento(c echo.Context) error {
	var req struct {
		Observacoes string `json:"observacoes"`
	}
	_ = c.Bind(&req)
	deOutros, err := middleware.TemPermissao(c, acesso.ProducaoCancelar)
	if err != nil {
		return h.responder(c, err)
	}
	return h.acao(c, func(id int64) error {
		return h.servico.EncerrarApontamento(c.Request().Context(), id, usuarioDaRequisicao(c), deOutros, req.Observacoes)
	})
}

// Avancar leva a OP a proxima etapa (ou conclui).
func (h *ProducaoHandler) Avancar(c echo.Context) error {
	return h.acao(c, func(id int64) error {
		return h.servico.Avancar(c.Request().Context(), id, usuarioDaRequisicao(c), autorDaRequisicao(c))
	})
}

// Kanban devolve as OPs liberadas.
func (h *ProducaoHandler) Kanban(c echo.Context) error {
	ops, err := h.servico.Kanban(c.Request().Context())
	if err != nil {
		return h.responder(c, err)
	}
	ids := make([]int64, len(ops))
	for i := range ops {
		ids[i] = ops[i].ProdutoAcabadoID
	}
	urls := miniaturas(c, h.fotos, arquivo.EntidadeProduto, ids)
	for i := range ops {
		ops[i].ProdutoFotoURL = urls[ops[i].ProdutoAcabadoID]
	}
	return httpx.OK(c, ops)
}

// RegistrarTeste grava o resultado de teste de uma unidade.
func (h *ProducaoHandler) RegistrarTeste(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da serie deve ser numerico")
	}
	var req struct {
		Aprovado  *bool  `json:"aprovado"`
		Resultado string `json:"resultado"`
	}
	if err := c.Bind(&req); err != nil || req.Aprovado == nil {
		return erroRequisicaoInvalida(c, "Informe aprovado (true/false) e o resultado")
	}
	if err := h.servico.RegistrarTeste(c.Request().Context(), id, *req.Aprovado, req.Resultado, usuarioDaRequisicao(c)); err != nil {
		return h.responder(c, err)
	}
	return httpx.SemConteudo(c)
}

// RegistrarMetrologia grava a metrologia de uma unidade.
func (h *ProducaoHandler) RegistrarMetrologia(c echo.Context) error {
	id, err := idDaRota(c)
	if err != nil {
		return erroRequisicaoInvalida(c, "O identificador da serie deve ser numerico")
	}
	var req struct {
		NumeroAprovacaoModelo string     `json:"numero_aprovacao_modelo"`
		DataVerificacao       tempo.Data `json:"data_verificacao"`
		NumeroLacre           string     `json:"numero_lacre"`
		Validade              tempo.Data `json:"validade"`
		Observacoes           string     `json:"observacoes"`
	}
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	m := producao.Metrologia{
		NumeroAprovacaoModelo: req.NumeroAprovacaoModelo, DataVerificacao: req.DataVerificacao,
		NumeroLacre: req.NumeroLacre, Validade: req.Validade, Observacoes: req.Observacoes,
	}
	if err := h.servico.RegistrarMetrologia(c.Request().Context(), id, m, autorDaRequisicao(c)); err != nil {
		return h.responder(c, err)
	}
	return httpx.SemConteudo(c)
}

// Rastreabilidade devolve a ficha as-built de uma unidade.
func (h *ProducaoHandler) Rastreabilidade(c echo.Context) error {
	f, err := h.servico.FichaAsBuilt(c.Request().Context(), c.Param("numero"))
	if err != nil {
		return h.responder(c, err)
	}
	return httpx.OK(c, f)
}

// Vencimentos lista verificacoes metrologicas vencidas ou a vencer.
func (h *ProducaoHandler) Vencimentos(c echo.Context) error {
	dias, _ := strconv.Atoi(c.QueryParam("dias"))
	lista, err := h.servico.VencimentosMetrologia(c.Request().Context(), dias)
	if err != nil {
		return h.responder(c, err)
	}
	return httpx.OK(c, lista)
}
