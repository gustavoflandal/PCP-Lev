package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/rastreio"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasLote = `l.id, l.parte_peca_id, pp.codigo, pp.descricao, l.numero_lote, l.fornecedor_id, coalesce(f.razao_social, ''),
	l.data_fabricacao, l.validade, l.quantidade_atual, l.quantidade_reservada, coalesce(l.validade < CURRENT_DATE, FALSE)`

const fromLote = ` FROM lotes l JOIN partes_pecas pp ON pp.id = l.parte_peca_id LEFT JOIN fornecedores f ON f.id = l.fornecedor_id `

// RastreioRepositorio implementa rastreio.Repositorio.
type RastreioRepositorio struct {
	pool *pgxpool.Pool
}

// NovoRastreioRepositorio cria o repositorio das consultas de rastreabilidade.
func NovoRastreioRepositorio(pool *pgxpool.Pool) *RastreioRepositorio {
	return &RastreioRepositorio{pool: pool}
}

func lerLote(l linha) (*rastreio.Lote, error) {
	var x rastreio.Lote
	if err := l.Scan(&x.ID, &x.PartePecaID, &x.PecaCodigo, &x.PecaDescricao, &x.NumeroLote, &x.FornecedorID, &x.FornecedorNome,
		&x.DataFabricacao, &x.Validade, &x.QuantidadeAtual, &x.QuantidadeReservada, &x.Vencido); err != nil {
		return nil, err
	}
	return &x, nil
}

func (r *RastreioRepositorio) lotes(ctx context.Context, where string, args ...any) ([]rastreio.Lote, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `SELECT `+colunasLote+fromLote+where+` ORDER BY l.validade NULLS LAST, l.id LIMIT 500`, args...)
	if err != nil {
		return nil, fmt.Errorf("listar lotes: %w", err)
	}
	defer linhas.Close()
	lista := []rastreio.Lote{}
	for linhas.Next() {
		x, err := lerLote(linhas)
		if err != nil {
			return nil, err
		}
		lista = append(lista, *x)
	}
	return lista, linhas.Err()
}

// ListarLotes devolve lotes filtrados (FEFO: validade mais proxima primeiro).
func (r *RastreioRepositorio) ListarLotes(ctx context.Context, f rastreio.FiltroLotes) ([]rastreio.Lote, error) {
	condicoes, args := []string{"TRUE"}, []any{}
	if f.PartePecaID > 0 {
		args = append(args, f.PartePecaID)
		condicoes = append(condicoes, fmt.Sprintf("l.parte_peca_id = $%d", len(args)))
	}
	if f.Busca != "" {
		args = append(args, "%"+f.Busca+"%")
		condicoes = append(condicoes, fmt.Sprintf("(l.numero_lote ILIKE $%[1]d OR pp.codigo ILIKE $%[1]d)", len(args)))
	}
	if f.VencendoDias > 0 {
		args = append(args, f.VencendoDias)
		condicoes = append(condicoes, fmt.Sprintf("l.validade <= CURRENT_DATE + $%d::int", len(args)))
	}
	if f.SoComSaldo {
		condicoes = append(condicoes, "l.quantidade_atual > 0")
	}
	return r.lotes(ctx, " WHERE "+strings.Join(condicoes, " AND "), args...)
}

// RastrearLote: entradas (NF), OPs que consumiram e unidades afetadas.
func (r *RastreioRepositorio) RastrearLote(ctx context.Context, id int64) (*rastreio.RastreioLote, error) {
	conexao := db.DoContexto(ctx, r.pool)
	l, err := lerLote(conexao.QueryRow(ctx, `SELECT `+colunasLote+fromLote+`WHERE l.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, rastreio.ErrLoteNaoEncontrado
	}
	if err != nil {
		return nil, fmt.Errorf("buscar lote: %w", err)
	}
	res := &rastreio.RastreioLote{Lote: *l, Entradas: []rastreio.EntradaNF{}, Consumos: []rastreio.ConsumoOP{}, Unidades: []rastreio.UnidadeAfetada{}}

	linhas, err := conexao.Query(ctx, `
		SELECT n.id, n.numero, n.serie, n.data_entrada, f.razao_social, inl.quantidade, i.custo_unitario_entrada::float8
		FROM itens_nf_lotes inl
		JOIN itens_nf_entrada i ON i.id = inl.item_nf_id
		JOIN notas_fiscais_entrada n ON n.id = i.nota_id AND n.status = 'Efetivada'
		JOIN fornecedores f ON f.id = n.fornecedor_id
		WHERE inl.lote_id = $1 ORDER BY n.data_entrada, n.id`, id)
	if err != nil {
		return nil, fmt.Errorf("entradas do lote: %w", err)
	}
	for linhas.Next() {
		var e rastreio.EntradaNF
		if err := linhas.Scan(&e.NotaID, &e.Numero, &e.Serie, &e.DataEntrada, &e.FornecedorNome, &e.Quantidade, &e.CustoUnitario); err != nil {
			linhas.Close()
			return nil, err
		}
		res.Entradas = append(res.Entradas, e)
	}
	linhas.Close()

	linhas, err = conexao.Query(ctx, `
		SELECT op.id, op.numero_op, r.quantidade, pa.codigo
		FROM reservas_lote r JOIN ordens_producao op ON op.id = r.ordem_producao_id
		JOIN produtos_acabados pa ON pa.id = op.produto_acabado_id
		WHERE r.lote_id = $1 AND r.consumida ORDER BY op.id`, id)
	if err != nil {
		return nil, fmt.Errorf("consumos do lote: %w", err)
	}
	for linhas.Next() {
		var c rastreio.ConsumoOP
		if err := linhas.Scan(&c.OrdemProducaoID, &c.NumeroOP, &c.Quantidade, &c.ProdutoCodigo); err != nil {
			linhas.Close()
			return nil, err
		}
		res.Consumos = append(res.Consumos, c)
	}
	linhas.Close()

	// Unidades das OPs que consumiram o lote; "direta" quando uma serie de
	// componente do lote esta instalada nela.
	linhas, err = conexao.Query(ctx, `
		SELECT ns.id, ns.numero, ns.status, pa.codigo, op.numero_op, pv.id, pv.numero_pedido,
		       coalesce(c.razao_social, pv.cliente_nome, ''),
		       EXISTS (SELECT 1 FROM series_componente sc WHERE sc.numero_serie_pai_id = ns.id AND sc.lote_id = $1)
		FROM numeros_serie ns
		JOIN ordens_producao op ON op.id = ns.ordem_producao_id
		JOIN produtos_acabados pa ON pa.id = ns.produto_acabado_id
		JOIN itens_pedido_venda i ON i.id = op.item_pedido_venda_id
		JOIN pedidos_venda pv ON pv.id = i.pedido_venda_id
		LEFT JOIN clientes c ON c.id = pv.cliente_id
		WHERE ns.status <> 'Cancelado' AND op.id IN (SELECT ordem_producao_id FROM reservas_lote WHERE lote_id = $1 AND consumida)
		ORDER BY ns.numero`, id)
	if err != nil {
		return nil, fmt.Errorf("unidades afetadas: %w", err)
	}
	defer linhas.Close()
	for linhas.Next() {
		var u rastreio.UnidadeAfetada
		if err := linhas.Scan(&u.SerieID, &u.Numero, &u.Status, &u.ProdutoCodigo, &u.NumeroOP, &u.PedidoVendaID, &u.NumeroPedido,
			&u.ClienteNome, &u.Direta); err != nil {
			return nil, err
		}
		res.Unidades = append(res.Unidades, u)
	}
	return res, linhas.Err()
}

// Kardex devolve o extrato com saldo acumulado (mais recente primeiro).
func (r *RastreioRepositorio) Kardex(ctx context.Context, partePecaID int64, limite int) ([]rastreio.Movimento, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT * FROM (
		  SELECT m.id, m.data_hora, m.tipo, m.motivo, m.quantidade,
		         sum(m.quantidade) OVER (ORDER BY m.data_hora, m.id)::int AS saldo,
		         m.documento_tipo, m.documento_id, m.referencia_numero, l.numero_lote, u.username, m.custo_unitario::float8,
		         coalesce(m.observacoes, '')
		  FROM movimentacao_estoque m
		  LEFT JOIN lotes l ON l.id = m.lote_id
		  LEFT JOIN usuarios u ON u.id = m.usuario_id
		  WHERE m.parte_peca_id = $1) k
		ORDER BY k.data_hora DESC, k.id DESC LIMIT $2`, partePecaID, limite)
	if err != nil {
		return nil, fmt.Errorf("kardex: %w", err)
	}
	defer linhas.Close()
	lista := []rastreio.Movimento{}
	for linhas.Next() {
		var m rastreio.Movimento
		if err := linhas.Scan(&m.ID, &m.DataHora, &m.Tipo, &m.Motivo, &m.Quantidade, &m.Saldo, &m.DocumentoTipo, &m.DocumentoID,
			&m.Referencia, &m.NumeroLote, &m.Usuario, &m.CustoUnitario, &m.Observacoes); err != nil {
			return nil, err
		}
		lista = append(lista, m)
	}
	return lista, linhas.Err()
}

// Origens: lotes com saldo e as notas mais recentes que cobrem o saldo atual
// (FIFO: o que sobrou e o que entrou por ultimo).
func (r *RastreioRepositorio) Origens(ctx context.Context, partePecaID int64) (*rastreio.Origens, error) {
	conexao := db.DoContexto(ctx, r.pool)
	o := &rastreio.Origens{PartePecaID: partePecaID, Entradas: []rastreio.EntradaNF{}}
	if err := conexao.QueryRow(ctx, `SELECT quantidade_atual FROM saldo_estoque WHERE parte_peca_id = $1`, partePecaID).Scan(&o.Saldo); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, rastreio.ErrLoteNaoEncontrado
		}
		return nil, fmt.Errorf("ler saldo: %w", err)
	}
	var err error
	if o.Lotes, err = r.lotes(ctx, " WHERE l.parte_peca_id = $1 AND l.quantidade_atual > 0", partePecaID); err != nil {
		return nil, err
	}
	linhas, err := conexao.Query(ctx, `
		SELECT n.id, n.numero, n.serie, n.data_entrada, f.razao_social, i.quantidade_recebida, i.custo_unitario_entrada::float8
		FROM itens_nf_entrada i
		JOIN notas_fiscais_entrada n ON n.id = i.nota_id AND n.status = 'Efetivada'
		JOIN fornecedores f ON f.id = n.fornecedor_id
		WHERE i.parte_peca_id = $1 AND i.quantidade_recebida > 0
		ORDER BY n.data_entrada DESC, n.id DESC`, partePecaID)
	if err != nil {
		return nil, fmt.Errorf("origens do saldo: %w", err)
	}
	defer linhas.Close()
	falta := o.Saldo
	for linhas.Next() && falta > 0 {
		var e rastreio.EntradaNF
		if err := linhas.Scan(&e.NotaID, &e.Numero, &e.Serie, &e.DataEntrada, &e.FornecedorNome, &e.Quantidade, &e.CustoUnitario); err != nil {
			return nil, err
		}
		e.Quantidade = min(e.Quantidade, falta)
		falta -= e.Quantidade
		o.Entradas = append(o.Entradas, e)
	}
	o.SemOrigem = max(falta, 0)
	return o, nil
}
