package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasPedidoCompra = `id, numero_pc, cotacao_id, fornecedor_id, data_pedido, data_entrega_prevista,
	data_entrega_real, valor_total, coalesce(condicao_pagamento, ''), status, coalesce(observacoes, ''),
	created_at, updated_at, created_by, updated_by, motivo_encerramento, encerrado_por`

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
	tx, err := db.DoContexto(ctx, r.pool).Begin(ctx)
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
	tx, err := db.DoContexto(ctx, r.pool).Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	sql := `UPDATE pedidos_compra
		SET numero_pc = $2, fornecedor_id = $3, data_pedido = $4, data_entrega_prevista = $5,
		    valor_total = $6, condicao_pagamento = $7, observacoes = $8, updated_by = $9
		WHERE id = $1 AND status = 'Rascunho'
		RETURNING updated_at`

	err = tx.QueryRow(ctx, sql,
		p.ID, p.NumeroPC, p.FornecedorID, p.DataPedido, p.DataEntregaPrevista,
		p.ValorTotal, p.CondicaoPagamento, p.Observacoes, autor,
	).Scan(&p.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// A condicao de status no proprio UPDATE fecha a corrida com
			// Emitir: o Servico conferiu Rascunho antes, mas o pedido pode ter
			// sido emitido entre a leitura e esta escrita.
			return naoEncontradoOuForaDeRascunho(ctx, tx, p.ID)
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
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, `SELECT `+colunasPedidoCompra+` FROM pedidos_compra WHERE id = $1`, id).Scan(
		&p.ID, &p.NumeroPC, &p.CotacaoID, &p.FornecedorID, &p.DataPedido, &p.DataEntregaPrevista,
		&p.DataEntregaReal, &p.ValorTotal, &p.CondicaoPagamento, &p.Status, &p.Observacoes,
		&p.CreatedAt, &p.UpdatedAt, &p.CreatedBy, &p.UpdatedBy, &p.MotivoEncerramento, &p.EncerradoPor,
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
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx,
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
	if err := db.DoContexto(ctx, r.pool).QueryRow(ctx,
		`SELECT count(*) FROM pedidos_compra `+filtros, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar pedidos de compra: %w", err)
	}

	sql := fmt.Sprintf("SELECT %s FROM pedidos_compra %s ORDER BY %s %s LIMIT $%d OFFSET $%d",
		colunasPedidoCompra, filtros, params.OrdenarPor, params.Ordem.SQL(),
		len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, params.Limite, params.Offset())

	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, sql, argumentos...)
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
			&p.CreatedAt, &p.UpdatedAt, &p.CreatedBy, &p.UpdatedBy, &p.MotivoEncerramento, &p.EncerradoPor,
		); err != nil {
			return nil, 0, err
		}
		itens = append(itens, p)
	}
	return itens, total, linhas.Err()
}

// ListarParaRelatorio devolve todos os pedidos de compra (sem paginacao),
// com o nome do fornecedor ja resolvido via JOIN -- so para a exportacao
// CSV, que precisa ser legivel sem o cliente resolver o id depois.
func (r *PedidoCompraRepositorio) ListarParaRelatorio(ctx context.Context) ([]pedidocompra.LinhaRelatorio, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT pc.numero_pc, f.razao_social, pc.status, pc.data_pedido, pc.data_entrega_prevista,
		       pc.data_entrega_real, pc.valor_total
		FROM pedidos_compra pc JOIN fornecedores f ON f.id = pc.fornecedor_id
		ORDER BY pc.numero_pc`)
	if err != nil {
		return nil, fmt.Errorf("listar pedidos de compra para relatorio: %w", err)
	}
	defer linhas.Close()

	itens := make([]pedidocompra.LinhaRelatorio, 0)
	for linhas.Next() {
		var l pedidocompra.LinhaRelatorio
		if err := linhas.Scan(
			&l.NumeroPC, &l.FornecedorNome, &l.Status, &l.DataPedido, &l.DataEntregaPrevista,
			&l.DataEntregaReal, &l.ValorTotal,
		); err != nil {
			return nil, err
		}
		itens = append(itens, l)
	}
	return itens, linhas.Err()
}

// naoEncontradoOuForaDeRascunho distingue, depois de um UPDATE condicionado
// que nao afetou linha, o pedido inexistente do que ja saiu de Rascunho.
func naoEncontradoOuForaDeRascunho(ctx context.Context, tx pgx.Tx, id int64) error {
	var existe bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pedidos_compra WHERE id = $1)`, id).Scan(&existe); err != nil {
		return fmt.Errorf("conferir pedido de compra: %w", err)
	}
	if !existe {
		return pedidocompra.ErrNaoEncontrado
	}
	return pedidocompra.ErrStatusInvalidoParaAcao
}

// Emitir passa o pedido de Rascunho para o status informado SO se ele ainda
// estiver em Rascunho e com o mesmo valor total que o Servico conferiu contra
// a alcada e o minimo de cotacoes. Sem essa condicao, uma edicao concorrente
// (PUT trocando os itens) entre a conferencia e a escrita deixaria o Gestor
// emitir um valor que nunca passou pela alcada.
func (r *PedidoCompraRepositorio) Emitir(ctx context.Context, id int64, valorConferido dinheiro.Dinheiro, status, autor string) error {
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx,
		`UPDATE pedidos_compra SET status = $3, updated_by = $4
		 WHERE id = $1 AND status = 'Rascunho' AND valor_total = $2`,
		id, valorConferido, status, autor)
	if err != nil {
		return fmt.Errorf("emitir pedido de compra: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return pedidocompra.ErrStatusInvalidoParaAcao
	}
	return nil
}

// AtualizarStatus troca so o status (emitir/cancelar).
func (r *PedidoCompraRepositorio) AtualizarStatus(ctx context.Context, id int64, status string, autor string) error {
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx,
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

	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, sql, statusTerminais)
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
			&p.CreatedAt, &p.UpdatedAt, &p.CreatedBy, &p.UpdatedBy, &p.MotivoEncerramento, &p.EncerradoPor,
		); err != nil {
			return nil, err
		}
		itens = append(itens, p)
	}
	return itens, linhas.Err()
}

// Encerrar fecha o pedido com saldo pendente (so de Aguardando Entrega ou
// Recebido Parcial), guardando o motivo.
func (r *PedidoCompraRepositorio) Encerrar(ctx context.Context, id int64, motivo, autor string) error {
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx, `
		UPDATE pedidos_compra SET status = 'Concluido', motivo_encerramento = $2, encerrado_por = $3,
		  data_entrega_real = coalesce(data_entrega_real, CURRENT_DATE), updated_by = $3
		WHERE id = $1 AND status IN ('Aguardando Entrega', 'Recebido Parcial')`, id, motivo, autor)
	if err != nil {
		return fmt.Errorf("encerrar pedido de compra: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return pedidocompra.ErrStatusInvalidoParaAcao
	}
	return nil
}

// ContarCotacoesRespondidas conta, por peca, os FORNECEDORES distintos com
// cotacao Respondida para a peca e data_emissao entre `desde` e `ate` -- tres
// cotacoes do mesmo fornecedor nao comparam preco nenhum, e uma data de
// emissao no futuro nao pode contar para sempre. Toda peca pedida volta na
// lista, inclusive com zero (LEFT JOIN) -- a mensagem de erro precisa do
// codigo de quem nao tem nenhuma cotacao.
func (r *PedidoCompraRepositorio) ContarCotacoesRespondidas(
	ctx context.Context, pecaIDs []int64, desde, ate tempo.Data,
) ([]pedidocompra.ContagemCotacoes, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT pp.id, pp.codigo, count(DISTINCT c.fornecedor_id)
		FROM partes_pecas pp
		LEFT JOIN itens_cotacao ic ON ic.parte_peca_id = pp.id
		LEFT JOIN cotacoes c ON c.id = ic.cotacao_id
		                    AND c.status = 'Respondida'
		                    AND c.data_emissao BETWEEN $2 AND $3
		WHERE pp.id = ANY($1)
		GROUP BY pp.id, pp.codigo
		ORDER BY pp.codigo`, pecaIDs, desde, ate)
	if err != nil {
		return nil, fmt.Errorf("contar cotacoes respondidas: %w", err)
	}
	defer linhas.Close()

	var contagens []pedidocompra.ContagemCotacoes
	for linhas.Next() {
		var c pedidocompra.ContagemCotacoes
		if err := linhas.Scan(&c.PartePecaID, &c.Codigo, &c.Quantidade); err != nil {
			return nil, fmt.Errorf("ler contagem de cotacoes: %w", err)
		}
		contagens = append(contagens, c)
	}
	return contagens, linhas.Err()
}
