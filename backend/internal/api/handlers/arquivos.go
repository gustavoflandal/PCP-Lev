package handlers

import (
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strconv"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/arquivo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/labstack/echo/v4"
)

var errosArquivo = mapaDeErros{
	{arquivo.ErrNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{arquivo.ErrAnexoNaoEncontrado, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{arquivo.ErrEntidadeInexistente, http.StatusNotFound, httpx.CodigoNaoEncontrado},
	{arquivo.ErrAssinatura, http.StatusForbidden, httpx.CodigoAcessoNegado},
	{arquivo.ErrGaleriaCheia, http.StatusConflict, httpx.CodigoConflito},
	{arquivo.ErrFotoObrigatoria, http.StatusConflict, httpx.CodigoConflito},
	{arquivo.ErrNotaImutavel, http.StatusConflict, httpx.CodigoConflito},
	{arquivo.ErrRegistroEncerrado, http.StatusConflict, httpx.CodigoConflito},
	{arquivo.ErrDimensao, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{arquivo.ErrIDArquivo, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{arquivo.ErrVersaoDeOutroRegistro, http.StatusConflict, httpx.CodigoConflito},
	{arquivo.ErrTipoNaoAceito, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{arquivo.ErrGrandeDemais, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{arquivo.ErrVazio, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{arquivo.ErrEntidadeInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{arquivo.ErrTipoAnexoInvalido, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{arquivo.ErrFotoPrecisaSerImagem, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{arquivo.ErrDocumentoPrecisaPDF, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{arquivo.ErrCategoriaInvalida, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{arquivo.ErrCamposLongos, http.StatusBadRequest, httpx.CodigoErroValidacao},
	{arquivo.ErrValidadeAntesEmissao, http.StatusBadRequest, httpx.CodigoErroValidacao},
}

// permissoesDeAnexo: quem ve e quem altera os anexos de cada entidade -- as
// mesmas permissoes da tela do registro.
var permissoesDeAnexo = map[string][2]string{
	arquivo.EntidadeProduto:       {acesso.ProdutosVisualizar, acesso.ProdutosEditar},
	arquivo.EntidadePeca:          {acesso.PecasVisualizar, acesso.PecasEditar},
	arquivo.EntidadeOrdemProducao: {acesso.ProducaoVisualizar, acesso.ProducaoApontar},
	arquivo.EntidadeFornecedor:    {acesso.FornecedoresVisualizar, acesso.FornecedoresEditar},
	arquivo.EntidadePedidoCompra:  {acesso.PedidosVisualizar, acesso.PedidosEditar},
	arquivo.EntidadePedidoVenda:   {acesso.PedidosVendaVisualizar, acesso.PedidosVendaEditar},
	arquivo.EntidadeCliente:       {acesso.ClientesVisualizar, acesso.ClientesEditar},
	arquivo.EntidadeNotaEntrada:   {acesso.NotasVisualizar, acesso.NotasLancar},
	arquivo.EntidadeLote:          {acesso.EstoqueVisualizar, acesso.NotasLancar},
}

// ArquivoHandler atende /arquivos e /anexos.
type ArquivoHandler struct {
	servico *arquivo.Servico
}

// NovoArquivoHandler cria o handler.
func NovoArquivoHandler(servico *arquivo.Servico) *ArquivoHandler {
	return &ArquivoHandler{servico: servico}
}

// Registrar publica as rotas. O conteudo e servido sem sessao, mas so por URL
// assinada (img/iframe nao mandam o cabecalho Authorization).
func (h *ArquivoHandler) Registrar(grupo *echo.Group, autenticacao echo.MiddlewareFunc) {
	grupo.POST("/arquivos", h.Enviar, autenticacao)
	grupo.GET("/arquivos/:id/url", h.URL, autenticacao)
	grupo.GET("/arquivos/:id/conteudo", h.Conteudo)

	grupo.GET("/anexos", h.Listar, autenticacao)
	grupo.GET("/anexos/vencimentos", h.Vencimentos, autenticacao)
	grupo.POST("/anexos", h.Anexar, autenticacao)
	grupo.PUT("/anexos/:id", h.Atualizar, autenticacao)
	grupo.DELETE("/anexos/:id", h.Remover, autenticacao)
}

// pode confere a permissao (ver ou alterar) dos anexos da entidade.
func (h *ArquivoHandler) pode(c echo.Context, entidade string, alterar bool) (bool, error) {
	return podeAnexo(c, entidade, alterar)
}

// podeVerArquivo: quem enviou o arquivo, ou quem pode ver alguma entidade
// que ja o usa. Vale para pedir a URL e para VINCULAR o arquivo a outro
// registro -- sem isso, quem conhece o UUID de um contrato de fornecedor o
// anexaria a um produto que pode ver e leria o contrato por ali.
func podeVerArquivo(c echo.Context, s *arquivo.Servico, id string) (bool, error) {
	entidades, enviadoPor, err := s.UsosDoArquivo(c.Request().Context(), id)
	if err != nil {
		return false, err
	}
	if enviadoPor == autorDaRequisicao(c) {
		return true, nil
	}
	for _, e := range entidades {
		if ok, err := podeAnexo(c, e, false); err != nil || ok {
			return ok, err
		}
	}
	return false, nil
}

func podeAnexo(c echo.Context, entidade string, alterar bool) (bool, error) {
	par, ok := permissoesDeAnexo[entidade]
	if !ok {
		return false, nil
	}
	if alterar {
		return middleware.TemPermissao(c, par[1])
	}
	return middleware.TemPermissao(c, par[0])
}

// algumaPermissaoDeEnvio: enviar arquivo exige poder alterar anexos de algo.
func (h *ArquivoHandler) algumaPermissaoDeEnvio(c echo.Context) (bool, error) {
	for entidade := range permissoesDeAnexo {
		pode, err := h.pode(c, entidade, true)
		if err != nil || pode {
			return pode, err
		}
	}
	return false, nil
}

func (h *ArquivoHandler) negar(c echo.Context, err error) error {
	if err != nil {
		return errosArquivo.responder(c, err)
	}
	return httpx.AcessoNegado(c, "Seu perfil nao tem permissao para estes anexos")
}

// Enviar recebe um arquivo (multipart, campo "arquivo").
func (h *ArquivoHandler) Enviar(c echo.Context) error {
	if pode, err := h.algumaPermissaoDeEnvio(c); err != nil || !pode {
		return h.negar(c, err)
	}
	c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, arquivo.LimiteUpload)
	cabecalho, err := c.FormFile("arquivo")
	if err != nil {
		var grande *http.MaxBytesError
		if errors.As(err, &grande) {
			return errosArquivo.responder(c, arquivo.ErrGrandeDemais)
		}
		return erroRequisicaoInvalida(c, "Envie o arquivo no campo 'arquivo' (multipart/form-data)")
	}
	f, err := cabecalho.Open()
	if err != nil {
		return erroRequisicaoInvalida(c, "Nao foi possivel ler o arquivo")
	}
	defer f.Close()
	conteudo, err := io.ReadAll(io.LimitReader(f, arquivo.LimiteUpload+1))
	if err != nil {
		return erroRequisicaoInvalida(c, "Nao foi possivel ler o arquivo")
	}
	a, err := h.servico.Enviar(c.Request().Context(), cabecalho.Filename, conteudo, autorDaRequisicao(c))
	if err != nil {
		return errosArquivo.responder(c, err)
	}
	return httpx.Criado(c, a)
}

// URL devolve a URL assinada (5 min) de um arquivo que o usuario pode ver.
func (h *ArquivoHandler) URL(c echo.Context) error {
	id := c.Param("id")
	permitido, err := podeVerArquivo(c, h.servico, id)
	if err != nil {
		return errosArquivo.responder(c, err)
	}
	if !permitido {
		return h.negar(c, nil)
	}
	url, expira := h.servico.Assinador().URL(id, c.QueryParam("miniatura") == "1")
	return httpx.OK(c, map[string]any{"url": url, "expira_em": expira})
}

// Conteudo serve os bytes pela URL assinada. Nada de conteudo ativo: tipo
// fixo do que foi detectado no upload, nosniff e CSP restritiva.
func (h *ArquivoHandler) Conteudo(c echo.Context) error {
	id := c.Param("id")
	mini := c.QueryParam("mini") == "1"
	if err := h.servico.Assinador().Conferir(id, c.QueryParam("exp"), c.QueryParam("sig"), mini); err != nil {
		return errosArquivo.responder(c, err)
	}
	var conteudo []byte
	tipo, nome := arquivo.MimeJPEG, "miniatura.jpg"
	if mini {
		m, err := h.servico.BuscarMiniatura(c.Request().Context(), id)
		if err != nil {
			return errosArquivo.responder(c, err)
		}
		conteudo = m
	} else {
		a, err := h.servico.BuscarArquivo(c.Request().Context(), id, true)
		if err != nil {
			return errosArquivo.responder(c, err)
		}
		conteudo, tipo, nome = a.Conteudo, a.TipoMime, a.NomeOriginal
	}
	cab := c.Response().Header()
	cab.Set("X-Content-Type-Options", "nosniff")
	cab.Set("Cache-Control", "private, max-age=300")
	cab.Set("Content-Disposition", "inline; filename*=UTF-8''"+url.PathEscape(nome))
	if tipo == arquivo.MimePDF {
		// O leitor de PDF do navegador precisa de object-src; nada de script.
		cab.Set("Content-Security-Policy", "default-src 'none'; object-src 'self'; frame-ancestors 'none'")
	} else {
		cab.Set("Content-Security-Policy", "default-src 'none'; sandbox; frame-ancestors 'none'")
	}
	if tipo == arquivo.MimeXML {
		// XML de NF-e nunca e renderizado: so baixado.
		cab.Set("Content-Disposition", "attachment; filename*=UTF-8''"+url.PathEscape(nome))
	}
	return c.Blob(http.StatusOK, tipo, conteudo)
}

func (h *ArquivoHandler) entidadeDaQuery(c echo.Context) (string, int64, bool) {
	entidade := c.QueryParam("entidade")
	id, err := strconv.ParseInt(c.QueryParam("entidade_id"), 10, 64)
	return entidade, id, err == nil && slices.Contains(arquivo.EntidadesValidas, entidade)
}

// Listar devolve os anexos de uma entidade (?entidade=&entidade_id=).
func (h *ArquivoHandler) Listar(c echo.Context) error {
	entidade, id, ok := h.entidadeDaQuery(c)
	if !ok {
		return erroRequisicaoInvalida(c, "Informe entidade e entidade_id")
	}
	if pode, err := h.pode(c, entidade, false); err != nil || !pode {
		return h.negar(c, err)
	}
	lista, err := h.servico.Listar(c.Request().Context(), entidade, id)
	if err != nil {
		return errosArquivo.responder(c, err)
	}
	return httpx.OK(c, lista)
}

// Vencimentos lista documentos vigentes vencidos ou a vencer (?dias=).
func (h *ArquivoHandler) Vencimentos(c echo.Context) error {
	// Cada entidade so entra para quem pode ver os anexos dela.
	var entidades []string
	for _, e := range []string{arquivo.EntidadeProduto, arquivo.EntidadePeca, arquivo.EntidadeFornecedor, arquivo.EntidadeCliente} {
		ver, err := h.pode(c, e, false)
		if err != nil {
			return h.negar(c, err)
		}
		if ver {
			entidades = append(entidades, e)
		}
	}
	if len(entidades) == 0 {
		return h.negar(c, nil)
	}
	dias, _ := strconv.Atoi(c.QueryParam("dias"))
	lista, err := h.servico.VencimentosDocumentos(c.Request().Context(), dias, entidades)
	if err != nil {
		return errosArquivo.responder(c, err)
	}
	return httpx.OK(c, lista)
}

type anexoRequest struct {
	Entidade           string     `json:"entidade"`
	EntidadeID         int64      `json:"entidade_id"`
	ArquivoID          string     `json:"arquivo_id"`
	Tipo               string     `json:"tipo"`
	Categoria          string     `json:"categoria"`
	Titulo             string     `json:"titulo"`
	Descricao          string     `json:"descricao"`
	Versao             string     `json:"versao"`
	DataEmissao        tempo.Data `json:"data_emissao"`
	DataValidade       tempo.Data `json:"data_validade"`
	FornecedorID       *int64     `json:"fornecedor_id"`
	EstruturaProdutoID *int64     `json:"estrutura_produto_id"`
	Principal          *bool      `json:"principal"`
	SubstituiAnexoID   *int64     `json:"substitui_anexo_id"`
}

func (r anexoRequest) dados() arquivo.DadosAnexo {
	return arquivo.DadosAnexo{
		Entidade: r.Entidade, EntidadeID: r.EntidadeID, ArquivoID: r.ArquivoID, Tipo: r.Tipo, Categoria: r.Categoria,
		Titulo: r.Titulo, Descricao: r.Descricao, Versao: r.Versao, DataEmissao: r.DataEmissao, DataValidade: r.DataValidade,
		FornecedorID: r.FornecedorID, EstruturaProdutoID: r.EstruturaProdutoID,
		Principal: r.Principal != nil && *r.Principal, ManterPrincipal: r.Principal == nil,
		SubstituiAnexoID: r.SubstituiAnexoID,
	}
}

// Anexar vincula um arquivo enviado a uma entidade.
func (h *ArquivoHandler) Anexar(c echo.Context) error {
	var req anexoRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	if pode, err := h.pode(c, req.Entidade, true); err != nil || !pode {
		return h.negar(c, err)
	}
	if arquivo.IDValido(req.ArquivoID) {
		if pode, err := podeVerArquivo(c, h.servico, req.ArquivoID); err != nil || !pode {
			return h.negar(c, err)
		}
	}
	a, err := h.servico.Anexar(c.Request().Context(), req.dados(), autorDaRequisicao(c))
	if err != nil {
		return errosArquivo.responder(c, err)
	}
	return httpx.Criado(c, a)
}

// anexoComPermissao carrega o anexo e confere que o usuario pode altera-lo.
func (h *ArquivoHandler) anexoComPermissao(c echo.Context) (*arquivo.Anexo, error) {
	id, err := idDaRota(c)
	if err != nil {
		return nil, erroRequisicaoInvalida(c, "O identificador do anexo deve ser numerico")
	}
	a, err := h.servico.BuscarAnexo(c.Request().Context(), id)
	if err != nil {
		return nil, errosArquivo.responder(c, err)
	}
	if pode, err := h.pode(c, a.Entidade, true); err != nil || !pode {
		return nil, h.negar(c, err)
	}
	return a, nil
}

// Atualizar altera metadados de um anexo.
func (h *ArquivoHandler) Atualizar(c echo.Context) error {
	atual, errResp := h.anexoComPermissao(c)
	if atual == nil {
		return errResp
	}
	var req anexoRequest
	if err := c.Bind(&req); err != nil {
		return erroRequisicaoInvalida(c, "Corpo da requisicao invalido")
	}
	a, err := h.servico.Atualizar(c.Request().Context(), atual.ID, req.dados(), autorDaRequisicao(c))
	if err != nil {
		return errosArquivo.responder(c, err)
	}
	return httpx.OK(c, a)
}

// Remover desvincula um anexo.
func (h *ArquivoHandler) Remover(c echo.Context) error {
	atual, errResp := h.anexoComPermissao(c)
	if atual == nil {
		return errResp
	}
	if err := h.servico.Remover(c.Request().Context(), atual.ID); err != nil {
		return errosArquivo.responder(c, err)
	}
	return httpx.SemConteudo(c)
}

// miniaturas devolve a URL assinada da foto principal de cada id (vazio se o
// handler foi montado sem o servico de arquivos, como nos testes antigos).
func miniaturas(c echo.Context, s *arquivo.Servico, entidade string, ids []int64) map[int64]string {
	if s == nil || len(ids) == 0 {
		return map[int64]string{}
	}
	urls, err := s.MiniaturasPrincipais(c.Request().Context(), entidade, ids)
	if err != nil {
		slog.Warn("falha ao carregar miniaturas", "entidade", entidade, "erro", err)
		return map[int64]string{}
	}
	return urls
}
