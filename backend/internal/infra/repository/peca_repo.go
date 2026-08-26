package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasPeca = `id, codigo, descricao, unidade_medida, estoque_minimo, estoque_maximo,
	fornecedor_padrao_id, lead_time_compra, ativo, created_at, updated_at, created_by, updated_by`

// PecaRepositorio implementa peca.Repositorio sobre PostgreSQL.
type PecaRepositorio struct {
	pool *pgxpool.Pool
}

// NovoPecaRepositorio cria o repositorio de partes/pecas.
func NovoPecaRepositorio(pool *pgxpool.Pool) *PecaRepositorio {
	return &PecaRepositorio{pool: pool}
}

// Criar grava a peca e abre a sua linha de saldo de estoque.
//
// As duas gravacoes vao na mesma transacao: uma peca sem saldo nao pode ser
// movimentada, e um saldo sem peca seria orfao.
func (r *PecaRepositorio) Criar(ctx context.Context, p *peca.PartePeca, autor string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	sql := `INSERT INTO partes_pecas
		(codigo, descricao, unidade_medida, estoque_minimo, estoque_maximo,
		 fornecedor_padrao_id, lead_time_compra, ativo, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
		RETURNING id, created_at, updated_at`

	err = tx.QueryRow(ctx, sql,
		p.Codigo, p.Descricao, p.UnidadeMedida, p.EstoqueMinimo, p.EstoqueMaximo,
		p.FornecedorPadraoID, p.LeadTimeCompra, p.Ativo, autor,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		if violouIndiceUnico(err) {
			return peca.ErrCodigoDuplicado
		}
		if violouChaveEstrangeira(err) {
			return peca.ErrFornecedorInexistente
		}
		return fmt.Errorf("criar parte/peca: %w", err)
	}

	// O saldo nasce zerado e ja classificado: com estoque minimo maior que
	// zero, saldo zero e critico desde o inicio (RN5).
	situacao := p.SituacaoDoSaldo(0)
	if _, err := tx.Exec(ctx,
		`INSERT INTO saldo_estoque (parte_peca_id, quantidade_atual, quantidade_reservada, status, updated_by)
		 VALUES ($1, 0, 0, $2, $3)`, p.ID, situacao, autor); err != nil {
		return fmt.Errorf("abrir saldo de estoque: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("confirmar criacao da parte/peca: %w", err)
	}
	p.CreatedBy, p.UpdatedBy = &autor, &autor
	return nil
}

func (r *PecaRepositorio) Atualizar(ctx context.Context, p *peca.PartePeca, autor string) error {
	sql := `UPDATE partes_pecas
		SET codigo = $2, descricao = $3, unidade_medida = $4, estoque_minimo = $5,
		    estoque_maximo = $6, fornecedor_padrao_id = $7, lead_time_compra = $8,
		    ativo = $9, updated_by = $10
		WHERE id = $1
		RETURNING updated_at`

	err := r.pool.QueryRow(ctx, sql,
		p.ID, p.Codigo, p.Descricao, p.UnidadeMedida, p.EstoqueMinimo, p.EstoqueMaximo,
		p.FornecedorPadraoID, p.LeadTimeCompra, p.Ativo, autor,
	).Scan(&p.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return peca.ErrNaoEncontrado
		}
		if violouIndiceUnico(err) {
			return peca.ErrCodigoDuplicado
		}
		if violouChaveEstrangeira(err) {
			return peca.ErrFornecedorInexistente
		}
		return fmt.Errorf("atualizar parte/peca: %w", err)
	}
	p.UpdatedBy = &autor
	return nil
}

func (r *PecaRepositorio) BuscarPorID(ctx context.Context, id int64) (*peca.PartePeca, error) {
	sql := `SELECT ` + colunasPeca + ` FROM partes_pecas WHERE id = $1`

	var p peca.PartePeca
	err := r.pool.QueryRow(ctx, sql, id).Scan(
		&p.ID, &p.Codigo, &p.Descricao, &p.UnidadeMedida, &p.EstoqueMinimo, &p.EstoqueMaximo,
		&p.FornecedorPadraoID, &p.LeadTimeCompra, &p.Ativo,
		&p.CreatedAt, &p.UpdatedAt, &p.CreatedBy, &p.UpdatedBy,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, peca.ErrNaoEncontrado
		}
		return nil, fmt.Errorf("buscar parte/peca: %w", err)
	}
	return &p, nil
}

func (r *PecaRepositorio) Listar(ctx context.Context, params consulta.Parametros) ([]peca.PartePeca, int, error) {
	filtros, argumentos := filtrosDeCadastro(params, "codigo", "descricao")

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT count(*) FROM partes_pecas `+filtros, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar partes/pecas: %w", err)
	}

	sql := fmt.Sprintf("SELECT %s FROM partes_pecas %s ORDER BY %s %s LIMIT $%d OFFSET $%d",
		colunasPeca, filtros, params.OrdenarPor, params.Ordem.SQL(),
		len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, params.Limite, params.Offset())

	linhas, err := r.pool.Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar partes/pecas: %w", err)
	}
	defer linhas.Close()

	itens := make([]peca.PartePeca, 0, params.Limite)
	for linhas.Next() {
		var p peca.PartePeca
		if err := linhas.Scan(
			&p.ID, &p.Codigo, &p.Descricao, &p.UnidadeMedida, &p.EstoqueMinimo, &p.EstoqueMaximo,
			&p.FornecedorPadraoID, &p.LeadTimeCompra, &p.Ativo,
			&p.CreatedAt, &p.UpdatedAt, &p.CreatedBy, &p.UpdatedBy,
		); err != nil {
			return nil, 0, err
		}
		itens = append(itens, p)
	}
	return itens, total, linhas.Err()
}

func (r *PecaRepositorio) Desativar(ctx context.Context, id int64, autor string) error {
	etiqueta, err := r.pool.Exec(ctx,
		`UPDATE partes_pecas SET ativo = false, updated_by = $2 WHERE id = $1`, id, autor)
	if err != nil {
		return fmt.Errorf("desativar parte/peca: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return peca.ErrNaoEncontrado
	}
	return nil
}

func (r *PecaRepositorio) PossuiMovimentacao(ctx context.Context, id int64) (bool, error) {
	var existe bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM movimentacao_estoque WHERE parte_peca_id = $1)`, id).Scan(&existe)
	if err != nil {
		return false, fmt.Errorf("verificar movimentacao da parte/peca: %w", err)
	}
	return existe, nil
}
