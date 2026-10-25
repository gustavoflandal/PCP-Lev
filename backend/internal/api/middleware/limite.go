package middleware

import (
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"
)

// expiracaoDoBalde e por quanto tempo um cliente inativo continua com o seu
// balde de fichas em memoria antes de ser descartado.
const expiracaoDoBalde = 3 * time.Minute

// LimiteDeRequisicoes aplica o teto global por cliente (doc 0, secao 4.7.6:
// "rate limiting por endpoint e por usuario"). O cliente e usuario + IP
// quando ha um token valido -- operadores atras do mesmo NAT da fabrica nao
// dividem balde, e uma conta generica aberta em varios terminais tambem nao
// -- e so o IP caso contrario. porSegundo <= 0 desliga o limite.
func LimiteDeRequisicoes(porSegundo, rajada int, tokens *auth.ServicoToken) echo.MiddlewareFunc {
	if porSegundo <= 0 {
		return semLimite
	}
	retryAfter := esperaEmSegundos(float64(porSegundo))
	return echomw.RateLimiterWithConfig(echomw.RateLimiterConfig{
		Store: echomw.NewRateLimiterMemoryStoreWithConfig(echomw.RateLimiterMemoryStoreConfig{
			Rate: rate.Limit(porSegundo), Burst: rajada, ExpiresIn: expiracaoDoBalde,
		}),
		IdentifierExtractor: func(c echo.Context) (string, error) {
			if usuario := usuarioDoToken(c, tokens); usuario != "" {
				return "u:" + usuario + "@" + c.RealIP(), nil
			}
			return "ip:" + c.RealIP(), nil
		},
		DenyHandler: func(c echo.Context, _ string, _ error) error {
			return negar(c, retryAfter, "Muitas requisicoes em pouco tempo. Aguarde alguns segundos e tente de novo.")
		},
	})
}

// LimiteDeLogin protege POST /auth/login contra forca bruta, por IP. E o
// unico freio enquanto nao existe bloqueio de conta por tentativas invalidas
// (doc 0, secao 4.7.3 -- entra com o RBAC novo da Fase 2.2).
//
// So tentativas que FALHARAM (401) gastam ficha: na troca de turno, dezenas
// de operadores entrando certo pelo mesmo IP (NAT, terminal compartilhado)
// nao podem ficar presos atras de um limite feito para senha errada. Por
// isso nao usa o RateLimiter do Echo, que consome a ficha antes do handler.
// porMinuto <= 0 desliga o limite.
func LimiteDeLogin(porMinuto int) echo.MiddlewareFunc {
	if porMinuto <= 0 {
		return semLimite
	}
	porSegundo := float64(porMinuto) / 60
	baldes := &baldesDeFalha{limite: rate.Limit(porSegundo), rajada: porMinuto, itens: map[string]*balde{}}
	retryAfter := esperaEmSegundos(porSegundo)

	return func(proximo echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			chave := c.RealIP()
			// A ficha e reservada ANTES do handler e devolvida se o login nao
			// falhou: conferir e so gastar depois deixava dezenas de tentativas
			// simultaneas passarem enquanto o bcrypt da primeira rodava.
			if !baldes.reservar(chave) {
				return negar(c, retryAfter, "Muitas tentativas de login. Aguarde um minuto e tente de novo.")
			}
			err := proximo(c)
			if c.Response().Status != http.StatusUnauthorized {
				baldes.devolver(chave)
			}
			return err
		}
	}
}

// balde e um token bucket com devolucao (o rate.Limiter nao devolve uma ficha
// ja consumida de imediato).
type balde struct {
	fichas     float64
	atualizado time.Time
	visto      time.Time
}

// baldesDeFalha guarda um balde por IP. Baldes parados ha mais de
// expiracaoDoBalde sao descartados na varredura, feita no maximo uma vez por
// minuto para nao percorrer o mapa a cada requisicao.
type baldesDeFalha struct {
	mu        sync.Mutex
	limite    rate.Limit
	rajada    int
	itens     map[string]*balde
	varridoEm time.Time
}

func (b *baldesDeFalha) obter(chave string, agora time.Time) *balde {
	if agora.Sub(b.varridoEm) > time.Minute {
		for k, v := range b.itens {
			if agora.Sub(v.visto) > expiracaoDoBalde {
				delete(b.itens, k)
			}
		}
		b.varridoEm = agora
	}
	item, ok := b.itens[chave]
	if !ok {
		item = &balde{fichas: float64(b.rajada), atualizado: agora}
		b.itens[chave] = item
	}
	item.fichas = math.Min(float64(b.rajada), item.fichas+agora.Sub(item.atualizado).Seconds()*float64(b.limite))
	item.atualizado = agora
	item.visto = agora
	return item
}

// reservar tira uma ficha se houver (atomico: tentativas simultaneas nao
// passam todas pela mesma ficha).
func (b *baldesDeFalha) reservar(chave string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	item := b.obter(chave, time.Now())
	if item.fichas < 1 {
		return false
	}
	item.fichas--
	return true
}

// devolver repoe a ficha de uma tentativa que nao falhou.
func (b *baldesDeFalha) devolver(chave string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	item := b.obter(chave, time.Now())
	item.fichas = math.Min(float64(b.rajada), item.fichas+1)
}

func negar(c echo.Context, retryAfter int, mensagem string) error {
	c.Response().Header().Set("Retry-After", strconv.Itoa(retryAfter))
	return httpx.Erro(c, http.StatusTooManyRequests, httpx.CodigoLimiteExcedido, mensagem)
}

// usuarioDoToken devolve o usuario de um Bearer valido, ou "" -- um token
// invalido ou expirado nao pode servir para escapar do limite por IP.
func usuarioDoToken(c echo.Context, tokens *auth.ServicoToken) string {
	cabecalho := c.Request().Header.Get(echo.HeaderAuthorization)
	if tokens == nil || !strings.HasPrefix(cabecalho, prefixoBearer) {
		return ""
	}
	claims, err := tokens.Validar(strings.TrimSpace(cabecalho[len(prefixoBearer):]))
	if err != nil {
		return ""
	}
	return claims.Username
}

// esperaEmSegundos e o tempo para uma ficha nova entrar no balde,
// arredondado para cima (Retry-After so aceita segundos inteiros).
func esperaEmSegundos(porSegundo float64) int {
	return int(math.Ceil(1 / porSegundo))
}

func semLimite(proximo echo.HandlerFunc) echo.HandlerFunc { return proximo }
