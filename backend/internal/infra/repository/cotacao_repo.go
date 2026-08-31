package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cotacao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasCotacao = `id, numero_cotacao, fornecedor_id, data_emissao, data_validade,
	data_resposta, valor_total, status, coalesce(observacoes, ''), created_at, updated_at, created_by, updated_by`

const colunasItemCotacao = `id, parte_peca_id, quantidade, preco_unitario, total`

// CotacaoRepositorio implementa cotacao.Repositorio sobre PostgreSQL.
type CotacaoRepositorio struct {
	pool *pgxpool.Pool
}

// NovoCotacaoRepositorio cria o repositorio de cotacoes.
func NovoCotacaoRepositorio(pool *pgxpool.Pool) *CotacaoRepositorio {
	return &CotacaoRepositorio{pool: pool}
}

// Criar grava a cotacao e os seus itens na mesma transacao: uma cotacao sem
// item nao faz sentido (RF3.1 exige ao menos um), entao as duas gravacoes
// tem que ter tudo ou nada.
func (r *CotacaoRepositorio) Criar(ctx context.Context, c *cotacao.Cotacao, autor string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	sql := `INSERT INTO cotacoes
		(numero_cotacao, fornecedor_id, data_emissao, data_validade, valor_total, status, observacoes, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
		RETURNING id, created_at, updated_at`

	err = tx.QueryRow(ctx, sql,
		c.NumeroCotacao, c.FornecedorID, c.DataEmissao, c.DataValidade, c.ValorTotal, c.Status, c.Observacoes, autor,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)

	if err != nil {
		if violouIndiceUnico(err) {
			return cotacao.ErrNumeroCotacaoDuplicado
		}
		if violouChaveEstrangeira(err) {
			return cotacao.ErrFornecedorOuPecaInexistente
		}
		return fmt.Errorf("criar cotacao: %w", err)
	}

	for i, item := range c.Itens {
		err := tx.QueryRow(ctx, `INSERT INTO itens_cotacao
			(cotacao_id, parte_peca_id, quantidade, preco_unitario, total)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id`,
			c.ID, item.PartePecaID, item.Quantidade, item.PrecoUnitario, item.Total,
		).Scan(&c.Itens[i].ID)
		if err != nil {
			if violouChaveEstrangeira(err) {
				return cotacao.ErrFornecedorOuPecaInexistente
			}
			return fmt.Errorf("criar item da cotacao: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("confirmar criacao da cotacao: %w", err)
	}
	c.CreatedBy, c.UpdatedBy = &autor, &autor
	return nil
}

// Atualizar substitui os dados e os itens de uma cotacao (so chamado em
// Rascunho — a guarda de status vive no Servico).
func (r *CotacaoRepositorio) Atualizar(ctx context.Context, c *cotacao.Cotacao, autor string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	sql := `UPDATE cotacoes
		SET numero_cotacao = $2, fornecedor_id = $3, data_emissao = $4, data_validade = $5,
		    valor_total = $6, observacoes = $7, updated_by = $8
		WHERE id = $1
		RETURNING updated_at`

	err = tx.QueryRow(ctx, sql,
		c.ID, c.NumeroCotacao, c.FornecedorID, c.DataEmissao, c.DataValidade, c.ValorTotal, c.Observacoes, autor,
	).Scan(&c.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return cotacao.ErrNaoEncontrado
		}
		if violouIndiceUnico(err) {
			return cotacao.ErrNumeroCotacaoDuplicado
		}
		if violouChaveEstrangeira(err) {
			return cotacao.ErrFornecedorOuPecaInexistente
		}
		return fmt.Errorf("atualizar cotacao: %w", err)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM itens_cotacao WHERE cotacao_id = $1`, c.ID); err != nil {
		return fmt.Errorf("limpar itens da cotacao: %w", err)
	}
	for i, item := range c.Itens {
		err := tx.QueryRow(ctx, `INSERT INTO itens_cotacao
			(cotacao_id, parte_peca_id, quantidade, preco_unitario, total)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id`,
			c.ID, item.PartePecaID, item.Quantidade, item.PrecoUnitario, item.Total,
		).Scan(&c.Itens[i].ID)
		if err != nil {
			if violouChaveEstrangeira(err) {
				return cotacao.ErrFornecedorOuPecaInexistente
			}
			return fmt.Errorf("recriar item da cotacao: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("confirmar atualizacao da cotacao: %w", err)
	}
	c.UpdatedBy = &autor
	return nil
}

// BuscarPorID devolve a cotacao com os seus itens.
func (r *CotacaoRepositorio) BuscarPorID(ctx context.Context, id int64) (*cotacao.Cotacao, error) {
	var c cotacao.Cotacao
	err := r.pool.QueryRow(ctx, `SELECT `+colunasCotacao+` FROM cotacoes WHERE id = $1`, id).Scan(
		&c.ID, &c.NumeroCotacao, &c.FornecedorID, &c.DataEmissao, &c.DataValidade,
		&c.DataResposta, &c.ValorTotal, &c.Status, &c.Observacoes,
		&c.CreatedAt, &c.UpdatedAt, &c.CreatedBy, &c.UpdatedBy,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, cotacao.ErrNaoEncontrado
		}
		return nil, fmt.Errorf("buscar cotacao: %w", err)
	}

	itens, err := r.itensDaCotacao(ctx, id)
	if err != nil {
		return nil, err
	}
	c.Itens = itens
	return &c, nil
}

func (r *CotacaoRepositorio) itensDaCotacao(ctx context.Context, cotacaoID int64) ([]cotacao.ItemCotacao, error) {
	linhas, err := r.pool.Query(ctx,
		`SELECT `+colunasItemCotacao+` FROM itens_cotacao WHERE cotacao_id = $1 ORDER BY id`, cotacaoID)
	if err != nil {
		return nil, fmt.Errorf("buscar itens da cotacao: %w", err)
	}
	defer linhas.Close()

	itens := make([]cotacao.ItemCotacao, 0)
	for linhas.Next() {
		var item cotacao.ItemCotacao
		if err := linhas.Scan(&item.ID, &item.PartePecaID, &item.Quantidade, &item.PrecoUnitario, &item.Total); err != nil {
			return nil, err
		}
		itens = append(itens, item)
	}
	return itens, linhas.Err()
}

// Listar devolve so o cabecalho (sem itens — a lista nao precisa deles e
// evitar N+1 aqui importa mais que reaproveitar BuscarPorID).
func (r *CotacaoRepositorio) Listar(ctx context.Context, params consulta.Parametros) ([]cotacao.Cotacao, int, error) {
	filtros, argumentos := filtrosDeCompras(params, "numero_cotacao")

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT count(*) FROM cotacoes `+filtros, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar cotacoes: %w", err)
	}

	sql := fmt.Sprintf("SELECT %s FROM cotacoes %s ORDER BY %s %s LIMIT $%d OFFSET $%d",
		colunasCotacao, filtros, params.OrdenarPor, params.Ordem.SQL(),
		len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, params.Limite, params.Offset())

	linhas, err := r.pool.Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar cotacoes: %w", err)
	}
	defer linhas.Close()

	itens := make([]cotacao.Cotacao, 0, params.Limite)
	for linhas.Next() {
		var c cotacao.Cotacao
		if err := linhas.Scan(
			&c.ID, &c.NumeroCotacao, &c.FornecedorID, &c.DataEmissao, &c.DataValidade,
			&c.DataResposta, &c.ValorTotal, &c.Status, &c.Observacoes,
			&c.CreatedAt, &c.UpdatedAt, &c.CreatedBy, &c.UpdatedBy,
		); err != nil {
			return nil, 0, err
		}
		itens = append(itens, c)
	}
	return itens, total, linhas.Err()
}

// AtualizarStatus troca so o status (enviar/cancelar).
func (r *CotacaoRepositorio) AtualizarStatus(ctx context.Context, id int64, status string, autor string) error {
	etiqueta, err := r.pool.Exec(ctx,
		`UPDATE cotacoes SET status = $2, updated_by = $3 WHERE id = $1`, id, status, autor)
	if err != nil {
		return fmt.Errorf("atualizar status da cotacao: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return cotacao.ErrNaoEncontrado
	}
	return nil
}

// RegistrarResposta atualiza o preco de cada item, recalcula o valor total e
// marca a cotacao como respondida — tudo na mesma transacao.
func (r *CotacaoRepositorio) RegistrarResposta(ctx context.Context, id int64, resposta cotacao.RespostaDados, autor string) (*cotacao.Cotacao, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, item := range resposta.Itens {
		etiqueta, err := tx.Exec(ctx, `UPDATE itens_cotacao
			SET preco_unitario = $1::numeric, total = quantidade * $1::numeric
			WHERE cotacao_id = $2 AND parte_peca_id = $3`,
			item.PrecoUnitario, id, item.PartePecaID)
		if err != nil {
			return nil, fmt.Errorf("atualizar preco do item: %w", err)
		}
		if etiqueta.RowsAffected() == 0 {
			return nil, cotacao.ErrFornecedorOuPecaInexistente
		}
	}

	var valorTotal dinheiro.Dinheiro
	if err := tx.QueryRow(ctx,
		`SELECT sum(total) FROM itens_cotacao WHERE cotacao_id = $1`, id).Scan(&valorTotal); err != nil {
		return nil, fmt.Errorf("recalcular valor total: %w", err)
	}

	etiqueta, err := tx.Exec(ctx, `UPDATE cotacoes
		SET valor_total = $2, data_resposta = $3, status = $4, updated_by = $5
		WHERE id = $1`,
		id, valorTotal, resposta.DataResposta, cotacao.StatusRespondida, autor)
	if err != nil {
		return nil, fmt.Errorf("atualizar cotacao apos resposta: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return nil, cotacao.ErrNaoEncontrado
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("confirmar registro de resposta: %w", err)
	}

	return r.BuscarPorID(ctx, id)
}
