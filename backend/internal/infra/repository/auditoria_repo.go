package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auditoria"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasAuditoria = `a.id, a.tabela, a.operacao, a.registro_id, a.dados_antigos,
	a.dados_novos, a.usuario_id, u.nome, a.data_hora, a.endereco_ip`

// AuditoriaRepositorio implementa auditoria.Repositorio sobre PostgreSQL.
type AuditoriaRepositorio struct {
	pool *pgxpool.Pool
}

// NovoAuditoriaRepositorio cria o repositorio de auditoria.
func NovoAuditoriaRepositorio(pool *pgxpool.Pool) *AuditoriaRepositorio {
	return &AuditoriaRepositorio{pool: pool}
}

// Listar devolve a pagina de registros (mais recentes primeiro) e o total
// que bate nos filtros, para a paginacao do frontend.
func (r *AuditoriaRepositorio) Listar(ctx context.Context, filtros auditoria.Filtros) ([]auditoria.Registro, int, error) {
	condicoes, argumentos := condicoesDeAuditoria(filtros)
	executor := db.DoContexto(ctx, r.pool)

	var total int
	if err := executor.QueryRow(ctx,
		`SELECT count(*) FROM auditoria a `+condicoes, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar auditoria: %w", err)
	}

	sql := fmt.Sprintf(
		`SELECT %s FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id %s
		 ORDER BY a.data_hora DESC LIMIT $%d OFFSET $%d`,
		colunasAuditoria, condicoes, len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, filtros.Limite, filtros.Offset())

	linhas, err := executor.Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar auditoria: %w", err)
	}
	defer linhas.Close()

	itens, err := lerRegistros(linhas)
	if err != nil {
		return nil, 0, err
	}
	return itens, total, nil
}

// ListarParaExportar e como Listar, mas sem paginacao -- para o CSV, que
// precisa de todas as linhas que batem no filtro, nao so de uma pagina.
func (r *AuditoriaRepositorio) ListarParaExportar(ctx context.Context, filtros auditoria.Filtros) ([]auditoria.Registro, error) {
	condicoes, argumentos := condicoesDeAuditoria(filtros)

	sql := fmt.Sprintf(
		`SELECT %s FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id %s
		 ORDER BY a.data_hora DESC`,
		colunasAuditoria, condicoes)

	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, fmt.Errorf("exportar auditoria: %w", err)
	}
	defer linhas.Close()

	return lerRegistros(linhas)
}

// condicoesDeAuditoria monta o WHERE condicional dos filtros de periodo,
// usuario, tabela e operacao -- mesmo padrao de filtrosDeCadastro, mas com
// um formato de filtro proprio (nao e "ativo"/"busca").
func condicoesDeAuditoria(filtros auditoria.Filtros) (string, []any) {
	condicoes := make([]string, 0, 4)
	argumentos := make([]any, 0, 4)

	if filtros.DataInicio != nil {
		argumentos = append(argumentos, *filtros.DataInicio)
		condicoes = append(condicoes, fmt.Sprintf("a.data_hora >= $%d", len(argumentos)))
	}
	if filtros.DataFim != nil {
		argumentos = append(argumentos, *filtros.DataFim)
		condicoes = append(condicoes, fmt.Sprintf("a.data_hora <= $%d", len(argumentos)))
	}
	if filtros.UsuarioID != nil {
		argumentos = append(argumentos, *filtros.UsuarioID)
		condicoes = append(condicoes, fmt.Sprintf("a.usuario_id = $%d", len(argumentos)))
	}
	if filtros.Tabela != "" {
		argumentos = append(argumentos, filtros.Tabela)
		condicoes = append(condicoes, fmt.Sprintf("a.tabela = $%d", len(argumentos)))
	}
	if filtros.Operacao != "" {
		argumentos = append(argumentos, filtros.Operacao)
		condicoes = append(condicoes, fmt.Sprintf("a.operacao = $%d", len(argumentos)))
	}

	if len(condicoes) == 0 {
		return "", argumentos
	}
	return "WHERE " + strings.Join(condicoes, " AND "), argumentos
}

func lerRegistros(linhas pgx.Rows) ([]auditoria.Registro, error) {
	itens := make([]auditoria.Registro, 0)
	for linhas.Next() {
		var reg auditoria.Registro
		if err := linhas.Scan(
			&reg.ID, &reg.Tabela, &reg.Operacao, &reg.RegistroID, &reg.DadosAntigos,
			&reg.DadosNovos, &reg.UsuarioID, &reg.UsuarioNome, &reg.DataHora, &reg.EnderecoIP,
		); err != nil {
			return nil, fmt.Errorf("ler registro de auditoria: %w", err)
		}
		itens = append(itens, reg)
	}
	return itens, linhas.Err()
}
