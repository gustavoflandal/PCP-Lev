// Package api monta o roteador HTTP da aplicacao.
package api

import (
	"net/http"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/config"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/arquivo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auditoria"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/banco"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/centrotrabalho"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cliente"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cotacao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/email"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/empresa"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/necessidadecompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/negocio"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/notaentrada"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/painel"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidovenda"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/producao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/rastreio"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/smtp"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/cripto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/i18n"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

// Dependencias reune tudo que os handlers precisam.
type Dependencias struct {
	Cfg    *config.Config
	Pool   *pgxpool.Pool
	Tokens *auth.ServicoToken
	// Cofre cifra segredos de terceiros (senha SMTP); nil quando a chave
	// mestra nao foi configurada.
	Cofre *cripto.Cofre
}

// NovoRoteador constroi o Echo com middlewares globais e todas as rotas.
func NovoRoteador(dep Dependencias) *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.HTTPErrorHandler = tratarErro
	// O extrator padrao do Echo le X-Forwarded-For/X-Real-IP de qualquer
	// origem -- qualquer cliente forjaria o cabecalho e a auditoria gravaria
	// um IP falso. Aqui, o XFF so e aceito quando o hop imediato (RemoteAddr)
	// e loopback, link-local ou rede privada: cobre o nginx do
	// docker-compose.yml, que fala com a API pela rede Docker (172.x/RFC1918),
	// e ignora o cabecalho quando a requisicao chega direto da internet.
	// Vale para toda a aplicacao -- c.RealIP() e usado tanto pela auditoria
	// (middleware.ConexaoDeAuditoria) quanto pelo log estruturado
	// (middleware.Log).
	e.IPExtractor = echo.ExtractIPFromXFFHeader(
		echo.TrustLoopback(true),
		echo.TrustLinkLocal(true),
		echo.TrustPrivateNet(true),
	)

	e.Use(echomw.Recover())
	e.Use(echomw.RequestID())
	e.Use(middleware.Log())
	// Idioma da resposta (Accept-Language): antes do limitador e da autorizacao,
	// para que os erros deles tambem saiam no idioma do usuario.
	e.Use(i18n.Middleware())
	// Cabecalhos de seguranca (doc 0, secao 4.7.6). A API so devolve JSON,
	// CSV e imagens -- nada dela deve ser interpretado como documento, entao a
	// CSP nega tudo. HSTS so sai quando a requisicao chegou por HTTPS (o Echo
	// confere TLS ou X-Forwarded-Proto). X-XSS-Protection fica de fora de
	// proposito: o filtro legado dos navegadores foi removido e o cabecalho
	// so introduzia vulnerabilidades.
	e.Use(echomw.SecureWithConfig(echomw.SecureConfig{
		ContentTypeNosniff:    "nosniff",
		XFrameOptions:         "DENY",
		HSTSMaxAge:            31536000,
		ContentSecurityPolicy: "default-src 'none'; frame-ancestors 'none'",
		ReferrerPolicy:        "same-origin",
	}))
	// O upload de logotipo/favicon (base64 no corpo JSON) e o unico endpoint
	// hoje que aceita um payload potencialmente grande -- sem um limite, um
	// arquivo enorme e lido inteiro para memoria (aqui e no navegador, via
	// FileReader) antes de qualquer validacao de tamanho rodar. 2 MiB cobre
	// folgado o maior upload valido (1 MiB de imagem em base64 fica ~1.4 MiB)
	// e nao aperta nenhum outro endpoint, que so trafega JSON de formulario.
	// O upload de arquivos (/arquivos, ate 25 MB de PDF) tem limite proprio,
	// aplicado no handler (http.MaxBytesReader); o resto segue em 2 MiB.
	e.Use(echomw.BodyLimitWithConfig(echomw.BodyLimitConfig{
		Limit: "2M",
		Skipper: func(c echo.Context) bool {
			caminho := c.Request().URL.Path
			return c.Request().Method == http.MethodPost &&
				(caminho == "/api/v1/arquivos" || caminho == "/api/v1/notas-entrada/importar-xml")
		},
	}))
	e.Use(echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins: dep.Cfg.CorsOrigens,
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut,
			http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType,
			echo.HeaderAccept, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))
	// Depois do CORS (um 429 precisa dos cabecalhos CORS para o navegador
	// deixar o frontend ler a mensagem, e o preflight OPTIONS e respondido
	// antes, sem gastar ficha) e antes de ConexaoDeAuditoria (uma requisicao
	// recusada nao chega a ocupar conexao do pool).
	e.Use(middleware.LimiteDeRequisicoes(dep.Cfg.RateLimitRPS, dep.Cfg.RateLimitRajada, dep.Tokens))
	// Global (nao por rota): fixa a conexao que os repositorios usam durante
	// toda a requisicao, para que os triggers de auditoria (migration 007)
	// vejam o usuario/IP corretos -- ver middleware.ConexaoDeAuditoria.
	e.Use(middleware.ConexaoDeAuditoria(dep.Pool, dep.Tokens))
	// RBAC (Fase 2.2a): toda rota com ExigirPermissao resolve as permissoes
	// do perfil por este servico (cache em memoria).
	acessoServico := acesso.NovoServico(repository.NovoAcessoRepositorio(dep.Pool))
	e.Use(middleware.Autorizacao(acessoServico))

	v1 := e.Group("/api/v1")

	v1.GET("/saude", func(c echo.Context) error {
		if err := dep.Pool.Ping(c.Request().Context()); err != nil {
			return httpx.Erro(c, http.StatusServiceUnavailable, httpx.CodigoIndisponivel,
				"Banco de dados indisponivel")
		}
		return httpx.OK(c, map[string]string{"status": "ok", "ambiente": dep.Cfg.APIEnv})
	})

	autenticacao := middleware.Autenticacao(dep.Tokens)

	// Arquivos e anexos (v1.2): fotos e documentos; as miniaturas aparecem nas
	// listas de pecas, produtos, estoque e na OP.
	arquivoServico := arquivo.NovoServico(repository.NovoArquivoRepositorio(dep.Pool), arquivo.NovoAssinador(dep.Cfg.JWTSecret))
	handlers.NovoArquivoHandler(arquivoServico).Registrar(v1, autenticacao)

	registrarAutenticacao(v1, dep, acessoServico)
	registrarCadastros(v1, dep, autenticacao, arquivoServico)
	estoqueServico := registrarEstoque(v1, dep, autenticacao, arquivoServico)
	registrarCompras(v1, dep, autenticacao, estoqueServico)
	registrarConfiguracoes(v1, dep, autenticacao, acessoServico)
	registrarProducao(v1, dep, autenticacao, arquivoServico)
	// Recebimento fiscal (v1.2): a unica entrada de insumo comprado (RN-001).
	handlers.NovoNotaEntradaHandler(
		notaentrada.NovoServico(repository.NovoNotaEntradaRepositorio(dep.Pool)),
	).ComFotos(arquivoServico).Registrar(v1, autenticacao)
	handlers.NovoRastreioHandler(rastreio.NovoServico(repository.NovoRastreioRepositorio(dep.Pool))).Registrar(v1, autenticacao)
	// Paineis (dashboards) por setor, cada um com a sua permissao.
	handlers.NovoPainelHandler(painel.NovoServico(repository.NovoPainelRepositorio(dep.Pool))).Registrar(v1, autenticacao)

	return e
}

func registrarAutenticacao(v1 *echo.Group, dep Dependencias, permissoes handlers.ListadorDePermissoes) {
	servico := auth.NovoServicoAutenticacao(usuarioRepo(dep), dep.Tokens)
	handler := handlers.NovoAuthHandler(servico, permissoes)

	v1.POST("/auth/login", handler.Login, middleware.LimiteDeLogin(dep.Cfg.RateLimitLoginPorMinuto))
	protegida := middleware.Autenticacao(dep.Tokens)
	v1.GET("/auth/eu", handler.Eu, protegida)
	v1.POST("/auth/trocar-senha", handler.TrocarSenha, protegida)
	v1.PUT("/auth/preferencias", handler.AtualizarPreferencias, protegida)
}

// registrarCadastros publica os modulos de cadastro base (RF1).
func registrarCadastros(v1 *echo.Group, dep Dependencias, autenticacao echo.MiddlewareFunc, arquivos *arquivo.Servico) {
	handlers.NovoProdutoHandler(
		produto.NovoServico(repository.NovoProdutoRepositorio(dep.Pool)),
	).ComFotos(arquivos).Registrar(v1, autenticacao)

	handlers.NovoPecaHandler(
		peca.NovoServico(repository.NovoPecaRepositorio(dep.Pool)),
	).ComFotos(arquivos).Registrar(v1, autenticacao)

	handlers.NovoFornecedorHandler(
		fornecedor.NovoServico(repository.NovoFornecedorRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	handlers.NovoClienteHandler(
		cliente.NovoServico(repository.NovoClienteRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	handlers.NovoCentroTrabalhoHandler(
		centrotrabalho.NovoServico(repository.NovoCentroTrabalhoRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	handlers.NovoEstruturaHandler(
		estrutura.NovoServico(repository.NovoEstruturaRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)
}

// registrarEstoque publica o modulo de estoque (RF6) e devolve o servico
// montado para ser reaproveitado por outros modulos (ex.: recebimento de PC).
func registrarEstoque(v1 *echo.Group, dep Dependencias, autenticacao echo.MiddlewareFunc, arquivos *arquivo.Servico) *estoque.Servico {
	estoqueServico := estoque.NovoServico(repository.NovoEstoqueRepositorio(dep.Pool))
	handlers.NovoEstoqueHandler(estoqueServico).ComFotos(arquivos).Registrar(v1, autenticacao)
	return estoqueServico
}

// registrarCompras publica os modulos de cotacoes e pedidos de compra (RF3).
// Recebe o estoqueServico ja montado por registrarEstoque para que exista
// apenas uma instancia de estoque.Servico compartilhada por requisicao de boot.
func registrarCompras(v1 *echo.Group, dep Dependencias, autenticacao echo.MiddlewareFunc, estoqueServico *estoque.Servico) {
	pedidoServico := pedidocompra.NovoServico(repository.NovoPedidoCompraRepositorio(dep.Pool), estoqueServico,
		negocio.NovoServico(repository.NovoNegocioRepositorio(dep.Pool)))
	cotacaoServico := cotacao.NovoServico(repository.NovoCotacaoRepositorio(dep.Pool))

	handlers.NovoCotacaoHandler(cotacaoServico, pedidoServico).Registrar(v1, autenticacao)
	handlers.NovoPedidoCompraHandler(pedidoServico).Registrar(v1, autenticacao)

	handlers.NovoNecessidadeCompraHandler(
		necessidadecompra.NovoServico(repository.NovoNecessidadeCompraRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)
}

// registrarProducao publica pedidos de venda e producao (Fase 3).
func registrarProducao(v1 *echo.Group, dep Dependencias, autenticacao echo.MiddlewareFunc, arquivos *arquivo.Servico) {
	handlers.NovoPedidoVendaHandler(
		pedidovenda.NovoServico(repository.NovoPedidoVendaRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)
	handlers.NovoProducaoHandler(
		producao.NovoServico(repository.NovoProducaoRepositorio(dep.Pool)),
	).ComFotos(arquivos).Registrar(v1, autenticacao)
}

// registrarConfiguracoes publica o modulo de configuracoes do sistema (doc 0,
// secao 4.6). A leitura de /configuracoes/empresa fica publica dentro do
// proprio handler -- a tela de login e o favicon do navegador precisam dela
// antes de qualquer sessao existir.
func registrarConfiguracoes(v1 *echo.Group, dep Dependencias, autenticacao echo.MiddlewareFunc, acessoServico *acesso.Servico) {
	handlers.NovoAcessoHandler(acessoServico).Registrar(v1, autenticacao)
	handlers.NovoUsuarioHandler(
		usuario.NovoServicoGestao(repository.NovoUsuarioRepositorio(dep.Pool), acessoServico), acessoServico,
	).Registrar(v1, autenticacao)

	handlers.NovoEmpresaHandler(
		empresa.NovoServico(repository.NovoEmpresaRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	handlers.NovoAuditoriaHandler(
		auditoria.NovoServico(repository.NovoAuditoriaRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	handlers.NovoRegionalHandler(
		regional.NovoServico(repository.NovoRegionalRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	handlers.NovoNegocioHandler(
		negocio.NovoServico(repository.NovoNegocioRepositorio(dep.Pool)),
	).Registrar(v1, autenticacao)

	// Interface nil de verdade quando nao ha chave mestra: um *cripto.Cofre
	// nil embrulhado em email.Cifrador seria uma interface NAO nil, e o
	// servico tentaria cifrar com ele.
	var cifrador email.Cifrador
	if dep.Cofre != nil {
		cifrador = dep.Cofre
	}
	handlers.NovoEmailHandler(
		email.NovoServico(repository.NovoEmailRepositorio(dep.Pool), cifrador, smtp.NovoEnviador()),
	).Registrar(v1, autenticacao)

	handlers.NovoBancoHandler(
		banco.NovoServico(repository.NovoBancoRepositorio(dep.Pool), dep.Cfg.DBHost, dep.Cfg.DBPort),
	).Registrar(v1, autenticacao)
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
		case http.StatusRequestEntityTooLarge:
			// Devolvido pelo middleware BodyLimit (ver NovoRoteador) antes de
			// qualquer handler rodar -- sem este caso, o cliente veria
			// "Erro interno do servidor" para o que e, na verdade, um corpo
			// grande demais.
			codigo, mensagem = httpx.CodigoRequisicaoInvalida, "Requisicao excede o tamanho maximo permitido"
		}
	}

	_ = httpx.Erro(c, status, codigo, mensagem)
}
