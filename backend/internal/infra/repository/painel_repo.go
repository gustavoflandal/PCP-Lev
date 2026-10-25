package repository

import (
	"context"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/painel"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PainelRepositorio implementa painel.Repositorio: agregacoes so de leitura.
type PainelRepositorio struct {
	pool *pgxpool.Pool
}

// NovoPainelRepositorio cria o repositorio dos paineis.
func NovoPainelRepositorio(pool *pgxpool.Pool) *PainelRepositorio {
	return &PainelRepositorio{pool: pool}
}

// Situacoes que contam como "em aberto" em cada documento.
const (
	pcsEmAberto = `('Emitido', 'Aceito', 'Aguardando Entrega', 'Recebido Parcial')`
	pvsEmAberto = `('Aberto', 'Em Producao', 'Pronto para Envio')`
	opsAtivas   = `('Aberta', 'Liberada')`
)

// meses e semanas: series completas (sem buracos) para os graficos. O
// periodo mensal cobre no minimo 6 meses; o semanal, no maximo 26 semanas.
const (
	cteMeses = `meses AS (
		SELECT generate_series(date_trunc('month', CURRENT_DATE - GREATEST($1::int, 180)),
		                       date_trunc('month', CURRENT_DATE), interval '1 month')::date AS mes)`
	cteSemanas = `semanas AS (
		SELECT generate_series(date_trunc('week', CURRENT_DATE - LEAST($1::int, 182)),
		                       date_trunc('week', CURRENT_DATE), interval '1 week')::date AS semana)`
	// Ultima verificacao metrologica de cada unidade.
	cteMetrologia = `ultima_metrologia AS (
		SELECT DISTINCT ON (numero_serie_id) validade FROM metrologia_serie
		ORDER BY numero_serie_id, data_verificacao DESC, id DESC)`
)

func (r *PainelRepositorio) pontos(ctx context.Context, sql string, args ...any) ([]painel.Ponto, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("painel: %w", err)
	}
	defer linhas.Close()
	lista := []painel.Ponto{}
	for linhas.Next() {
		var p painel.Ponto
		if err := linhas.Scan(&p.Rotulo, &p.Valor); err != nil {
			return nil, err
		}
		lista = append(lista, p)
	}
	return lista, linhas.Err()
}

func (r *PainelRepositorio) linha(ctx context.Context, sql string, args []any, destinos ...any) error {
	if err := db.DoContexto(ctx, r.pool).QueryRow(ctx, sql, args...).Scan(destinos...); err != nil {
		return fmt.Errorf("painel: %w", err)
	}
	return nil
}

// opsPorEtapa: aguardando liberacao + as liberadas por etapa do Kanban, na
// ordem do fluxo.
const sqlOPsPorEtapa = `
	SELECT e.rotulo, count(o.id)::float8
	FROM (VALUES (1, 'Aberta', NULL), (2, 'Separacao', 'Separacao'), (3, 'Montagem', 'Montagem'),
	             (4, 'Testes', 'Testes'), (5, 'Expedicao', 'Expedicao')) AS e(ordem, rotulo, etapa)
	LEFT JOIN ordens_producao o ON (e.etapa IS NULL AND o.status = 'Aberta')
	                            OR (o.status = 'Liberada' AND o.etapa_atual = e.etapa)
	GROUP BY e.ordem, e.rotulo ORDER BY e.ordem`

// Inicio monta os blocos do Painel inicial que o usuario pode ver.
func (r *PainelRepositorio) Inicio(ctx context.Context, b painel.BlocosDoInicio) (*painel.Inicio, error) {
	ini := &painel.Inicio{}
	if b.Producao {
		p := &painel.InicioProducao{}
		if err := r.linha(ctx, `WITH `+cteMetrologia+`
			SELECT (SELECT count(*) FROM ordens_producao WHERE status IN `+opsAtivas+` AND data_conclusao_prevista < CURRENT_DATE)::int,
			       (SELECT count(*) FROM ultima_metrologia WHERE validade BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)::int`,
			nil, &p.OPsEmAtraso, &p.MetrologiaAVencer); err != nil {
			return nil, err
		}
		var err error
		if p.OPsPorEtapa, err = r.pontos(ctx, sqlOPsPorEtapa); err != nil {
			return nil, err
		}
		ini.Producao = p
	}
	if b.Compras {
		c := &painel.InicioCompras{}
		if err := r.linha(ctx, `SELECT count(*)::int, (count(*) FILTER (WHERE data_entrega_prevista < CURRENT_DATE))::int
			FROM pedidos_compra WHERE status IN `+pcsEmAberto, nil, &c.AReceber, &c.EmAtraso); err != nil {
			return nil, err
		}
		ini.Compras = c
	}
	if b.Estoque {
		e := &painel.InicioEstoque{}
		if err := r.linha(ctx, `SELECT (SELECT count(*) FROM saldo_estoque WHERE status = 'CRITICO')::int,
			(SELECT count(*) FROM lotes WHERE quantidade_atual > 0 AND validade BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)::int`,
			nil, &e.ItensCriticos, &e.LotesAVencer30); err != nil {
			return nil, err
		}
		ini.Estoque = e
	}
	if b.Notas {
		n := &painel.InicioNotas{}
		if err := r.linha(ctx, `SELECT count(*)::int FROM notas_fiscais_entrada WHERE status IN ('Rascunho', 'Conferida')`,
			nil, &n.Pendentes); err != nil {
			return nil, err
		}
		ini.Notas = n
	}
	if b.Vendas {
		v := &painel.InicioVendas{}
		if err := r.linha(ctx, `SELECT (count(*) FILTER (WHERE status = 'Em Producao'))::int,
			(count(*) FILTER (WHERE status = 'Pronto para Envio'))::int,
			(count(*) FILTER (WHERE status = 'Entregue' AND data_entrega_real = CURRENT_DATE))::int
			FROM pedidos_venda`, nil, &v.EmProducao, &v.ProntosEnvio, &v.EntreguesHoje); err != nil {
			return nil, err
		}
		ini.Vendas = v
	}
	return ini, nil
}

// cteChegadaPC: PCs concluidos cuja ultima nota efetivada caiu no periodo,
// com a data dessa nota (lead time real e pontualidade).
const cteChegadaPC = `chegada AS (
	SELECT pc.id, pc.fornecedor_id, pc.data_pedido, pc.data_entrega_prevista, max(n.data_entrada) AS ultima
	FROM pedidos_compra pc
	JOIN notas_fiscais_entrada n ON n.pedido_compra_id = pc.id AND n.status = 'Efetivada'
	WHERE pc.status = 'Concluido'
	GROUP BY pc.id
	HAVING max(n.data_entrada) >= CURRENT_DATE - $1::int)`

// Compras monta o painel de Compras.
func (r *PainelRepositorio) Compras(ctx context.Context, dias int) (*painel.Compras, error) {
	c := &painel.Compras{}
	if err := r.linha(ctx, `SELECT count(*)::int, coalesce(sum(valor_total), 0)::float8,
		(count(*) FILTER (WHERE data_entrega_prevista < CURRENT_DATE))::int
		FROM pedidos_compra WHERE status IN `+pcsEmAberto, nil, &c.EmAberto, &c.ValorEmAberto, &c.EmAtraso); err != nil {
		return nil, err
	}
	if err := r.linha(ctx, `WITH `+cteChegadaPC+`
		SELECT avg(ultima - data_pedido)::float8,
		       (100.0 * count(*) FILTER (WHERE ultima <= data_entrega_prevista) / NULLIF(count(*), 0))::float8
		FROM chegada`, []any{dias}, &c.LeadTimeMedioDias, &c.RecebidoNoPrazoPct); err != nil {
		return nil, err
	}
	var err error
	if c.PorSituacao, err = r.pontos(ctx, `SELECT status, count(*)::float8 FROM pedidos_compra
		GROUP BY status ORDER BY count(*) DESC`); err != nil {
		return nil, err
	}
	if c.CompradoPorMes, err = r.pontos(ctx, `WITH `+cteMeses+`
		SELECT to_char(m.mes, 'YYYY-MM'), coalesce(sum(pc.valor_total), 0)::float8
		FROM meses m LEFT JOIN pedidos_compra pc ON date_trunc('month', pc.data_pedido) = m.mes
		     AND pc.status NOT IN ('Rascunho', 'Cancelado')
		GROUP BY m.mes ORDER BY m.mes`, dias); err != nil {
		return nil, err
	}
	if c.AtrasosPorFornecedor, err = r.pontos(ctx, `SELECT f.razao_social, count(*)::float8
		FROM pedidos_compra pc JOIN fornecedores f ON f.id = pc.fornecedor_id
		WHERE pc.status IN `+pcsEmAberto+` AND pc.data_entrega_prevista < CURRENT_DATE
		GROUP BY f.razao_social ORDER BY count(*) DESC, f.razao_social LIMIT 8`); err != nil {
		return nil, err
	}
	if c.LeadTimePorFornecedor, err = r.pontos(ctx, `WITH `+cteChegadaPC+`
		SELECT f.razao_social, round(avg(ch.ultima - ch.data_pedido), 1)::float8
		FROM chegada ch JOIN fornecedores f ON f.id = ch.fornecedor_id
		GROUP BY f.razao_social ORDER BY avg(ch.ultima - ch.data_pedido) DESC, f.razao_social LIMIT 8`, dias); err != nil {
		return nil, err
	}
	return c, nil
}

// Estoque monta o painel de Recebimento e estoque.
func (r *PainelRepositorio) Estoque(ctx context.Context, dias int, comCustos bool) (*painel.Estoque, error) {
	e := &painel.Estoque{}
	var valor float64
	if err := r.linha(ctx, `SELECT coalesce(sum(se.quantidade_atual * coalesce(se.custo_medio, 0)), 0)::float8,
		(count(*) FILTER (WHERE se.status = 'CRITICO'))::int,
		(SELECT count(*) FROM notas_fiscais_entrada WHERE status IN ('Rascunho', 'Conferida'))::int,
		(SELECT count(*) FROM lotes WHERE quantidade_atual > 0 AND validade < CURRENT_DATE)::int,
		(SELECT count(*) FROM lotes WHERE quantidade_atual > 0 AND validade BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)::int
		FROM saldo_estoque se`, nil, &valor, &e.ItensCriticos, &e.NotasPendentes, &e.LotesVencidos, &e.LotesAVencer30); err != nil {
		return nil, err
	}
	if comCustos {
		e.ValorEmEstoque = &valor
	}
	var err error
	if e.EntradasPorMes, err = r.pontos(ctx, `WITH `+cteMeses+`
		SELECT to_char(m.mes, 'YYYY-MM'), coalesce(sum(n.valor_total), 0)::float8
		FROM meses m LEFT JOIN notas_fiscais_entrada n ON date_trunc('month', n.efetivada_em)::date = m.mes
		     AND n.status = 'Efetivada'
		GROUP BY m.mes ORDER BY m.mes`, dias); err != nil {
		return nil, err
	}
	if e.NotasPorSituacao, err = r.pontos(ctx, `SELECT status, count(*)::float8 FROM notas_fiscais_entrada
		WHERE created_at >= CURRENT_DATE - $1::int GROUP BY status ORDER BY count(*) DESC`, dias); err != nil {
		return nil, err
	}
	if e.LotesPorVencimento, err = r.pontos(ctx, `
		SELECT f.rotulo, count(l.id)::float8
		FROM (VALUES (1, 'Vencidos', -100000, -1), (2, 'Até 30 dias', 0, 30), (3, '31 a 60 dias', 31, 60),
		             (4, '61 a 90 dias', 61, 90)) AS f(ordem, rotulo, de, ate)
		LEFT JOIN lotes l ON l.quantidade_atual > 0 AND l.validade - CURRENT_DATE BETWEEN f.de AND f.ate
		GROUP BY f.ordem, f.rotulo ORDER BY f.ordem`); err != nil {
		return nil, err
	}
	if comCustos {
		if e.TopValorEmEstoque, err = r.pontos(ctx, `SELECT pp.codigo, (se.quantidade_atual * se.custo_medio)::float8
			FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id
			WHERE se.quantidade_atual > 0 AND se.custo_medio > 0
			ORDER BY se.quantidade_atual * se.custo_medio DESC, pp.codigo LIMIT 10`); err != nil {
			return nil, err
		}
	}
	return e, nil
}

// Producao monta o painel de Producao.
func (r *PainelRepositorio) Producao(ctx context.Context, dias int) (*painel.Producao, error) {
	p := &painel.Producao{}
	if err := r.linha(ctx, `SELECT (count(*) FILTER (WHERE status = 'Aberta'))::int,
		(count(*) FILTER (WHERE status = 'Liberada'))::int,
		(count(*) FILTER (WHERE status = 'Concluida' AND data_conclusao_real >= CURRENT_DATE - $1::int))::int,
		(count(*) FILTER (WHERE status IN `+opsAtivas+` AND data_conclusao_prevista < CURRENT_DATE))::int,
		-- Dias de calendario: a conclusao e so data e a liberacao tem hora --
		-- liberar e concluir no mesmo dia daria lead time negativo.
		(avg(data_conclusao_real - data_liberacao::date)
		   FILTER (WHERE status = 'Concluida' AND data_conclusao_real >= CURRENT_DATE - $1::int AND data_liberacao IS NOT NULL))::float8,
		(SELECT coalesce(sum(duracao_minutos), 0) / 60.0 FROM apontamento_producao
		   WHERE tempo_fim IS NOT NULL AND tempo_inicio >= CURRENT_DATE - $1::int)::float8
		FROM ordens_producao`, []any{dias},
		&p.Abertas, &p.Liberadas, &p.ConcluidasPeriodo, &p.EmAtraso, &p.LeadTimeMedioDias, &p.HorasApontadas); err != nil {
		return nil, err
	}
	var err error
	if p.PorEtapa, err = r.pontos(ctx, sqlOPsPorEtapa); err != nil {
		return nil, err
	}
	if p.ConcluidasPorSemana, err = r.pontos(ctx, `WITH `+cteSemanas+`
		SELECT to_char(s.semana, 'YYYY-MM-DD'), count(o.id)::float8
		FROM semanas s LEFT JOIN ordens_producao o ON o.status = 'Concluida'
		     AND date_trunc('week', o.data_conclusao_real)::date = s.semana
		GROUP BY s.semana ORDER BY s.semana`, dias); err != nil {
		return nil, err
	}
	if p.HorasPorCentro, err = r.pontos(ctx, `SELECT ct.nome, (sum(a.duracao_minutos) / 60.0)::float8
		FROM apontamento_producao a JOIN centros_trabalho ct ON ct.id = a.centro_trabalho_id
		WHERE a.tempo_fim IS NOT NULL AND a.tempo_inicio >= CURRENT_DATE - $1::int
		GROUP BY ct.nome ORDER BY sum(a.duracao_minutos) DESC, ct.nome`, dias); err != nil {
		return nil, err
	}
	if p.AtrasoPorProduto, err = r.pontos(ctx, `SELECT pa.codigo, count(*)::float8
		FROM ordens_producao o JOIN produtos_acabados pa ON pa.id = o.produto_acabado_id
		WHERE o.status IN `+opsAtivas+` AND o.data_conclusao_prevista < CURRENT_DATE
		GROUP BY pa.codigo ORDER BY count(*) DESC, pa.codigo LIMIT 8`); err != nil {
		return nil, err
	}
	return p, nil
}

// Vendas monta o painel de Vendas e expedicao.
func (r *PainelRepositorio) Vendas(ctx context.Context, dias int) (*painel.Vendas, error) {
	v := &painel.Vendas{}
	if err := r.linha(ctx, `SELECT coalesce(sum(valor_total) FILTER (WHERE status IN `+pvsEmAberto+`), 0)::float8,
		(count(*) FILTER (WHERE status IN `+pvsEmAberto+` AND data_entrega_prometida < CURRENT_DATE))::int,
		coalesce(sum(valor_total) FILTER (WHERE status = 'Entregue' AND data_entrega_real >= CURRENT_DATE - $1::int), 0)::float8,
		(100.0 * count(*) FILTER (WHERE status = 'Entregue' AND data_entrega_real >= CURRENT_DATE - $1::int
		                                AND data_entrega_real <= data_entrega_prometida)
		   / NULLIF(count(*) FILTER (WHERE status = 'Entregue' AND data_entrega_real >= CURRENT_DATE - $1::int), 0))::float8
		FROM pedidos_venda`, []any{dias}, &v.Carteira, &v.EmAtraso, &v.EntreguePeriodo, &v.OTDPct); err != nil {
		return nil, err
	}
	var err error
	if v.PorSituacao, err = r.pontos(ctx, `SELECT status, count(*)::float8 FROM pedidos_venda
		GROUP BY status ORDER BY count(*) DESC`); err != nil {
		return nil, err
	}
	if v.EntreguePorMes, err = r.pontos(ctx, `WITH `+cteMeses+`
		SELECT to_char(m.mes, 'YYYY-MM'), coalesce(sum(pv.valor_total), 0)::float8
		FROM meses m LEFT JOIN pedidos_venda pv ON pv.status = 'Entregue' AND date_trunc('month', pv.data_entrega_real) = m.mes
		GROUP BY m.mes ORDER BY m.mes`, dias); err != nil {
		return nil, err
	}
	// Mes sem entrega fica fora (0% seria falso: nao houve entrega para atrasar).
	if v.OTDPorMes, err = r.pontos(ctx, `WITH `+cteMeses+`
		SELECT to_char(m.mes, 'YYYY-MM'),
		       round(100.0 * count(pv.id) FILTER (WHERE pv.data_entrega_real <= pv.data_entrega_prometida) / count(pv.id), 1)::float8
		FROM meses m JOIN pedidos_venda pv ON pv.status = 'Entregue' AND date_trunc('month', pv.data_entrega_real) = m.mes
		GROUP BY m.mes ORDER BY m.mes`, dias); err != nil {
		return nil, err
	}
	if v.PrincipaisClientes, err = r.pontos(ctx, `SELECT coalesce(c.razao_social, pv.cliente_nome, 'Sem cliente'), sum(pv.valor_total)::float8
		FROM pedidos_venda pv LEFT JOIN clientes c ON c.id = pv.cliente_id
		WHERE pv.status = 'Entregue' AND pv.data_entrega_real >= CURRENT_DATE - $1::int
		GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 8`, dias); err != nil {
		return nil, err
	}
	return v, nil
}

// Qualidade monta o painel de Qualidade.
func (r *PainelRepositorio) Qualidade(ctx context.Context, dias int) (*painel.Qualidade, error) {
	q := &painel.Qualidade{}
	if err := r.linha(ctx, `WITH `+cteMetrologia+`
		SELECT (SELECT count(*) FROM numeros_serie WHERE testado_em >= CURRENT_DATE - $1::int)::int,
		       (SELECT count(*) FROM numeros_serie WHERE testado_em >= CURRENT_DATE - $1::int AND status = 'Reprovado')::int,
		       (SELECT count(*) FROM ultima_metrologia WHERE validade < CURRENT_DATE)::int,
		       (SELECT count(*) FROM ultima_metrologia WHERE validade BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)::int`,
		[]any{dias}, &q.Testadas, &q.Reprovadas, &q.MetrologiaVencida, &q.MetrologiaAVencer30); err != nil {
		return nil, err
	}
	q.Aprovadas = q.Testadas - q.Reprovadas
	if q.Testadas > 0 {
		taxa := float64(q.Aprovadas) * 100 / float64(q.Testadas)
		q.TaxaAprovacaoPct = &taxa
	}
	var err error
	// Semana sem teste fica fora (sem taxa a mostrar).
	if q.AprovacaoPorSemana, err = r.pontos(ctx, `WITH `+cteSemanas+`
		SELECT to_char(s.semana, 'YYYY-MM-DD'),
		       round(100.0 * count(ns.id) FILTER (WHERE ns.status <> 'Reprovado') / count(ns.id), 1)::float8
		FROM semanas s JOIN numeros_serie ns ON date_trunc('week', ns.testado_em)::date = s.semana
		GROUP BY s.semana ORDER BY s.semana`, dias); err != nil {
		return nil, err
	}
	if q.ReprovacoesPorProduto, err = r.pontos(ctx, `SELECT pa.codigo, count(*)::float8
		FROM numeros_serie ns JOIN produtos_acabados pa ON pa.id = ns.produto_acabado_id
		WHERE ns.status = 'Reprovado' AND ns.testado_em >= CURRENT_DATE - $1::int
		GROUP BY pa.codigo ORDER BY count(*) DESC, pa.codigo LIMIT 8`, dias); err != nil {
		return nil, err
	}
	if q.MetrologiaPorFaixa, err = r.pontos(ctx, `WITH `+cteMetrologia+`
		SELECT f.rotulo, count(u.validade)::float8
		FROM (VALUES (1, 'Vencida', -100000, -1), (2, 'Até 30 dias', 0, 30), (3, '31 a 60 dias', 31, 60),
		             (4, '61 a 90 dias', 61, 90), (5, 'Mais de 90 dias', 91, 100000)) AS f(ordem, rotulo, de, ate)
		LEFT JOIN ultima_metrologia u ON u.validade - CURRENT_DATE BETWEEN f.de AND f.ate
		GROUP BY f.ordem, f.rotulo ORDER BY f.ordem`); err != nil {
		return nil, err
	}
	return q, nil
}
