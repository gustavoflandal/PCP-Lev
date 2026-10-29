package i18n

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// temTraducao diz se o espanhol cobre a mensagem: entrada exata ou modelo.
func temTraducao(mensagem string) bool {
	mu.RLock()
	defer mu.RUnlock()
	if _, ok := dicionarios[Espanhol][mensagem]; ok {
		return true
	}
	for _, m := range modelos[Espanhol] {
		if m.re.MatchString(mensagem) {
			return true
		}
	}
	return false
}

const literal = `("(?:[^"\\\n]|\\.)*")`

var (
	reErrorsNew = regexp.MustCompile(`errors\.New\(\s*` + literal)
	reErrorf    = regexp.MustCompile(`fmt\.Errorf\(\s*` + literal)
	reBloq      = regexp.MustCompile(`bloq\([^,\n]+,\s*"[A-Z_]+",\s*` + literal)
	reSprintfMs = regexp.MustCompile(`Mensagem:\s*fmt\.Sprintf\(\s*` + literal)
	reHandlers  = []*regexp.Regexp{
		regexp.MustCompile(`erroRequisicaoInvalida\(c,\s*` + literal),
		regexp.MustCompile(`httpx\.(?:NaoAutorizado|AcessoNegado|NaoEncontrado|Conflito)\(c,\s*` + literal),
		regexp.MustCompile(`httpx\.Erro\(c,\s*[^,\n]+,\s*[^,\n]+,\s*` + literal),
		regexp.MustCompile(`OKComMensagem\(c,\s*[^,\n]+,\s*` + literal),
		regexp.MustCompile(`negar\(c,\s*retryAfter,\s*` + literal),
		regexp.MustCompile(`const MensagemUsuarioInativo = ` + literal),
		regexp.MustCompile(`codigo, mensagem = [^,\n]+,\s*` + literal),
		regexp.MustCompile(`mensagem := ` + literal),
		regexp.MustCompile(`httpx\.Erro\([^)]*CodigoTrocaDeSenha,\s*` + literal),
	}
	reFrase   = regexp.MustCompile(`"([A-Z][A-Za-z]+(?: [A-Za-z_'()/.,;:-]+)+)"`)
	reVerboGo = regexp.MustCompile(`%%|%[-+# 0-9.]*[a-zA-Z]`)
	reCSV     = regexp.MustCompile(`responderCSV\(c,\s*"[^"]*",\s*\[\]string\{([^}]*)\}`)
)

// internos: mensagens que nunca chegam ao usuario (erro de programacao ou de
// ambiente, so em log).
var internos = map[string]bool{
	"autorizador ausente no contexto -- falta middleware.Autorizacao no roteador": true,
	"%s": true, // bloq(..., "%s", Err...Error()): o erro ja esta no dicionario
}

func raizInternal(t *testing.T) string {
	t.Helper()
	raiz, err := filepath.Abs(filepath.Join("..", ".."))
	require.NoError(t, err)
	return raiz
}

// arquivosGo lista os .go (sem testes) sob as pastas relativas a internal/.
func arquivosGo(t *testing.T, pastas ...string) map[string]string {
	t.Helper()
	raiz := raizInternal(t)
	achados := map[string]string{}
	for _, pasta := range pastas {
		err := filepath.WalkDir(filepath.Join(raiz, pasta), func(caminho string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() || !strings.HasSuffix(caminho, ".go") || strings.HasSuffix(caminho, "_test.go") {
				return nil
			}
			dados, err := os.ReadFile(caminho)
			if err != nil {
				return err
			}
			achados[caminho] = string(dados)
			return nil
		})
		require.NoError(t, err)
	}
	require.NotEmpty(t, achados)
	return achados
}

// amostra troca os verbos do Go por um valor qualquer, como a mensagem sai
// em tempo de execucao.
func amostra(modelo string) string {
	return reVerboGo.ReplaceAllStringFunc(modelo, func(v string) string {
		if v == "%%" {
			return "%"
		}
		return "X"
	})
}

func desfazerAspas(t *testing.T, bruto string) string {
	t.Helper()
	s, err := strconv.Unquote(bruto)
	require.NoError(t, err, bruto)
	return s
}

func coletar(t *testing.T, arquivos map[string]string, re *regexp.Regexp, destino map[string]string) {
	t.Helper()
	for caminho, conteudo := range arquivos {
		for _, m := range re.FindAllStringSubmatch(conteudo, -1) {
			destino[desfazerAspas(t, m[len(m)-1])] = filepath.Base(caminho)
		}
	}
}

// TestTodasAsMensagensDoCodigoTemTraducao varre o codigo-fonte: nenhuma
// mensagem que chega ao usuario pode ficar sem espanhol.
func TestTodasAsMensagensDoCodigoTemTraducao(t *testing.T) {
	esperadas := map[string]string{} // amostra da mensagem -> arquivo de origem

	// Erros de dominio, validacao de filtros e erros do SMTP: o texto vai
	// direto para a resposta (ou para o e-mail de teste).
	amplos := arquivosGo(t, "domain", "api", "infra/smtp", "platform/consulta", "platform/dinheiro", "platform/tempo")
	novos := map[string]string{}
	coletar(t, amplos, reErrorsNew, novos)
	for msg, arq := range novos {
		if !internos[msg] {
			esperadas[msg] = arq // errors.New nao e formato: "%" e literal
		}
	}

	// fmt.Errorf: so os que viram mensagem. Embrulhos "contexto: %w" de erro
	// tecnico (500) ficam de fora, exceto no SMTP, cuja causa o usuario le.
	erros := map[string]string{}
	coletar(t, amplos, reErrorf, erros)
	for msg, arq := range erros {
		switch {
		case strings.Contains(msg, "%T"), strings.HasPrefix(msg, "%w"):
			continue // erro interno de Scan / composto (coberto em compostos abaixo)
		case strings.HasPrefix(msg, "algoritmo de assinatura inesperado"):
			continue
		case arq != "enviador.go" && strings.HasSuffix(msg, ": %w") && strings.Count(msg, "%") == 1:
			continue
		}
		esperadas[amostra(msg)] = arq
	}

	// Pendencias da conferencia de nota fiscal (bloq e Sprintf de Mensagem).
	pendencias := map[string]string{}
	coletar(t, amplos, reBloq, pendencias)
	coletar(t, amplos, reSprintfMs, pendencias)
	for msg, arq := range pendencias {
		if !internos[msg] {
			esperadas[amostra(msg)] = arq
		}
	}

	// Mensagens escritas direto nos handlers e middlewares.
	diretas := map[string]string{}
	for _, re := range reHandlers {
		coletar(t, amplos, re, diretas)
	}
	for msg, arq := range diretas {
		esperadas[amostra(msg)] = arq
	}

	// Rede de seguranca para chamadas quebradas em varias linhas: todo
	// literal em frase capitalizada (como as mensagens dos handlers) em api/.
	for caminho, conteudo := range arquivosGo(t, "api") {
		for _, linha := range strings.Split(conteudo, "\n") {
			texto := strings.TrimSpace(linha)
			if strings.HasPrefix(texto, "//") || strings.Contains(texto, "slog.") || strings.Contains(texto, "json:\"") {
				continue
			}
			for _, m := range reFrase.FindAllStringSubmatch(linha, -1) {
				if msg := m[1]; !internos[msg] {
					esperadas[amostra(msg)] = filepath.Base(caminho)
				}
			}
		}
	}

	// Cabecalhos dos CSV.
	for caminho, conteudo := range amplos {
		for _, m := range reCSV.FindAllStringSubmatch(conteudo, -1) {
			for _, col := range regexp.MustCompile(literal).FindAllString(m[1], -1) {
				esperadas[desfazerAspas(t, col)] = filepath.Base(caminho)
			}
		}
	}

	// Mensagens montadas por concatenacao ou composicao, que a varredura nao
	// enxerga: lista fixa conferida a mao.
	compostos := []string{
		"necessaria 3, disponivel 1",
		"token invalido: assinatura incorreta",
		"tipo de arquivo nao aceito -- envie JPG, PNG, WebP, PDF ou o XML da NF-e: imagem ilegivel",
		"um campo excede o tamanho maximo permitido: nome deve ter no maximo 10 caracteres",
		"cotacoes respondidas insuficientes para emitir este pedido nos ultimos 30 dias: P1 (1 de 2)",
		"o servidor de e-mail recusou ou nao respondeu: conexao recusada -- confira servidor e porta",
		"o lote L1 ja existe com outra validade -- confira com o fornecedor",
		"serie S1 ja existe para a peca P1",
		"Este e um e-mail de teste do Sistema PCP, enviado por admin.",
		"Se voce recebeu esta mensagem, a configuracao do servidor de e-mail esta funcionando.",
		"Teste de envio — Sistema PCP",
		"Dados invalidos", "Campo obrigatorio", "E-mail invalido", "Valor invalido",
		"Deve conter apenas digitos", "Erro interno do servidor", "Corpo da requisicao invalido",
		"Deve ter no minimo 3 caracteres", "Deve ter no maximo 3 caracteres",
		"Deve ser maior ou igual a 1", "Deve ser menor ou igual a 1", "Deve ser maior que 0",
		"Deve ter exatamente 8 caracteres", "Deve ser um dos valores: A, B",
	}
	for _, c := range compostos {
		esperadas[c] = "lista fixa"
	}

	require.Greater(t, len(esperadas), 250, "a varredura deveria achar centenas de mensagens")

	var faltam []string
	for msg, arq := range esperadas {
		if !temTraducao(msg) {
			faltam = append(faltam, arq+": "+msg)
		}
	}
	sort.Strings(faltam)
	assert.Empty(t, faltam, "mensagens sem traducao para espanhol:\n%s", strings.Join(faltam, "\n"))
}

// TestMensagensDeDominioExatasUsamFaltantes confere, pela API publica, as
// chaves sem valores variaveis.
func TestMensagensDeDominioExatasUsamFaltantes(t *testing.T) {
	amplos := arquivosGo(t, "domain")
	msgs := map[string]string{}
	coletar(t, amplos, reErrorsNew, msgs)
	var chaves []string
	for msg := range msgs {
		if !reVerboGo.MatchString(msg) {
			chaves = append(chaves, msg)
		}
	}
	require.NotEmpty(t, chaves)
	assert.Empty(t, Faltantes(Espanhol, chaves))
}

// TestTraducoesComVerbosMantemAQuantidadeDeVerbos garante que o modelo e a
// traducao recebem os mesmos valores, e que nenhum "%" solto estraga o Sprintf.
func TestTraducoesComVerbosMantemAQuantidadeDeVerbos(t *testing.T) {
	mu.RLock()
	defer mu.RUnlock()
	require.NotEmpty(t, modelos[Espanhol])
	solto := regexp.MustCompile(`%`)
	for _, m := range modelos[Espanhol] {
		verbos := verbo.FindAllString(m.traducao, -1)
		assert.Len(t, verbos, m.nVariaveis, "traducao com quantidade de verbos diferente da chave: %q", m.traducao)
		resto := verbo.ReplaceAllString(strings.ReplaceAll(m.traducao, "%%", ""), "")
		assert.Empty(t, solto.FindAllString(resto, -1), "'%%' solto na traducao (use %%%%): %q", m.traducao)
	}
}

func TestModelosComPercentualLiteral(t *testing.T) {
	msg := "preco unitario R$ 10.5000 diverge 12.3% do pedido (R$ 9.00), acima da tolerancia de 5.0%"
	assert.Equal(t,
		"el precio unitario R$ 10.5000 diverge 12.3% del pedido (R$ 9.00), por encima de la tolerancia de 5.0%",
		Traduzir(Espanhol, msg))
}

func TestCausaDoErroTambemETraduzida(t *testing.T) {
	assert.Equal(t,
		"el servidor de correo electrónico rechazó o no respondió: conexión rechazada -- verifique servidor y puerto",
		Traduzir(Espanhol, "o servidor de e-mail recusou ou nao respondeu: conexao recusada -- confira servidor e porta"))
	assert.Equal(t, "necesaria 3, disponible 1", Traduzir(Espanhol, "necessaria 3, disponivel 1"))
	assert.Equal(t, "la serie S1 ya existe para la pieza P1", Traduzir(Espanhol, "serie S1 ja existe para a peca P1"))
	assert.Equal(t, "la serie S1 ya existe para esta pieza", Traduzir(Espanhol, "serie S1 ja existe para esta peca"))
}
