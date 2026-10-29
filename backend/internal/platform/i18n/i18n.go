// Package i18n traduz as mensagens que a API devolve ao usuario. O idioma vem
// do cabecalho Accept-Language (o frontend o envia a partir da preferencia do
// usuario); portugues e o idioma de origem de todas as mensagens do codigo, e
// por isso funciona como chave: o dicionario mapeia o texto em portugues para
// o texto no idioma pedido. Sem traducao cadastrada, a mensagem sai em
// portugues -- nunca vazia nem quebrada.
package i18n

import (
	"fmt"
	"regexp"
	"strings"
	"sync"

	"github.com/labstack/echo/v4"
)

// Idiomas suportados. Os valores sao os mesmos gravados em usuarios.idioma.
const (
	PortuguesBR = "pt-BR"
	Espanhol    = "es"
)

// Padrao e o idioma de origem das mensagens.
const Padrao = PortuguesBR

// Validos lista os idiomas aceitos em usuarios.idioma.
var Validos = []string{PortuguesBR, Espanhol}

const chaveContexto = "pcp.idioma"

// Normalizar devolve um idioma suportado: qualquer variante de espanhol
// ("es", "es-AR", "es_MX") vira "es"; o resto cai no padrao.
func Normalizar(valor string) string {
	v := strings.ToLower(strings.TrimSpace(valor))
	if v == "es" || strings.HasPrefix(v, "es-") || strings.HasPrefix(v, "es_") {
		return Espanhol
	}
	return PortuguesBR
}

// DeAcceptLanguage escolhe o idioma pelo primeiro item do cabecalho
// Accept-Language ("es-AR,es;q=0.9,pt;q=0.8" -> "es").
func DeAcceptLanguage(cabecalho string) string {
	primeiro := strings.TrimSpace(strings.Split(cabecalho, ",")[0])
	primeiro = strings.TrimSpace(strings.Split(primeiro, ";")[0])
	return Normalizar(primeiro)
}

// Middleware grava o idioma da requisicao no contexto do Echo.
func Middleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set(chaveContexto, DeAcceptLanguage(c.Request().Header.Get("Accept-Language")))
			return next(c)
		}
	}
}

// Idioma devolve o idioma da requisicao (padrao quando o middleware nao rodou).
func Idioma(c echo.Context) string {
	if v, ok := c.Get(chaveContexto).(string); ok && v != "" {
		return v
	}
	return Padrao
}

// T traduz a mensagem para o idioma da requisicao.
func T(c echo.Context, mensagem string) string {
	return Traduzir(Idioma(c), mensagem)
}

// dicionarios: idioma -> texto em portugues -> traducao.
var (
	mu           sync.RWMutex
	dicionarios  = map[string]map[string]string{}
	modelos      = map[string][]modelo{}
	verbo        = regexp.MustCompile(`%[sdvq]`)
	verboNumeros = regexp.MustCompile(`%d`)
)

// modelo e uma mensagem com valores variaveis ("%s", "%d", "%v"): casa por
// expressao regular e remonta a traducao com os valores capturados.
type modelo struct {
	re         *regexp.Regexp
	traducao   string
	nVariaveis int
}

// Registrar acrescenta traducoes ao idioma. Chaves com %s, %d ou %v sao
// modelos: "o produto %s nao existe" casa com qualquer valor no lugar de %s, e
// a traducao ("el producto %s no existe") recebe os mesmos valores, na ordem.
func Registrar(idioma string, traducoes map[string]string) {
	mu.Lock()
	defer mu.Unlock()
	d := dicionarios[idioma]
	if d == nil {
		d = map[string]string{}
		dicionarios[idioma] = d
	}
	for pt, trad := range traducoes {
		if !verbo.MatchString(pt) {
			d[pt] = trad
			continue
		}
		partes := verbo.Split(pt, -1)
		var sb strings.Builder
		sb.WriteString("^")
		for i, parte := range partes {
			sb.WriteString(regexp.QuoteMeta(parte))
			if i < len(partes)-1 {
				sb.WriteString("(.+?)")
			}
		}
		sb.WriteString("$")
		modelos[idioma] = append(modelos[idioma], modelo{
			re: regexp.MustCompile(sb.String()), traducao: trad, nVariaveis: len(partes) - 1,
		})
	}
}

// Traduzir devolve a mensagem no idioma pedido, ou a original (portugues)
// quando o idioma e o padrao ou nao ha traducao cadastrada.
func Traduzir(idioma, mensagem string) string {
	if idioma == "" || idioma == Padrao || mensagem == "" {
		return mensagem
	}
	mu.RLock()
	defer mu.RUnlock()
	return traduzir(idioma, mensagem)
}

// traduzir exige mu travado para leitura.
func traduzir(idioma, mensagem string) string {
	if trad, ok := dicionarios[idioma][mensagem]; ok {
		return trad
	}
	for _, m := range modelos[idioma] {
		achados := m.re.FindStringSubmatch(mensagem)
		if achados == nil {
			continue
		}
		args := make([]any, 0, m.nVariaveis)
		for _, a := range achados[1:] {
			// Um valor capturado pode ser, ele mesmo, uma mensagem conhecida
			// (erro com causa: "falha: <causa>"): traduz tambem.
			args = append(args, traduzir(idioma, a))
		}
		// Os valores capturados sao texto: todo verbo vira %s.
		return fmt.Sprintf(verbo.ReplaceAllString(m.traducao, "%s"), args...)
	}
	return mensagem
}

// Faltantes devolve, para testes de completude, as chaves de `origem` que
// ainda nao tem traducao no idioma.
func Faltantes(idioma string, origem []string) []string {
	mu.RLock()
	defer mu.RUnlock()
	var faltam []string
	for _, pt := range origem {
		if _, ok := dicionarios[idioma][pt]; !ok {
			faltam = append(faltam, pt)
		}
	}
	return faltam
}
