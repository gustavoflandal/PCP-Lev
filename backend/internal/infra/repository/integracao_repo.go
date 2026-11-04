package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/integracao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasChaveAPI = `id, nome, descricao, prefixo, ativo, criado_por, ultimo_uso, created_at,
	revogada_em, coalesce(revogada_por, '')`

// IntegracaoRepositorio implementa integracao.Repositorio sobre PostgreSQL.
type IntegracaoRepositorio struct {
	pool *pgxpool.Pool
}

// NovoIntegracaoRepositorio cria o repositorio de chaves de API.
func NovoIntegracaoRepositorio(pool *pgxpool.Pool) *IntegracaoRepositorio {
	return &IntegracaoRepositorio{pool: pool}
}

func lerChaveAPI(l linha) (*integracao.ChaveAPI, error) {
	var c integracao.ChaveAPI
	err := l.Scan(&c.ID, &c.Nome, &c.Descricao, &c.Prefixo, &c.Ativo, &c.CriadoPor, &c.UltimoUso, &c.CreatedAt,
		&c.RevogadaEm, &c.RevogadaPor)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// Criar grava a chave (so o hash) e preenche id e datas em `c`.
func (r *IntegracaoRepositorio) Criar(ctx context.Context, c *integracao.ChaveAPI, hash string) error {
	gravada, err := lerChaveAPI(db.DoContexto(ctx, r.pool).QueryRow(ctx, `
		INSERT INTO chaves_api (nome, descricao, prefixo, hash_chave, criado_por)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING `+colunasChaveAPI, c.Nome, c.Descricao, c.Prefixo, hash, c.CriadoPor))
	if err != nil {
		return fmt.Errorf("criar chave de api: %w", err)
	}
	*c = *gravada
	return nil
}

// Listar devolve as chaves, as ativas primeiro.
func (r *IntegracaoRepositorio) Listar(ctx context.Context) ([]integracao.ChaveAPI, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx,
		`SELECT `+colunasChaveAPI+` FROM chaves_api ORDER BY ativo DESC, created_at DESC, id DESC`)
	if err != nil {
		return nil, fmt.Errorf("listar chaves de api: %w", err)
	}
	defer linhas.Close()
	lista := []integracao.ChaveAPI{}
	for linhas.Next() {
		c, err := lerChaveAPI(linhas)
		if err != nil {
			return nil, fmt.Errorf("ler chave de api: %w", err)
		}
		lista = append(lista, *c)
	}
	return lista, linhas.Err()
}

// BuscarAtivaPorHash devolve a chave ativa com o hash informado.
func (r *IntegracaoRepositorio) BuscarAtivaPorHash(ctx context.Context, hash string) (*integracao.ChaveAPI, error) {
	c, err := lerChaveAPI(db.DoContexto(ctx, r.pool).QueryRow(ctx,
		`SELECT `+colunasChaveAPI+` FROM chaves_api WHERE hash_chave = $1 AND ativo`, hash))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, integracao.ErrNaoEncontrada
	}
	if err != nil {
		return nil, fmt.Errorf("buscar chave de api: %w", err)
	}
	return c, nil
}

// Revogar desativa a chave; ErrJaRevogada se ja estava revogada.
func (r *IntegracaoRepositorio) Revogar(ctx context.Context, id int64, autor string) error {
	executor := db.DoContexto(ctx, r.pool)
	tag, err := executor.Exec(ctx,
		`UPDATE chaves_api SET ativo = FALSE, revogada_em = CURRENT_TIMESTAMP, revogada_por = $2
		 WHERE id = $1 AND ativo`, id, autor)
	if err != nil {
		return fmt.Errorf("revogar chave de api: %w", err)
	}
	if tag.RowsAffected() > 0 {
		return nil
	}
	var existe bool
	if err := executor.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM chaves_api WHERE id = $1)`, id).Scan(&existe); err != nil {
		return fmt.Errorf("revogar chave de api: %w", err)
	}
	if !existe {
		return integracao.ErrNaoEncontrada
	}
	return integracao.ErrJaRevogada
}

// RegistrarUso grava o instante da ultima chamada autenticada.
func (r *IntegracaoRepositorio) RegistrarUso(ctx context.Context, id int64) error {
	_, err := db.DoContexto(ctx, r.pool).Exec(ctx, `UPDATE chaves_api SET ultimo_uso = CURRENT_TIMESTAMP WHERE id = $1`, id)
	return err
}
