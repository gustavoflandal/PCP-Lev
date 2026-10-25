package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/banco"
	"github.com/jackc/pgx/v5/pgxpool"
)

// limiteMaioresTabelas e quantas tabelas a tela lista no bloco de
// armazenamento.
const limiteMaioresTabelas = 10

// tempoMaximoDiagnostico corta a espera quando o servidor nao responde (host
// fora do ar sem "connection refused"): a tela de diagnostico deve dizer
// "indisponivel" em segundos, nao ficar presa ate o timeout do navegador.
const tempoMaximoDiagnostico = 3 * time.Second

// BancoRepositorio le metricas do proprio PostgreSQL da aplicacao. Usa o
// pool direto (nao db.DoContexto): sao leituras de catalogo, sem relacao com
// a conexao fixada para os triggers de auditoria.
type BancoRepositorio struct {
	pool *pgxpool.Pool
}

// NovoBancoRepositorio cria o repositorio de diagnostico do banco.
func NovoBancoRepositorio(pool *pgxpool.Pool) *BancoRepositorio {
	return &BancoRepositorio{pool: pool}
}

// Ping executa SELECT 1 e mede o tempo de ida e volta.
func (r *BancoRepositorio) Ping(ctx context.Context) (time.Duration, error) {
	ctx, cancelar := context.WithTimeout(ctx, tempoMaximoDiagnostico)
	defer cancelar()

	inicio := time.Now()
	var um int
	if err := r.pool.QueryRow(ctx, `SELECT 1`).Scan(&um); err != nil {
		return 0, fmt.Errorf("ping no banco: %w", err)
	}
	return time.Since(inicio), nil
}

// Metricas reune versao, tamanhos, maiores tabelas, conexoes e o pool.
func (r *BancoRepositorio) Metricas(ctx context.Context) (banco.Metricas, error) {
	ctx, cancelar := context.WithTimeout(ctx, tempoMaximoDiagnostico)
	defer cancelar()

	latencia, err := r.Ping(ctx)
	if err != nil {
		return banco.Metricas{}, err
	}

	m := banco.Metricas{Latencia: latencia}
	err = r.pool.QueryRow(ctx, `
		SELECT current_setting('server_version'), current_database(),
		       pg_database_size(current_database()),
		       (SELECT count(*) FROM pg_stat_activity
		         WHERE datname = current_database() AND state = 'active')`,
	).Scan(&m.Versao, &m.Banco, &m.TamanhoBytes, &m.ConexoesAtivas)
	if err != nil {
		return banco.Metricas{}, fmt.Errorf("ler metricas do banco: %w", err)
	}

	// current_schema(): em producao e "public"; nos testes cada pool aponta
	// para um schema proprio, e listar os dos outros testes seria ruido.
	//
	// Linhas: n_live_tup vem das estatisticas de atividade, que zeram quando o
	// servidor reinicia sem desligamento limpo (ex.: container recriado);
	// reltuples e a estimativa do planejador, gravada no catalogo pelo
	// ANALYZE/autovacuum (-1 se a tabela nunca foi analisada). A maior das
	// duas evita mostrar "0 linhas" numa tabela com dados; sem nenhuma das
	// duas, nao ha estimativa (NULL) -- melhor "—" na tela do que um zero falso.
	linhas, err := r.pool.Query(ctx, `
		SELECT s.relname, pg_total_relation_size(s.relid),
		       CASE WHEN s.n_live_tup = 0 AND c.reltuples < 0 THEN NULL
		            ELSE GREATEST(s.n_live_tup, c.reltuples::bigint, 0) END
		FROM pg_stat_user_tables s
		JOIN pg_class c ON c.oid = s.relid
		WHERE s.schemaname = current_schema()
		ORDER BY pg_total_relation_size(s.relid) DESC, s.relname
		LIMIT $1`, limiteMaioresTabelas)
	if err != nil {
		return banco.Metricas{}, fmt.Errorf("listar maiores tabelas: %w", err)
	}
	defer linhas.Close()
	for linhas.Next() {
		var t banco.Tabela
		if err := linhas.Scan(&t.Nome, &t.TamanhoBytes, &t.LinhasEstimadas); err != nil {
			return banco.Metricas{}, fmt.Errorf("ler tabela: %w", err)
		}
		m.MaioresTabelas = append(m.MaioresTabelas, t)
	}
	if err := linhas.Err(); err != nil {
		return banco.Metricas{}, fmt.Errorf("listar maiores tabelas: %w", err)
	}

	stat := r.pool.Stat()
	m.Pool = banco.Pool{
		EmUso:   stat.AcquiredConns(),
		Ociosas: stat.IdleConns(),
		Total:   stat.TotalConns(),
		Maximo:  stat.MaxConns(),
	}
	return m, nil
}
