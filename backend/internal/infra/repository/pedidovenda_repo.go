package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidovenda"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// emTransacao roda f numa transacao da conexao da requisicao (a mesma que os
// triggers de auditoria leem).
func emTransacao(ctx context.Context, pool *pgxpool.Pool, f func(pgx.Tx) error) error {
	tx, err := db.DoContexto(ctx, pool).Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := f(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

const colunasPedidoVenda = `pv.id, pv.numero_pedido, coalesce(pv.cliente_id, 0),
	coalesce(c.razao_social, pv.cliente_nome, ''), pv.data_pedido, pv.data_entrega_prometida,
	pv.data_entrega_real, pv.valor_total, pv.status, coalesce(pv.observacoes, ''), pv.created_at, pv.updated_at`

const fromPedidoVenda = ` FROM pedidos_venda pv LEFT JOIN clientes c ON c.id = pv.cliente_id `

// PedidoVendaRepositorio implementa pedidovenda.Repositorio.
type PedidoVendaRepositorio struct {
	pool *pgxpool.Pool
}

// NovoPedidoVendaRepositorio cria o repositorio de pedidos de venda.
func NovoPedidoVendaRepositorio(pool *pgxpool.Pool) *PedidoVendaRepositorio {
	return &PedidoVendaRepositorio{pool: pool}
}

func lerPedidoVenda(l linha) (*pedidovenda.PedidoVenda, error) {
	var p pedidovenda.PedidoVenda
	if err := l.Scan(&p.ID, &p.NumeroPedido, &p.ClienteID, &p.ClienteNome, &p.DataPedido, &p.DataEntregaPrometida,
		&p.DataEntregaReal, &p.ValorTotal, &p.Status, &p.Observacoes, &p.CreatedAt, &p.UpdatedAt); err != nil {
		return nil, err
	}
	return &p, nil
}

// conferirReferencias valida cliente ativo e produtos ativos dentro da transacao.
func conferirReferencias(ctx context.Context, tx pgx.Tx, d pedidovenda.Dados) error {
	var clienteOK bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM clientes WHERE id = $1 AND ativo)`, d.ClienteID).Scan(&clienteOK); err != nil {
		return fmt.Errorf("conferir cliente: %w", err)
	}
	if !clienteOK {
		return pedidovenda.ErrClienteInvalido
	}
	ids := make([]int64, 0, len(d.Itens))
	for _, i := range d.Itens {
		ids = append(ids, i.ProdutoAcabadoID)
	}
	var ativos int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM produtos_acabados WHERE id = ANY($1) AND ativo`, ids).Scan(&ativos); err != nil {
		return fmt.Errorf("conferir produtos: %w", err)
	}
	if ativos != len(ids) {
		return pedidovenda.ErrProdutoInvalido
	}
	return nil
}

func gravarItensPedidoVenda(ctx context.Context, tx pgx.Tx, pedidoID int64, itens []pedidovenda.ItemDados) (dinheiro.Dinheiro, error) {
	var total dinheiro.Dinheiro
	for _, i := range itens {
		t := i.PrecoUnitario.Vezes(i.Quantidade)
		total = total.Mais(t)
		if _, err := tx.Exec(ctx, `
			INSERT INTO itens_pedido_venda (pedido_venda_id, produto_acabado_id, quantidade, preco_unitario, total)
			VALUES ($1, $2, $3, $4, $5)`, pedidoID, i.ProdutoAcabadoID, i.Quantidade, i.PrecoUnitario, t); err != nil {
			return 0, fmt.Errorf("gravar item do pedido de venda: %w", err)
		}
	}
	return total, nil
}

// Criar grava cabecalho e itens.
func (r *PedidoVendaRepositorio) Criar(ctx context.Context, d pedidovenda.Dados, autor string) (int64, error) {
	var id int64
	err := emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		if err := conferirReferencias(ctx, tx, d); err != nil {
			return err
		}
		err := tx.QueryRow(ctx, `
			INSERT INTO pedidos_venda (numero_pedido, cliente_id, cliente_nome, data_pedido, data_entrega_prometida,
			  valor_total, status, observacoes, created_by, updated_by)
			SELECT $1, $2, razao_social, $3, $4, 0, 'Aberto', $5, $6, $6 FROM clientes WHERE id = $2
			RETURNING id`, d.NumeroPedido, d.ClienteID, d.DataPedido, d.DataEntregaPrometida, d.Observacoes, autor).Scan(&id)
		if violouIndiceUnico(err) {
			return pedidovenda.ErrNumeroDuplicado
		}
		if err != nil {
			return fmt.Errorf("criar pedido de venda: %w", err)
		}
		total, err := gravarItensPedidoVenda(ctx, tx, id, d.Itens)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE pedidos_venda SET valor_total = $2 WHERE id = $1`, id, total)
		return err
	})
	return id, err
}

// Atualizar regrava o pedido (o servico ja conferiu que esta Aberto e sem OP
// em andamento); itens com OP cancelada saem junto com a OP.
func (r *PedidoVendaRepositorio) Atualizar(ctx context.Context, id int64, d pedidovenda.Dados, autor string) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		if err := conferirReferencias(ctx, tx, d); err != nil {
			return err
		}
		etiqueta, err := tx.Exec(ctx, `
			UPDATE pedidos_venda SET numero_pedido = $2, cliente_id = $3,
			  cliente_nome = (SELECT razao_social FROM clientes WHERE id = $3),
			  data_pedido = $4, data_entrega_prometida = $5, observacoes = $6, updated_by = $7
			WHERE id = $1 AND status = 'Aberto'`,
			id, d.NumeroPedido, d.ClienteID, d.DataPedido, d.DataEntregaPrometida, d.Observacoes, autor)
		if violouIndiceUnico(err) {
			return pedidovenda.ErrNumeroDuplicado
		}
		if err != nil {
			return fmt.Errorf("atualizar pedido de venda: %w", err)
		}
		if etiqueta.RowsAffected() == 0 {
			return pedidovenda.ErrStatusInvalidoParaAcao
		}
		if _, err := tx.Exec(ctx, `
			DELETE FROM ordens_producao WHERE status = 'Cancelada' AND item_pedido_venda_id IN
			  (SELECT id FROM itens_pedido_venda WHERE pedido_venda_id = $1)
			  AND NOT EXISTS (SELECT 1 FROM numeros_serie s WHERE s.ordem_producao_id = ordens_producao.id)`, id); err != nil {
			return fmt.Errorf("remover OPs canceladas: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM itens_pedido_venda WHERE pedido_venda_id = $1`, id); err != nil {
			if violouChaveEstrangeira(err) {
				return pedidovenda.ErrItensComHistorico
			}
			return fmt.Errorf("regravar itens: %w", err)
		}
		total, err := gravarItensPedidoVenda(ctx, tx, id, d.Itens)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE pedidos_venda SET valor_total = $2 WHERE id = $1`, id, total)
		return err
	})
}

// BuscarPorID devolve o pedido com os itens e a OP de cada um.
func (r *PedidoVendaRepositorio) BuscarPorID(ctx context.Context, id int64) (*pedidovenda.PedidoVenda, error) {
	conexao := db.DoContexto(ctx, r.pool)
	p, err := lerPedidoVenda(conexao.QueryRow(ctx, `SELECT `+colunasPedidoVenda+fromPedidoVenda+`WHERE pv.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, pedidovenda.ErrNaoEncontrado
	}
	if err != nil {
		return nil, fmt.Errorf("buscar pedido de venda: %w", err)
	}
	linhas, err := conexao.Query(ctx, `
		SELECT i.id, i.produto_acabado_id, pa.codigo, pa.descricao, i.quantidade, i.preco_unitario, i.total,
		       op.id, op.numero_op, op.status, op.etapa_atual
		FROM itens_pedido_venda i
		JOIN produtos_acabados pa ON pa.id = i.produto_acabado_id
		LEFT JOIN LATERAL (
		  SELECT id, numero_op, status, etapa_atual FROM ordens_producao
		  WHERE item_pedido_venda_id = i.id ORDER BY (status <> 'Cancelada') DESC, id DESC LIMIT 1
		) op ON TRUE
		WHERE i.pedido_venda_id = $1 ORDER BY i.id`, id)
	if err != nil {
		return nil, fmt.Errorf("listar itens do pedido de venda: %w", err)
	}
	defer linhas.Close()
	p.Itens = []pedidovenda.Item{}
	for linhas.Next() {
		var i pedidovenda.Item
		if err := linhas.Scan(&i.ID, &i.ProdutoAcabadoID, &i.ProdutoCodigo, &i.ProdutoDescricao, &i.Quantidade,
			&i.PrecoUnitario, &i.Total, &i.OrdemProducaoID, &i.NumeroOP, &i.StatusOP, &i.EtapaOP); err != nil {
			return nil, err
		}
		p.Itens = append(p.Itens, i)
	}
	return p, linhas.Err()
}

// Listar devolve uma pagina de pedidos (filtro por status e busca).
func (r *PedidoVendaRepositorio) Listar(ctx context.Context, params consulta.Parametros) ([]pedidovenda.PedidoVenda, int, error) {
	condicoes, argumentos := "", []any{}
	if params.FiltroStatus != nil {
		argumentos = append(argumentos, *params.FiltroStatus)
		condicoes = fmt.Sprintf("WHERE pv.status = $%d", len(argumentos))
	}
	if params.Busca != "" {
		argumentos = append(argumentos, "%"+params.Busca+"%")
		c := fmt.Sprintf("(pv.numero_pedido ILIKE $%[1]d OR c.razao_social ILIKE $%[1]d)", len(argumentos))
		if condicoes == "" {
			condicoes = "WHERE " + c
		} else {
			condicoes += " AND " + c
		}
	}
	conexao := db.DoContexto(ctx, r.pool)
	var total int
	if err := conexao.QueryRow(ctx, `SELECT count(*)`+fromPedidoVenda+condicoes, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar pedidos de venda: %w", err)
	}
	ordem := "pv." + params.OrdenarPor
	if params.OrdenarPor == "cliente" {
		ordem = "c.razao_social"
	}
	sql := fmt.Sprintf("SELECT %s %s %s ORDER BY %s %s, pv.id DESC LIMIT $%d OFFSET $%d", colunasPedidoVenda, fromPedidoVenda,
		condicoes, ordem, params.Ordem.SQL(), len(argumentos)+1, len(argumentos)+2)
	linhas, err := conexao.Query(ctx, sql, append(argumentos, params.Limite, params.Offset())...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar pedidos de venda: %w", err)
	}
	defer linhas.Close()
	itens := []pedidovenda.PedidoVenda{}
	for linhas.Next() {
		p, err := lerPedidoVenda(linhas)
		if err != nil {
			return nil, 0, err
		}
		itens = append(itens, *p)
	}
	return itens, total, linhas.Err()
}

// Cancelar cancela o pedido e as OPs ainda Abertas.
func (r *PedidoVendaRepositorio) Cancelar(ctx context.Context, id int64, autor string) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		// Trava o pedido antes das OPs (mesma ordem de producao_repo.travarOP):
		// uma liberacao ou geracao de OP concorrente espera, ou e esperada.
		var status string
		if err := tx.QueryRow(ctx, `SELECT status FROM pedidos_venda WHERE id = $1 FOR UPDATE`, id).Scan(&status); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return pedidovenda.ErrNaoEncontrado
			}
			return fmt.Errorf("travar pedido: %w", err)
		}
		if status == pedidovenda.StatusEntregue || status == pedidovenda.StatusCancelado {
			return pedidovenda.ErrStatusInvalidoParaAcao
		}
		var emAndamento bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (SELECT 1 FROM ordens_producao op JOIN itens_pedido_venda i ON i.id = op.item_pedido_venda_id
			  WHERE i.pedido_venda_id = $1 AND op.status IN ('Liberada', 'Concluida'))`, id).Scan(&emAndamento); err != nil {
			return fmt.Errorf("conferir OPs do pedido: %w", err)
		}
		if emAndamento {
			return pedidovenda.ErrPossuiOPEmAndamento
		}
		if _, err := tx.Exec(ctx, `
			UPDATE ordens_producao SET status = 'Cancelada', updated_by = $2
			WHERE status = 'Aberta' AND item_pedido_venda_id IN (SELECT id FROM itens_pedido_venda WHERE pedido_venda_id = $1)`,
			id, autor); err != nil {
			return fmt.Errorf("cancelar OPs do pedido: %w", err)
		}
		_, err := tx.Exec(ctx, `UPDATE pedidos_venda SET status = 'Cancelado', updated_by = $2 WHERE id = $1`, id, autor)
		return err
	})
}

// RegistrarEntrega baixa o PA de cada item (estoque de produto acabado), marca
// as series do pedido como expedidas e fecha o pedido.
func (r *PedidoVendaRepositorio) RegistrarEntrega(ctx context.Context, id int64, autor string) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		var numero string
		if err := tx.QueryRow(ctx, `SELECT numero_pedido FROM pedidos_venda WHERE id = $1 AND status = 'Pronto para Envio' FOR UPDATE`,
			id).Scan(&numero); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return pedidovenda.ErrStatusInvalidoParaAcao
			}
			return fmt.Errorf("travar pedido: %w", err)
		}
		linhas, err := tx.Query(ctx, `SELECT produto_acabado_id, quantidade FROM itens_pedido_venda WHERE pedido_venda_id = $1 ORDER BY produto_acabado_id`, id)
		if err != nil {
			return fmt.Errorf("itens da entrega: %w", err)
		}
		type baixa struct {
			produto int64
			qtd     int
		}
		var baixas []baixa
		for linhas.Next() {
			var b baixa
			if err := linhas.Scan(&b.produto, &b.qtd); err != nil {
				linhas.Close()
				return err
			}
			baixas = append(baixas, b)
		}
		linhas.Close()
		for _, b := range baixas {
			etiqueta, err := tx.Exec(ctx, `
				UPDATE saldo_produto_acabado SET quantidade_atual = quantidade_atual - $2, updated_by = $3
				WHERE produto_acabado_id = $1 AND quantidade_atual >= $2`, b.produto, b.qtd, autor)
			if err != nil {
				return fmt.Errorf("baixar produto acabado: %w", err)
			}
			if etiqueta.RowsAffected() == 0 {
				return pedidovenda.ErrSaldoPAInsuficiente
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO movimentacao_estoque (produto_acabado_id, tipo, quantidade, motivo, referencia_numero, usuario_id,
				  documento_tipo, documento_id)
				VALUES ($1, $2, $3, $4, $5, (SELECT id FROM usuarios WHERE username = $6), 'PEDIDO_VENDA', $7)`,
				b.produto, estoque.TipoSaida, -b.qtd, estoque.MotivoExpedicao, numero, autor, id); err != nil {
				return fmt.Errorf("registrar saida do produto acabado: %w", err)
			}
		}
		if _, err := tx.Exec(ctx, `
			UPDATE numeros_serie SET status = 'Expedido', pedido_venda_entrega_id = $1, expedido_em = CURRENT_TIMESTAMP
			WHERE status = 'Em Estoque' AND ordem_producao_id IN (
			  SELECT op.id FROM ordens_producao op JOIN itens_pedido_venda i ON i.id = op.item_pedido_venda_id
			  WHERE i.pedido_venda_id = $1)`, id); err != nil {
			return fmt.Errorf("expedir series: %w", err)
		}
		_, err = tx.Exec(ctx, `UPDATE pedidos_venda SET status = 'Entregue', data_entrega_real = CURRENT_DATE, updated_by = $2 WHERE id = $1`, id, autor)
		return err
	})
}
