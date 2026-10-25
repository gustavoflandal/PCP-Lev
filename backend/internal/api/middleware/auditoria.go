package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auth"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

// tempoLimiteFixarConexao limita a espera por uma conexao do pool. Sem ele,
// um pool saturado enfileira a requisicao indefinidamente ate o contexto da
// requisicao morrer; com ele, a auditoria degrada rapido para o caminho de
// fallback (pool compartilhado) em vez de segurar a requisicao inteira.
const tempoLimiteFixarConexao = 3 * time.Second

// ConexaoDeAuditoria fixa uma conexao do pool para toda a requisicao e grava
// nela as variaveis de sessao que os triggers de auditoria (migration 007,
// fn_registrar_auditoria) leem via current_setting('pcp.usuario_id'/
// 'pcp.endereco_ip') -- sem isso, toda linha de auditoria tem usuario e IP
// sempre NULL, ja que pool.Exec/Query pode usar uma conexao fisica
// diferente a cada chamada.
//
// Registrada globalmente (nao depende da ordem de outros middlewares por
// rota): decodifica o JWT por conta propria em vez de depender de
// middleware.Autenticacao, que so roda nas rotas que a exigem
// explicitamente. Requisicoes sem token valido (login, endpoints publicos)
// seguem com usuario_id vazio -- o IP ainda e gravado.
//
// Metodos de leitura (GET/HEAD/OPTIONS) pulam o pinning inteiro: os triggers
// so disparam em INSERT/UPDATE/DELETE, entao fixar conexao neles so gastaria
// uma das DB_MAX_CONNS (20 por padrao) sem nenhum efeito na trilha. Como
// middlewares globais do Echo tambem rodam no NotFoundHandler, sem essa saida
// antecipada um punhado de GETs para rotas inexistentes -- sem autenticacao
// nenhuma -- esgotaria o pool e derrubaria a API inteira.
func ConexaoDeAuditoria(pool *pgxpool.Pool, tokens *auth.ServicoToken) echo.MiddlewareFunc {
	return func(proximo echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			switch c.Request().Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
				return proximo(c)
			}

			ctx := c.Request().Context()
			ctxFixar, cancelar := context.WithTimeout(ctx, tempoLimiteFixarConexao)
			defer cancelar()

			conexao, err := pool.Acquire(ctxFixar)
			if err != nil {
				// Best-effort: a auditoria nao pode derrubar a requisicao.
				// Os repositorios caem de volta para o pool compartilhado
				// (db.DoContexto sem valor no contexto).
				slog.Error("falha ao fixar conexao para auditoria", "erro", err)
				return proximo(c)
			}
			defer conexao.Release()
			defer func() {
				// Registrado logo depois do Release para rodar ANTES dele
				// (defers sao LIFO): a conexao so volta ao pool ja limpa.
				// Cobre todas as saidas da funcao -- retorno normal, o
				// early-return de erro do set_config abaixo e ate um panic
				// no handler (echomw.Recover() esta ANTES deste middleware
				// na cadeia, entao o unwind passa por aqui). Sem isto, a
				// proxima requisicao a reaproveitar esta conexao herdaria o
				// usuario/IP desta e a trilha registraria o usuario ERRADO,
				// o que e pior que NULL: e evidencia falsa.
				//
				// RESET, nao um novo SET vazio, para nao deixar a variavel
				// "definida como vazia" em vez de "indefinida"
				// (current_setting(..., true) trata os dois de forma
				// diferente em alguns cenarios de introspeccao). Duas
				// chamadas, nao uma string com ";", para nao depender de pgx
				// escolher o protocolo simples (unico que aceita multiplas
				// instrucoes por chamada). context.Background() porque o
				// contexto da requisicao ja pode estar cancelado aqui.
				if _, err := conexao.Exec(context.Background(), `RESET pcp.usuario_id`); err != nil {
					slog.Error("falha ao limpar pcp.usuario_id apos a requisicao", "erro", err)
				}
				if _, err := conexao.Exec(context.Background(), `RESET pcp.endereco_ip`); err != nil {
					slog.Error("falha ao limpar pcp.endereco_ip apos a requisicao", "erro", err)
				}
			}()

			usuarioIDTexto := usuarioIDDoToken(c, tokens)
			if _, err := conexao.Exec(ctx,
				`SELECT set_config('pcp.usuario_id', $1, false), set_config('pcp.endereco_ip', $2, false)`,
				usuarioIDTexto, c.RealIP(),
			); err != nil {
				slog.Error("falha ao gravar variaveis de sessao para auditoria", "erro", err)
				return proximo(c)
			}

			c.SetRequest(c.Request().WithContext(db.ComExecutor(ctx, conexao)))
			return proximo(c)
		}
	}
}

// usuarioIDDoToken decodifica o Bearer token, se houver, sem exigir que
// seja valido -- essa checagem e responsabilidade de middleware.Autenticacao
// nas rotas que a exigem. Aqui, um token ausente ou invalido so significa
// "auditoria sem usuario", nao um erro de requisicao.
func usuarioIDDoToken(c echo.Context, tokens *auth.ServicoToken) string {
	cabecalho := c.Request().Header.Get(echo.HeaderAuthorization)
	if !strings.HasPrefix(cabecalho, prefixoBearer) {
		return ""
	}
	claims, err := tokens.Validar(strings.TrimSpace(cabecalho[len(prefixoBearer):]))
	if err != nil {
		return ""
	}
	return strconv.FormatInt(claims.UsuarioID, 10)
}
