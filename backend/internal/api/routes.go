// Package api monta o roteador HTTP da aplicacao.
package api

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/config"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cotacao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

// Dependencias reune tudo que os handlers precisam.
type Dependencias struct {
	Cfg    *config.Config
	Pool   *pgxpool.Pool
	Tokens *auth.ServicoToken
}

// NovoRoteador constroi o Echo com middlewares globais e todas as rotas.
func NovoRoteador(dep Dependencias) *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.HTTPErrorHandler = tratarErro

	e.Use(echomw.Recover())
	e.Use(echomw.RequestID())
	e.Use(middleware.Log())
	e.Use(echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins: dep.Cfg.CorsOrigens,
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut,
			http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType,
			echo.HeaderAccept, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))

	v1 := e.Group("/api/v1")

	v1.GET("/saude", func(c echo.Context) error {
		if err := dep.Pool.Ping(c.Request().Context()); err != nil {
			return httpx.Erro(c, http.StatusServiceUnavailable, "INDISPONIVEL",
				"Banco de dados indisponivel")
		}
		return httpx.OK(c, map[string]string{"status": "ok", "ambiente": dep.Cfg.APIEnv})
	})

	autenticacao := middleware.Autenticacao(dep.Tokens)

	registrarAutenticacao(v1, dep)
	registrarCadastros(v1, dep, autenticacao)
	registrarCompras(v1, dep, autenticacao)

	return e
}

func registrarAutenticacao(v1 *echo.Group, dep Dependencias) {
	servico := auth.NovoServicoAutenticacao(usuarioRepo(dep), dep.Tokens)
	handler := handlers.NovoAuthHandler(servico)

	v1.POST("/auth/login", handler.Login)
	protegida := middleware.Autenticacao(dep.Tokens)
	v1.GET("/auth/eu", handler.Eu, protegida)
	v1.POST("/auth/trocar-senha", handler.TrocarSenha, protegida)
}

// registrarCadastros publica os modulos de cadastro base (RF1).
func registrarCadastros(v1 *echo.Group, dep Dependencias, autenticacao echo.MiddlewareFunc) {
	handlers.NovoProdutoHandler(
		produto.NovoServico(repository.NovoProdutoRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	handlers.NovoPecaHandler(
		peca.NovoServico(repository.NovoPecaRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	handlers.NovoFornecedorHandler(
		fornecedor.NovoServico(repository.NovoFornecedorRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)
}

// registrarCompras publica os modulos de cotacoes e pedidos de compra (RF3).
func registrarCompras(v1 *echo.Group, dep Dependencias, autenticacao echo.MiddlewareFunc) {
	estoqueServico := estoque.NovoServico(repository.NovoEstoqueRepositorio(dep.Pool))
	pedidoServico := pedidocompra.NovoServico(repository.NovoPedidoCompraRepositorio(dep.Pool), estoqueServico)
	cotacaoServico := cotacao.NovoServico(repository.NovoCotacaoRepositorio(dep.Pool))

	handlers.NovoCotacaoHandler(cotacaoServico, pedidoServico).Registrar(v1, autenticacao)
	handlers.NovoPedidoCompraHandler(pedidoServico).Registrar(v1, autenticacao)
}

// tratarErro garante que qualquer erro nao tratado saia no envelope do doc 3,
// e nao no formato padrao do Echo.
func tratarErro(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}

	status := http.StatusInternalServerError
	codigo := httpx.CodigoErroInterno
	mensagem := "Erro interno do servidor"

	if erroHTTP, ok := err.(*echo.HTTPError); ok {
		status = erroHTTP.Code
		switch status {
		case http.StatusNotFound:
			codigo, mensagem = httpx.CodigoNaoEncontrado, "Recurso nao encontrado"
		case http.StatusMethodNotAllowed:
			codigo, mensagem = httpx.CodigoRequisicaoInvalida, "Metodo nao permitido"
		case http.StatusBadRequest:
			codigo, mensagem = httpx.CodigoRequisicaoInvalida, "Requisicao invalida"
		}
	}

	_ = httpx.Erro(c, status, codigo, mensagem)
}
