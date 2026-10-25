package repository

import (
	"context"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/regional"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasRegional = `formato_data, formato_hora, updated_at, updated_by`

// RegionalRepositorio implementa a persistencia do singleton de parametros
// regionais. Nao ha Criar/Excluir: a linha id=1 e semeada pela migration 011
// e so sofre UPDATE dai em diante.
type RegionalRepositorio struct {
	pool *pgxpool.Pool
}

// NovoRegionalRepositorio cria o repositorio de parametros regionais.
func NovoRegionalRepositorio(pool *pgxpool.Pool) *RegionalRepositorio {
	return &RegionalRepositorio{pool: pool}
}

// Buscar devolve a configuracao atual. Nunca ha "nao encontrado": a
// migration 011 garante a linha id=1 desde a subida da aplicacao.
func (r *RegionalRepositorio) Buscar(ctx context.Context) (regional.Regional, error) {
	return r.buscarUm(ctx, `SELECT `+colunasRegional+` FROM configuracao_regional WHERE id = 1`)
}

func (r *RegionalRepositorio) buscarUm(ctx context.Context, sql string, args ...any) (regional.Regional, error) {
	var cfg regional.Regional
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, sql, args...).Scan(
		&cfg.FormatoData, &cfg.FormatoHora, &cfg.UpdatedAt, &cfg.UpdatedBy,
	)
	if err != nil {
		return regional.Regional{}, fmt.Errorf("buscar configuracao regional: %w", err)
	}
	return cfg, nil
}

// Atualizar grava os dois campos e devolve a linha resultante.
func (r *RegionalRepositorio) Atualizar(ctx context.Context, dados regional.Dados, atualizadoPor string) (regional.Regional, error) {
	sql := `UPDATE configuracao_regional SET
			formato_data = $1, formato_hora = $2, updated_at = now(), updated_by = $3
		WHERE id = 1
		RETURNING ` + colunasRegional

	return r.buscarUm(ctx, sql, dados.FormatoData, dados.FormatoHora, atualizadoPor)
}
