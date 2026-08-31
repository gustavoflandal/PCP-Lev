package db

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Executor e o subconjunto de *pgxpool.Pool e *pgxpool.Conn usado pelos
// repositorios. As duas assinaturas sao identicas -- e o que permite trocar
// o pool compartilhado por uma conexao fixada numa unica requisicao (ver
// middleware.ConexaoDeAuditoria) sem mudar nenhum metodo de repositorio.
type Executor interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Begin(ctx context.Context) (pgx.Tx, error)
}

type chaveExecutor struct{}

// ComExecutor grava no contexto a conexao fixada para esta requisicao --
// usado pelo middleware de auditoria, que precisa que todas as instrucoes
// da requisicao rodem na mesma conexao onde gravou as variaveis de sessao
// que os triggers de auditoria leem (migration 007).
func ComExecutor(ctx context.Context, executor Executor) context.Context {
	return context.WithValue(ctx, chaveExecutor{}, executor)
}

// DoContexto devolve a conexao fixada no contexto, se houver, ou `padrao`
// (o pool compartilhado) como retorno — o mesmo caminho de antes desta
// mudanca. Testes, jobs em segundo plano e qualquer chamada fora do ciclo
// de uma requisicao HTTP real nunca tem valor no contexto, entao caem
// sempre no fallback sem precisar de nenhum ajuste.
func DoContexto(ctx context.Context, padrao Executor) Executor {
	if executor, ok := ctx.Value(chaveExecutor{}).(Executor); ok {
		return executor
	}
	return padrao
}
