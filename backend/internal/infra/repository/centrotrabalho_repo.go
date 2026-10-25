package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/centrotrabalho"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasCentro = `id, codigo, nome, etapa, capacidade_horas_dia::float8, custo_hora::float8, descricao, ativo, created_at, updated_at`

// CentroTrabalhoRepositorio implementa centrotrabalho.Repositorio.
type CentroTrabalhoRepositorio struct {
	pool *pgxpool.Pool
}

// NovoCentroTrabalhoRepositorio cria o repositorio de centros de trabalho.
func NovoCentroTrabalhoRepositorio(pool *pgxpool.Pool) *CentroTrabalhoRepositorio {
	return &CentroTrabalhoRepositorio{pool: pool}
}

// comIgualdade acrescenta "coluna = valor" ao WHERE de filtrosDeCadastro
// (valor vazio = sem filtro). A coluna vem do codigo, nunca da requisicao.
func comIgualdade(filtros string, argumentos []any, coluna, valor string) (string, []any) {
	if valor == "" {
		return filtros, argumentos
	}
	argumentos = append(argumentos, valor)
	condicao := fmt.Sprintf("%s = $%d", coluna, len(argumentos))
	if strings.TrimSpace(filtros) == "" {
		return "WHERE " + condicao, argumentos
	}
	return filtros + " AND " + condicao, argumentos
}

func lerCentro(l linha) (*centrotrabalho.CentroTrabalho, error) {
	var c centrotrabalho.CentroTrabalho
	if err := l.Scan(&c.ID, &c.Codigo, &c.Nome, &c.Etapa, &c.CapacidadeHorasDia, &c.CustoHora, &c.Descricao,
		&c.Ativo, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return nil, err
	}
	return &c, nil
}

func erroDeCentro(err error, operacao string) error {
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return centrotrabalho.ErrNaoEncontrado
	case violouIndiceUnico(err):
		return centrotrabalho.ErrCodigoDuplicado
	}
	return fmt.Errorf("%s: %w", operacao, err)
}

// Criar grava um centro de trabalho.
func (r *CentroTrabalhoRepositorio) Criar(ctx context.Context, d centrotrabalho.Dados, ativo bool, autor string) (*centrotrabalho.CentroTrabalho, error) {
	c, err := lerCentro(db.DoContexto(ctx, r.pool).QueryRow(ctx, `
		INSERT INTO centros_trabalho (codigo, nome, etapa, capacidade_horas_dia, descricao, ativo, created_by, updated_by, custo_hora)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $7, round($8::numeric, 2))
		RETURNING `+colunasCentro,
		d.Codigo, d.Nome, d.Etapa, d.CapacidadeHorasDia, d.Descricao, ativo, autor, d.CustoHora))
	if err != nil {
		return nil, erroDeCentro(err, "criar centro de trabalho")
	}
	return c, nil
}

// Atualizar regrava nome, etapa, capacidade, descricao e situacao.
func (r *CentroTrabalhoRepositorio) Atualizar(ctx context.Context, id int64, d centrotrabalho.Dados, ativo bool, autor string) (*centrotrabalho.CentroTrabalho, error) {
	c, err := lerCentro(db.DoContexto(ctx, r.pool).QueryRow(ctx, `
		UPDATE centros_trabalho SET nome = $2, etapa = $3, capacidade_horas_dia = $4, descricao = $5,
		  ativo = $6, updated_by = $7, custo_hora = round($8::numeric, 2)
		WHERE id = $1
		RETURNING `+colunasCentro,
		id, d.Nome, d.Etapa, d.CapacidadeHorasDia, d.Descricao, ativo, autor, d.CustoHora))
	if err != nil {
		return nil, erroDeCentro(err, "atualizar centro de trabalho")
	}
	return c, nil
}

// BuscarPorID devolve um centro de trabalho.
func (r *CentroTrabalhoRepositorio) BuscarPorID(ctx context.Context, id int64) (*centrotrabalho.CentroTrabalho, error) {
	c, err := lerCentro(db.DoContexto(ctx, r.pool).QueryRow(ctx,
		`SELECT `+colunasCentro+` FROM centros_trabalho WHERE id = $1`, id))
	if err != nil {
		return nil, erroDeCentro(err, "buscar centro de trabalho")
	}
	return c, nil
}

// Listar devolve uma pagina de centros de trabalho.
func (r *CentroTrabalhoRepositorio) Listar(ctx context.Context, params consulta.Parametros, etapa string) ([]centrotrabalho.CentroTrabalho, int, error) {
	filtros, argumentos := filtrosDeCadastro(params, "codigo", "nome")
	filtros, argumentos = comIgualdade(filtros, argumentos, "etapa", etapa)

	conexao := db.DoContexto(ctx, r.pool)
	var total int
	if err := conexao.QueryRow(ctx, `SELECT count(*) FROM centros_trabalho `+filtros, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar centros de trabalho: %w", err)
	}
	// Etapa ordena pelo fluxo (Separacao -> Expedicao), nao alfabeticamente.
	ordem := params.OrdenarPor
	if ordem == "etapa" {
		ordem = "array_position(ARRAY['SEPARACAO','MONTAGEM','TESTES','EXPEDICAO']::varchar[], etapa)"
	}
	sql := fmt.Sprintf("SELECT %s FROM centros_trabalho %s ORDER BY %s %s, codigo LIMIT $%d OFFSET $%d",
		colunasCentro, filtros, ordem, params.Ordem.SQL(), len(argumentos)+1, len(argumentos)+2)
	linhas, err := conexao.Query(ctx, sql, append(argumentos, params.Limite, params.Offset())...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar centros de trabalho: %w", err)
	}
	defer linhas.Close()
	itens := make([]centrotrabalho.CentroTrabalho, 0, params.Limite)
	for linhas.Next() {
		c, err := lerCentro(linhas)
		if err != nil {
			return nil, 0, err
		}
		itens = append(itens, *c)
	}
	return itens, total, linhas.Err()
}

// Desativar inativa o centro de trabalho.
func (r *CentroTrabalhoRepositorio) Desativar(ctx context.Context, id int64, autor string) error {
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx,
		`UPDATE centros_trabalho SET ativo = false, updated_by = $2 WHERE id = $1`, id, autor)
	if err != nil {
		return fmt.Errorf("desativar centro de trabalho: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return centrotrabalho.ErrNaoEncontrado
	}
	return nil
}
