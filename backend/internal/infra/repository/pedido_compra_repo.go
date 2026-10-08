package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasPedidoCompra = `id, numero_pc, cotacao_id, fornecedor_id, data_pedido, data_entrega_prevista,
	data_entrega_real, valor_total, coalesce(condicao_pagamento, ''), status, coalesce(observacoes, ''),
	created_at, updated_at, created_by, updated_by`

const colunasItemPedidoCompra = `id, parte_peca_id, quantidade_solicitada, quantidade_recebida, preco_unitario, total`

// PedidoCompraRepositorio implementa pedidocompra.Repositorio sobre PostgreSQL.
type PedidoCompraRepositorio struct {
	pool *pgxpool.Pool
}

// NovoPedidoCompraRepositorio cria o repositorio de pedidos de compra.
func NovoPedidoCompraRepositorio(pool *pgxpool.Pool) *PedidoCompraRepositorio {
	return &PedidoCompraRepositorio{pool: pool}
}

// Criar grava o pedido de compra e os seus itens na mesma transacao.
func (r *PedidoCompraRepositorio) Criar(ctx context.Context, p *pedidocompra.PedidoCompra, autor string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	sql := `INSERT INTO pedidos_compra
		(numero_pc, cotacao_id, fornecedor_id, data_pedido, data_entrega_prevista,
		 valor_total, condicao_pagamento, status, observacoes, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
		RETURNING id, created_at, updated_at`

	err = tx.QueryRow(ctx, sql,
		p.NumeroPC, p.CotacaoID, p.FornecedorID, p.DataPedido, p.DataEntregaPrevista,
		p.ValorTotal, p.CondicaoPagamento, p.Status, p.Observacoes, autor,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		if violouIndiceUnico(err) {
			return pedidocompra.ErrNumeroPCDuplicado
		}
		if violouChaveEstrangeira(err) {
			return pedidocompra.ErrFornecedorOuPecaInexistente
		}
		return fmt.Errorf("criar pedido de compra: %w", err)
	}

	for i, item := range p.Itens {
		err := tx.QueryRow(ctx, `INSERT INTO itens_pedido_compra
			(pedido_compra_id, parte_peca_id, quantidade_solicitada, preco_unitario, total)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id`,
			p.ID, item.PartePecaID, item.QuantidadeSolicitada, item.PrecoUnitario, item.Total,
		).Scan(&p.Itens[i].ID)
		if err != nil {
			if violouChaveEstrangeira(err) {
				return pedidocompra.ErrFornecedorOuPecaInexistente
			}
			return fmt.Errorf("criar item do pedido de compra: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("confirmar criacao do pedido de compra: %w", err)
	}
	p.CreatedBy, p.UpdatedBy = &autor, &autor
	return nil
}

// Atualizar substitui os dados e os itens de um pedido de compra (so
// chamado em Rascunho — a guarda de status vive no Servico).
func (r *PedidoCompraRepositorio) Atualizar(ctx context.Context, p *pedidocompra.PedidoCompra, autor string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	sql := `UPDATE pedidos_compra
		SET numero_pc = $2, fornecedor_id = $3, data_pedido = $4, data_entrega_prevista = $5,
		    valor_total = $6, condicao_pagamento = $7, observacoes = $8, updated_by = $9
		WHERE id = $1
		RETURNING updated_at`

	err = tx.QueryRow(ctx, sql,
		p.ID, p.NumeroPC, p.FornecedorID, p.DataPedido, p.DataEntregaPrevista,
		p.ValorTotal, p.CondicaoPagamento, p.Observacoes, autor,
	).Scan(&p.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return pedidocompra.ErrNaoEncontrado
		}
		if violouIndiceUnico(err) {
			return pedidocompra.ErrNumeroPCDuplicado
		}
		if violouChaveEstrangeira(err) {
			return pedidocompra.ErrFornecedorOuPecaInexistente
		}
		return fmt.Errorf("atualizar pedido de compra: %w", err)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM itens_pedido_compra WHERE pedido_compra_id = $1`, p.ID); err != nil {
		return fmt.Errorf("limpar itens do pedido de compra: %w", err)
	}
	for i, item := range p.Itens {
		err := tx.QueryRow(ctx, `INSERT INTO itens_pedido_compra
			(pedido_compra_id, parte_peca_id, quantidade_solicitada, preco_unitario, total)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id`,
			p.ID, item.PartePecaID, item.QuantidadeSolicitada, item.PrecoUnitario, item.Total,
		).Scan(&p.Itens[i].ID)
		if err != nil {
			if violouChaveEstrangeira(err) {
				return pedidocompra.ErrFornecedorOuPecaInexistente
			}
			return fmt.Errorf("recriar item do pedido de compra: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("confirmar atualizacao do pedido de compra: %w", err)
	}
	p.UpdatedBy = &autor
	return nil
}

// BuscarPorID devolve o pedido de compra com os seus itens.
func (r *PedidoCompraRepositorio) BuscarPorID(ctx context.Context, id int64) (*pedidocompra.PedidoCompra, error) {
	var p pedidocompra.PedidoCompra
	err := r.pool.QueryRow(ctx, `SELECT `+colunasPedidoCompra+` FROM pedidos_compra WHERE id = $1`, id).Scan(
		&p.ID, &p.NumeroPC, &p.CotacaoID, &p.FornecedorID, &p.DataPedido, &p.DataEntregaPrevista,
		&p.DataEntregaReal, &p.ValorTotal, &p.CondicaoPagamento, &p.Status, &p.Observacoes,
		&p.CreatedAt, &p.UpdatedAt, &p.CreatedBy, &p.UpdatedBy,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pedidocompra.ErrNaoEncontrado
		}
		return nil, fmt.Errorf("buscar pedido de compra: %w", err)
	}

	itens, err := r.itensDoPedido(ctx, id)
	if err != nil {
		return nil, err
	}
	p.Itens = itens
	return &p, nil
}

func (r *PedidoCompraRepositorio) itensDoPedido(ctx context.Context, pedidoID int64) ([]pedidocompra.ItemPedido, error) {
	linhas, err := r.pool.Query(ctx,
		`SELECT `+colunasItemPedidoCompra+` FROM itens_pedido_compra WHERE pedido_compra_id = $1 ORDER BY id`, pedidoID)
	if err != nil {
		return nil, fmt.Errorf("buscar itens do pedido de compra: %w", err)
	}
	defer linhas.Close()

	itens := make([]pedidocompra.ItemPedido, 0)
	for linhas.Next() {
		var item pedidocompra.ItemPedido
		if err := linhas.Scan(&item.ID, &item.PartePecaID, &item.QuantidadeSolicitada,
			&item.QuantidadeRecebida, &item.PrecoUnitario, &item.Total); err != nil {
			return nil, err
		}
		itens = append(itens, item)
	}
	return itens, linhas.Err()
}

// Listar devolve so o cabecalho (sem itens).
func (r *PedidoCompraRepositorio) Listar(ctx context.Context, params consulta.Parametros) ([]pedidocompra.PedidoCompra, int, error) {
	filtros, argumentos := filtrosDeCompras(params, "numero_pc")

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT count(*) FROM pedidos_compra `+filtros, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar pedidos de compra: %w", err)
	}

	sql := fmt.Sprintf("SELECT %s FROM pedidos_compra %s ORDER BY %s %s LIMIT $%d OFFSET $%d",
		colunasPedidoCompra, filtros, params.OrdenarPor, params.Ordem.SQL(),
		len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, params.Limite, params.Offset())

	linhas, err := r.pool.Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar pedidos de compra: %w", err)
	}
	defer linhas.Close()

	itens := make([]pedidocompra.PedidoCompra, 0, params.Limite)
	for linhas.Next() {
		var p pedidocompra.PedidoCompra
		if err := linhas.Scan(
			&p.ID, &p.NumeroPC, &p.CotacaoID, &p.FornecedorID, &p.DataPedido, &p.DataEntregaPrevista,
			&p.DataEntregaReal, &p.ValorTotal, &p.CondicaoPagamento, &p.Status, &p.Observacoes,
			&p.CreatedAt, &p.UpdatedAt, &p.CreatedBy, &p.UpdatedBy,
		); err != nil {
			return nil, 0, err
		}
		itens = append(itens, p)
	}
	return itens, total, linhas.Err()
}

// AtualizarStatus troca so o status (emitir/cancelar).
func (r *PedidoCompraRepositorio) AtualizarStatus(ctx context.Context, id int64, status string, autor string) error {
	etiqueta, err := r.pool.Exec(ctx,
		`UPDATE pedidos_compra SET status = $2, updated_by = $3 WHERE id = $1`, id, status, autor)
	if err != nil {
		return fmt.Errorf("atualizar status do pedido de compra: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return pedidocompra.ErrNaoEncontrado
	}
	return nil
}

// EmAtraso devolve os pedidos com entrega vencida e status fora da lista de
// terminais informada.
func (r *PedidoCompraRepositorio) EmAtraso(ctx context.Context, statusTerminais []string) ([]pedidocompra.PedidoCompra, error) {
	sql := `SELECT ` + colunasPedidoCompra + ` FROM pedidos_compra
		WHERE data_entrega_prevista < CURRENT_DATE AND status <> ALL($1)
		ORDER BY data_entrega_prevista`

	linhas, err := r.pool.Query(ctx, sql, statusTerminais)
	if err != nil {
		return nil, fmt.Errorf("listar pedidos em atraso: %w", err)
	}
	defer linhas.Close()

	itens := make([]pedidocompra.PedidoCompra, 0)
	for linhas.Next() {
		var p pedidocompra.PedidoCompra
		if err := linhas.Scan(
			&p.ID, &p.NumeroPC, &p.CotacaoID, &p.FornecedorID, &p.DataPedido, &p.DataEntregaPrevista,
			&p.DataEntregaReal, &p.ValorTotal, &p.CondicaoPagamento, &p.Status, &p.Observacoes,
			&p.CreatedAt, &p.UpdatedAt, &p.CreatedBy, &p.UpdatedBy,
		); err != nil {
			return nil, err
		}
		itens = append(itens, p)
	}
	return itens, linhas.Err()
}

// RegistrarRecebimento soma quantidade_recebida por item (com FOR UPDATE
// para evitar corrida entre duas chamadas concorrentes), recalcula o status
// do pedido e devolve o pedido atualizado -- tudo na mesma transacao.
func (r *PedidoCompraRepositorio) RegistrarRecebimento(
	ctx context.Context, id int64, itens []pedidocompra.ItemRecebimentoDados, autor string,
) (*pedidocompra.PedidoCompra, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, item := range itens {
		if item.QuantidadeRecebida <= 0 {
			continue
		}
		var recebidaAtual, solicitada int
		err := tx.QueryRow(ctx,
			`SELECT quantidade_recebida, quantidade_solicitada FROM itens_pedido_compra
			 WHERE pedido_compra_id = $1 AND parte_peca_id = $2 FOR UPDATE`,
			id, item.PartePecaID,
		).Scan(&recebidaAtual, &solicitada)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, pedidocompra.ErrFornecedorOuPecaInexistente
			}
			return nil, fmt.Errorf("travar item do pedido: %w", err)
		}

		novaRecebida := recebidaAtual + item.QuantidadeRecebida
		if novaRecebida > solicitada {
			return nil, pedidocompra.ErrQuantidadeRecebidaExcedeSolicitada
		}

		if _, err := tx.Exec(ctx,
			`UPDATE itens_pedido_compra SET quantidade_recebida = $1
			 WHERE pedido_compra_id = $2 AND parte_peca_id = $3`,
			novaRecebida, id, item.PartePecaID,
		); err != nil {
			return nil, fmt.Errorf("atualizar quantidade recebida: %w", err)
		}
	}

	var pendentes int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM itens_pedido_compra WHERE pedido_compra_id = $1 AND quantidade_recebida < quantidade_solicitada`,
		id).Scan(&pendentes); err != nil {
		return nil, fmt.Errorf("verificar itens pendentes: %w", err)
	}

	novoStatus := pedidocompra.StatusRecebidoParcial
	var dataEntregaReal tempo.Data
	if pendentes == 0 {
		novoStatus = pedidocompra.StatusConcluido
		dataEntregaReal = tempo.Hoje()
	}

	if _, err := tx.Exec(ctx,
		`UPDATE pedidos_compra SET status = $2, data_entrega_real = $3, updated_by = $4 WHERE id = $1`,
		id, novoStatus, dataEntregaReal, autor,
	); err != nil {
		return nil, fmt.Errorf("atualizar status do pedido apos recebimento: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("confirmar recebimento: %w", err)
	}

	return r.BuscarPorID(ctx, id)
}
