package repository

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/arquivo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/producao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasOP = `op.id, op.numero_op, pv.id, pv.numero_pedido, coalesce(c.razao_social, pv.cliente_nome, ''),
	op.item_pedido_venda_id, op.produto_acabado_id, pa.codigo, pa.descricao, pa.exige_metrologia, op.quantidade,
	op.estrutura_produto_id, ep.versao, op.data_conclusao_prevista, op.data_conclusao_real, op.data_liberacao,
	op.etapa_atual, op.status, op.observacoes, op.created_at`

const fromOP = ` FROM ordens_producao op
	JOIN itens_pedido_venda i ON i.id = op.item_pedido_venda_id
	JOIN pedidos_venda pv ON pv.id = i.pedido_venda_id
	LEFT JOIN clientes c ON c.id = pv.cliente_id
	JOIN produtos_acabados pa ON pa.id = op.produto_acabado_id
	JOIN estrutura_produto ep ON ep.id = op.estrutura_produto_id `

// ProducaoRepositorio implementa producao.Repositorio.
type ProducaoRepositorio struct {
	pool *pgxpool.Pool
}

// NovoProducaoRepositorio cria o repositorio de producao.
func NovoProducaoRepositorio(pool *pgxpool.Pool) *ProducaoRepositorio {
	return &ProducaoRepositorio{pool: pool}
}

func lerOP(l linha) (*producao.OrdemProducao, error) {
	var o producao.OrdemProducao
	if err := l.Scan(&o.ID, &o.NumeroOP, &o.PedidoVendaID, &o.NumeroPedido, &o.ClienteNome, &o.ItemPedidoVendaID,
		&o.ProdutoAcabadoID, &o.ProdutoCodigo, &o.ProdutoDescricao, &o.ExigeMetrologia, &o.Quantidade, &o.EstruturaID,
		&o.EstruturaVersao, &o.DataConclusaoPrevista, &o.DataConclusaoReal, &o.DataLiberacao, &o.EtapaAtual,
		&o.Status, &o.Observacoes, &o.CreatedAt); err != nil {
		return nil, err
	}
	return &o, nil
}

// registrarTransicao grava uma linha do historico do Kanban.
func registrarTransicao(ctx context.Context, tx pgx.Tx, opID int64, anterior *string, nova string, usuarioID int64) error {
	_, err := tx.Exec(ctx, `INSERT INTO historico_kanban (ordem_producao_id, etapa_anterior, etapa_nova, usuario_responsavel_id)
		VALUES ($1, $2, $3, NULLIF($4, 0))`, opID, anterior, nova, usuarioID)
	if err != nil {
		return fmt.Errorf("registrar transicao do kanban: %w", err)
	}
	return nil
}

func idDoUsuario(ctx context.Context, tx pgx.Tx, username string) int64 {
	var id int64
	_ = tx.QueryRow(ctx, `SELECT id FROM usuarios WHERE username = $1`, username).Scan(&id)
	return id
}

// GerarOP cria a OP do item (BOM ativa congelada; numero OP-AAAA-NNNNN).
func (r *ProducaoRepositorio) GerarOP(ctx context.Context, itemID int64, autor string) (int64, error) {
	var id int64
	err := emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		var produtoID, pedidoID int64
		var quantidade int
		var statusPedido string
		err := tx.QueryRow(ctx, `
			SELECT i.produto_acabado_id, i.quantidade, pv.id, pv.status
			FROM itens_pedido_venda i JOIN pedidos_venda pv ON pv.id = i.pedido_venda_id
			WHERE i.id = $1 FOR UPDATE OF pv`, itemID).Scan(&produtoID, &quantidade, &pedidoID, &statusPedido)
		if errors.Is(err, pgx.ErrNoRows) {
			return producao.ErrItemNaoEncontrado
		}
		if err != nil {
			return fmt.Errorf("ler item do pedido: %w", err)
		}
		if statusPedido != "Aberto" && statusPedido != "Em Producao" {
			return producao.ErrPedidoNaoPermiteOP
		}
		var estruturaID int64
		err = tx.QueryRow(ctx, `SELECT id FROM estrutura_produto WHERE produto_acabado_id = $1 AND ativo`, produtoID).Scan(&estruturaID)
		if errors.Is(err, pgx.ErrNoRows) {
			return producao.ErrSemEstruturaAtiva
		}
		if err != nil {
			return fmt.Errorf("buscar estrutura ativa: %w", err)
		}
		err = tx.QueryRow(ctx, `
			INSERT INTO ordens_producao (numero_op, item_pedido_venda_id, produto_acabado_id, quantidade, estrutura_produto_id,
			  data_conclusao_prevista, created_by, updated_by)
			SELECT 'OP-' || to_char(CURRENT_DATE, 'YYYY') || '-' || (SELECT lpad(n, greatest(5, length(n)), '0')
			  FROM (SELECT nextval('seq_numero_op')::text AS n) seq),
			  $1, $2, $3, $4, pv.data_entrega_prometida, $5, $5
			FROM pedidos_venda pv WHERE pv.id = $6
			RETURNING id`, itemID, produtoID, quantidade, estruturaID, autor, pedidoID).Scan(&id)
		if violouIndiceUnico(err, "uq_op_item_ativa") {
			return producao.ErrItemJaTemOP
		}
		if err != nil {
			return fmt.Errorf("criar OP: %w", err)
		}
		_, err = tx.Exec(ctx, `UPDATE pedidos_venda SET status = 'Em Producao', updated_by = $2 WHERE id = $1 AND status = 'Aberto'`,
			pedidoID, autor)
		return err
	})
	return id, err
}

// Listar devolve uma pagina de OPs (filtros: status, etapa, busca).
func (r *ProducaoRepositorio) Listar(ctx context.Context, params consulta.Parametros, etapa string) ([]producao.OrdemProducao, int, error) {
	condicoes, argumentos := "WHERE TRUE", []any{}
	if params.FiltroStatus != nil {
		argumentos = append(argumentos, *params.FiltroStatus)
		condicoes += fmt.Sprintf(" AND op.status = $%d", len(argumentos))
	}
	if etapa != "" {
		argumentos = append(argumentos, etapa)
		condicoes += fmt.Sprintf(" AND op.etapa_atual = $%d AND op.status = 'Liberada'", len(argumentos))
	}
	if params.Busca != "" {
		argumentos = append(argumentos, "%"+params.Busca+"%")
		condicoes += fmt.Sprintf(" AND (op.numero_op ILIKE $%[1]d OR pv.numero_pedido ILIKE $%[1]d OR pa.codigo ILIKE $%[1]d OR c.razao_social ILIKE $%[1]d)", len(argumentos))
	}
	conexao := db.DoContexto(ctx, r.pool)
	var total int
	if err := conexao.QueryRow(ctx, `SELECT count(*)`+fromOP+condicoes, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar OPs: %w", err)
	}
	sql := fmt.Sprintf("SELECT %s %s %s ORDER BY op.%s %s, op.id DESC LIMIT $%d OFFSET $%d", colunasOP, fromOP, condicoes,
		params.OrdenarPor, params.Ordem.SQL(), len(argumentos)+1, len(argumentos)+2)
	ops, err := r.listarOPs(ctx, sql, append(argumentos, params.Limite, params.Offset())...)
	return ops, total, err
}

func (r *ProducaoRepositorio) listarOPs(ctx context.Context, sql string, args ...any) ([]producao.OrdemProducao, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("listar OPs: %w", err)
	}
	defer linhas.Close()
	ops := []producao.OrdemProducao{}
	for linhas.Next() {
		o, err := lerOP(linhas)
		if err != nil {
			return nil, err
		}
		ops = append(ops, *o)
	}
	return ops, linhas.Err()
}

// Kanban devolve as OPs liberadas, com o apontamento em andamento de cada uma.
func (r *ProducaoRepositorio) Kanban(ctx context.Context) ([]producao.OrdemProducao, error) {
	ops, err := r.listarOPs(ctx, `SELECT `+colunasOP+fromOP+`WHERE op.status = 'Liberada' ORDER BY op.data_conclusao_prevista, op.id`)
	if err != nil || len(ops) == 0 {
		return ops, err
	}
	abertos, err := r.apontamentos(ctx, `WHERE a.tempo_fim IS NULL AND a.ordem_producao_id IN (SELECT id FROM ordens_producao WHERE status = 'Liberada')`)
	if err != nil {
		return nil, err
	}
	for i := range ops {
		if a, ok := abertos[ops[i].ID]; ok && len(a) > 0 {
			ops[i].ApontamentoAberto = &a[0]
		}
	}
	return ops, nil
}

// apontamentos le apontamentos agrupados por OP.
func (r *ProducaoRepositorio) apontamentos(ctx context.Context, where string, args ...any) (map[int64][]producao.Apontamento, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT a.ordem_producao_id, a.id, a.etapa, a.centro_trabalho_id, coalesce(ct.codigo, ''), coalesce(ct.nome, ''),
		       a.operador_id, coalesce(u.nome, ''), a.tempo_inicio, a.tempo_fim, a.duracao_minutos,
		       coalesce(a.custo_hora, ct.custo_hora)::float8,
		       coalesce(a.observacoes, '')
		FROM apontamento_producao a
		LEFT JOIN centros_trabalho ct ON ct.id = a.centro_trabalho_id
		LEFT JOIN usuarios u ON u.id = a.operador_id `+where+` ORDER BY a.tempo_inicio`, args...)
	if err != nil {
		return nil, fmt.Errorf("listar apontamentos: %w", err)
	}
	defer linhas.Close()
	porOP := map[int64][]producao.Apontamento{}
	for linhas.Next() {
		var opID int64
		var a producao.Apontamento
		if err := linhas.Scan(&opID, &a.ID, &a.Etapa, &a.CentroID, &a.CentroCodigo, &a.CentroNome, &a.OperadorID,
			&a.OperadorNome, &a.Inicio, &a.Fim, &a.DuracaoMinutos, &a.CustoHoraCentro, &a.Observacoes); err != nil {
			return nil, err
		}
		porOP[opID] = append(porOP[opID], a)
	}
	return porOP, linhas.Err()
}

func (r *ProducaoRepositorio) historico(ctx context.Context, opID int64) ([]producao.Transicao, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT h.etapa_anterior, h.etapa_nova, h.data_hora_transicao, coalesce(u.nome, '')
		FROM historico_kanban h LEFT JOIN usuarios u ON u.id = h.usuario_responsavel_id
		WHERE h.ordem_producao_id = $1 ORDER BY h.data_hora_transicao, h.id`, opID)
	if err != nil {
		return nil, fmt.Errorf("listar historico do kanban: %w", err)
	}
	defer linhas.Close()
	lista := []producao.Transicao{}
	for linhas.Next() {
		var t producao.Transicao
		if err := linhas.Scan(&t.EtapaAnterior, &t.EtapaNova, &t.DataHora, &t.Usuario); err != nil {
			return nil, err
		}
		lista = append(lista, t)
	}
	return lista, linhas.Err()
}

const colunasSerie = `s.id, s.numero, s.status, s.resultado_teste, coalesce(u.nome, ''), s.testado_em, s.expedido_em,
	m.numero_aprovacao_modelo, m.data_verificacao, m.numero_lacre, m.validade, m.observacoes`

const fromSerie = ` FROM numeros_serie s LEFT JOIN usuarios u ON u.id = s.testado_por
	LEFT JOIN metrologia_serie m ON m.numero_serie_id = s.id `

func lerSerie(l linha) (*producao.Serie, error) {
	var s producao.Serie
	var aprovacao, lacre, obs *string
	m := producao.Metrologia{}
	if err := l.Scan(&s.ID, &s.Numero, &s.Status, &s.ResultadoTeste, &s.TestadoPor, &s.TestadoEm, &s.ExpedidoEm,
		&aprovacao, &m.DataVerificacao, &lacre, &m.Validade, &obs); err != nil {
		return nil, err
	}
	if aprovacao != nil {
		m.NumeroAprovacaoModelo = *aprovacao
		if lacre != nil {
			m.NumeroLacre = *lacre
		}
		if obs != nil {
			m.Observacoes = *obs
		}
		s.Metrologia = &m
	}
	return &s, nil
}

func (r *ProducaoRepositorio) series(ctx context.Context, opID int64) ([]producao.Serie, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `SELECT `+colunasSerie+fromSerie+`WHERE s.ordem_producao_id = $1 ORDER BY s.numero`, opID)
	if err != nil {
		return nil, fmt.Errorf("listar series: %w", err)
	}
	defer linhas.Close()
	lista := []producao.Serie{}
	for linhas.Next() {
		s, err := lerSerie(linhas)
		if err != nil {
			return nil, err
		}
		lista = append(lista, *s)
	}
	return lista, linhas.Err()
}

func (r *ProducaoRepositorio) buscarOP(ctx context.Context, id int64) (*producao.OrdemProducao, error) {
	o, err := lerOP(db.DoContexto(ctx, r.pool).QueryRow(ctx, `SELECT `+colunasOP+fromOP+`WHERE op.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, producao.ErrNaoEncontrada
	}
	if err != nil {
		return nil, fmt.Errorf("buscar OP: %w", err)
	}
	return o, nil
}

// BuscarDetalhe devolve a OP com reservas, apontamentos, series, historico e custo.
func (r *ProducaoRepositorio) BuscarDetalhe(ctx context.Context, id int64) (*producao.Detalhe, error) {
	o, err := r.buscarOP(ctx, id)
	if err != nil {
		return nil, err
	}
	d := &producao.Detalhe{OrdemProducao: *o}

	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT re.parte_peca_id, pp.codigo, pp.descricao, re.quantidade_reservada, re.quantidade_consumida, re.status,
		       re.custo_unitario_orcado::float8, re.custo_unitario_consumo::float8
		FROM reserva_estoque re JOIN partes_pecas pp ON pp.id = re.parte_peca_id
		WHERE re.ordem_producao_id = $1 ORDER BY pp.codigo`, id)
	if err != nil {
		return nil, fmt.Errorf("listar reservas: %w", err)
	}
	d.Reservas = []producao.Reserva{}
	for linhas.Next() {
		var re producao.Reserva
		if err := linhas.Scan(&re.PartePecaID, &re.Codigo, &re.Descricao, &re.QuantidadeReservada, &re.QuantidadeConsumida,
			&re.Status, &re.CustoUnitarioOrcado, &re.CustoUnitarioConsumo); err != nil {
			linhas.Close()
			return nil, err
		}
		d.Reservas = append(d.Reservas, re)
	}
	linhas.Close()

	porOP, err := r.apontamentos(ctx, `WHERE a.ordem_producao_id = $1`, id)
	if err != nil {
		return nil, err
	}
	d.Apontamentos = porOP[id]
	if d.Apontamentos == nil {
		d.Apontamentos = []producao.Apontamento{}
	}
	for i := range d.Apontamentos {
		if d.Apontamentos[i].Fim == nil {
			d.ApontamentoAberto = &d.Apontamentos[i]
		}
	}
	if d.Series, err = r.series(ctx, id); err != nil {
		return nil, err
	}
	if d.Historico, err = r.historico(ctx, id); err != nil {
		return nil, err
	}
	d.Custo = calcularCusto(d)
	return d, nil
}

// calcularCusto: orcado = BOM x CMP na liberacao; realizado = consumo x CMP
// na baixa + horas apontadas x custo/hora do centro.
func calcularCusto(d *producao.Detalhe) *producao.Custo {
	c := &producao.Custo{Avisos: []string{}}
	for _, re := range d.Reservas {
		c.MaterialOrcado += float64(re.QuantidadeReservada) * re.CustoUnitarioOrcado
		if re.CustoUnitarioConsumo != nil {
			c.MaterialRealizado += float64(re.QuantidadeConsumida) * *re.CustoUnitarioConsumo
		}
		if re.CustoUnitarioOrcado == 0 {
			c.Incompleto = true
			c.Avisos = append(c.Avisos, fmt.Sprintf("%s sem custo de compra (custo médio zero)", re.Codigo))
		}
	}
	semCusto := map[string]bool{}
	for _, a := range d.Apontamentos {
		if a.DuracaoMinutos == nil {
			continue
		}
		horas := float64(*a.DuracaoMinutos) / 60
		c.HorasApontadas += horas
		if a.CustoHoraCentro == nil {
			if !semCusto[a.CentroCodigo] {
				semCusto[a.CentroCodigo] = true
				c.Incompleto = true
				c.Avisos = append(c.Avisos, fmt.Sprintf("Centro %s sem custo por hora", a.CentroCodigo))
			}
			continue
		}
		c.MaoDeObra += horas * *a.CustoHoraCentro
	}
	arred := func(v float64) float64 { return math.Round(v*100) / 100 }
	c.MaterialOrcado, c.MaterialRealizado, c.MaoDeObra = arred(c.MaterialOrcado), arred(c.MaterialRealizado), arred(c.MaoDeObra)
	c.HorasApontadas = math.Round(c.HorasApontadas*100) / 100
	c.TotalRealizado = arred(c.MaterialRealizado + c.MaoDeObra)
	if d.Quantidade > 0 {
		c.CustoUnitario = arred(c.TotalRealizado / float64(d.Quantidade))
	}
	return c
}

// travarOP le status/etapa da OP com a linha travada.
type opTravada struct {
	status, etapa, numero, produtoCodigo, statusPedido string
	quantidade                                         int
	estruturaID, produtoID, pedidoID                   int64
	exigeMetrologia                                    bool
}

// travarOP trava o PEDIDO e depois a OP -- a mesma ordem (pedido -> OP ->
// serie) em toda operacao, para que duas OPs do mesmo pedido, ou a OP e o
// cancelamento do pedido, nunca decidam sobre um estado que o outro esta
// mudando (ex.: as duas ultimas OPs concluindo juntas e o pedido nao virando
// Pronto para Envio).
func travarOP(ctx context.Context, tx pgx.Tx, id int64) (*opTravada, error) {
	var o opTravada
	var pedidoID int64
	err := tx.QueryRow(ctx, `SELECT i.pedido_venda_id FROM ordens_producao op
		JOIN itens_pedido_venda i ON i.id = op.item_pedido_venda_id WHERE op.id = $1`, id).Scan(&pedidoID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, producao.ErrNaoEncontrada
	}
	if err != nil {
		return nil, fmt.Errorf("ler pedido da OP: %w", err)
	}
	if err := tx.QueryRow(ctx, `SELECT status FROM pedidos_venda WHERE id = $1 FOR UPDATE`, pedidoID).Scan(&o.statusPedido); err != nil {
		return nil, fmt.Errorf("travar pedido da OP: %w", err)
	}
	err = tx.QueryRow(ctx, `
		SELECT op.status, op.etapa_atual, op.numero_op, pa.codigo, op.quantidade, op.estrutura_produto_id,
		       op.produto_acabado_id, i.pedido_venda_id, pa.exige_metrologia
		FROM ordens_producao op
		JOIN produtos_acabados pa ON pa.id = op.produto_acabado_id
		JOIN itens_pedido_venda i ON i.id = op.item_pedido_venda_id
		WHERE op.id = $1 FOR UPDATE OF op`, id).Scan(&o.status, &o.etapa, &o.numero, &o.produtoCodigo, &o.quantidade,
		&o.estruturaID, &o.produtoID, &o.pedidoID, &o.exigeMetrologia)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, producao.ErrNaoEncontrada
	}
	if err != nil {
		return nil, fmt.Errorf("travar OP: %w", err)
	}
	return &o, nil
}

type saldoTravado struct {
	atual, reservada, minimo int
	custo                    float64
}

// travarSaldos trava os saldos das pecas, sempre na mesma ordem (por id), para
// duas OPs concorrentes nao se travarem mutuamente.
func travarSaldos(ctx context.Context, tx pgx.Tx, pecas []int64) (map[int64]*saldoTravado, error) {
	linhas, err := tx.Query(ctx, `
		SELECT se.parte_peca_id, se.quantidade_atual, se.quantidade_reservada, pp.estoque_minimo, se.custo_medio::float8
		FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id
		WHERE se.parte_peca_id = ANY($1) ORDER BY se.parte_peca_id FOR UPDATE OF se`, pecas)
	if err != nil {
		return nil, fmt.Errorf("travar saldos: %w", err)
	}
	defer linhas.Close()
	saldos := map[int64]*saldoTravado{}
	for linhas.Next() {
		var id int64
		var s saldoTravado
		if err := linhas.Scan(&id, &s.atual, &s.reservada, &s.minimo, &s.custo); err != nil {
			return nil, err
		}
		saldos[id] = &s
	}
	return saldos, linhas.Err()
}

// Liberar reserva todo o material da BOM (tudo ou nada), gera os numeros de
// serie e poe a OP na Separacao.
func (r *ProducaoRepositorio) Liberar(ctx context.Context, id int64, autor string) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		o, err := travarOP(ctx, tx, id)
		if err != nil {
			return err
		}
		if o.status != producao.StatusAberta {
			return producao.ErrStatusInvalidoParaAcao
		}
		if o.statusPedido != "Aberto" && o.statusPedido != "Em Producao" {
			return producao.ErrPedidoNaoPermiteOP
		}
		linhas, err := tx.Query(ctx, `
			SELECT ie.parte_peca_id, pp.codigo, pp.descricao, ie.quantidade * $2
			FROM itens_estrutura_produto ie JOIN partes_pecas pp ON pp.id = ie.parte_peca_id
			WHERE ie.estrutura_produto_id = $1 ORDER BY ie.parte_peca_id`, o.estruturaID, o.quantidade)
		if err != nil {
			return fmt.Errorf("ler BOM da OP: %w", err)
		}
		var necessidades []producao.Falta
		var pecas []int64
		for linhas.Next() {
			var f producao.Falta
			if err := linhas.Scan(&f.PartePecaID, &f.Codigo, &f.Descricao, &f.Necessaria); err != nil {
				linhas.Close()
				return err
			}
			necessidades = append(necessidades, f)
			pecas = append(pecas, f.PartePecaID)
		}
		linhas.Close()
		saldos, err := travarSaldos(ctx, tx, pecas)
		if err != nil {
			return err
		}
		var faltas []producao.Falta
		for _, n := range necessidades {
			disponivel := 0
			if s := saldos[n.PartePecaID]; s != nil {
				disponivel = s.atual - s.reservada
				rastreavel, err := disponivelRastreavel(ctx, tx, n.PartePecaID, s.atual, s.reservada)
				if err != nil {
					return err
				}
				disponivel = min(disponivel, rastreavel)
			}
			if disponivel < n.Necessaria {
				n.Disponivel = disponivel
				faltas = append(faltas, n)
			}
		}
		if len(faltas) > 0 {
			return &producao.ErroDeFalta{Faltas: faltas}
		}
		for _, n := range necessidades {
			if _, err := tx.Exec(ctx, `UPDATE saldo_estoque SET quantidade_reservada = quantidade_reservada + $2, updated_by = $3
				WHERE parte_peca_id = $1`, n.PartePecaID, n.Necessaria, autor); err != nil {
				return fmt.Errorf("reservar material: %w", err)
			}
			if _, err := tx.Exec(ctx, `INSERT INTO reserva_estoque (ordem_producao_id, parte_peca_id, quantidade_reservada, custo_unitario_orcado)
				VALUES ($1, $2, $3, $4)`, id, n.PartePecaID, n.Necessaria, saldos[n.PartePecaID].custo); err != nil {
				return fmt.Errorf("gravar reserva: %w", err)
			}
			if err := reservarRastreio(ctx, tx, id, n.PartePecaID, n.Necessaria); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE ordens_producao SET status = 'Liberada', etapa_atual = 'Separacao',
			data_liberacao = CURRENT_TIMESTAMP, updated_by = $2 WHERE id = $1`, id, autor); err != nil {
			return fmt.Errorf("liberar OP: %w", err)
		}
		if err := registrarTransicao(ctx, tx, id, nil, producao.EtapaSeparacao, idDoUsuario(ctx, tx, autor)); err != nil {
			return err
		}
		return gerarSeries(ctx, tx, id, o)
	})
}

// disponivelRastreavel: o que a OP pode reservar respeitando o rastro --
// lotes validos livres (vencido nao entra) e series em estoque, mais a parte
// do saldo sem lote/serie (legado). Sem lotes/series, e o proprio saldo livre.
func disponivelRastreavel(ctx context.Context, tx pgx.Tx, peca int64, atual, reservada int) (int, error) {
	var lotesLivres, lotesAtual, lotesReservada, seriesLivres, seriesEstoque, seriesReservadas int
	if err := tx.QueryRow(ctx, `
		SELECT coalesce(sum(quantidade_atual - quantidade_reservada) FILTER (WHERE validade IS NULL OR validade >= CURRENT_DATE), 0),
		       coalesce(sum(quantidade_atual), 0), coalesce(sum(quantidade_reservada), 0),
		       (SELECT count(*) FILTER (WHERE status = 'Em Estoque') FROM series_componente WHERE parte_peca_id = $1),
		       (SELECT count(*) FILTER (WHERE status IN ('Em Estoque', 'Reservado')) FROM series_componente WHERE parte_peca_id = $1),
		       (SELECT count(*) FILTER (WHERE status = 'Reservado') FROM series_componente WHERE parte_peca_id = $1)
		FROM lotes WHERE parte_peca_id = $1`, peca).
		Scan(&lotesLivres, &lotesAtual, &lotesReservada, &seriesLivres, &seriesEstoque, &seriesReservadas); err != nil {
		return 0, fmt.Errorf("ler disponibilidade rastreada: %w", err)
	}
	porLote := lotesLivres + max(0, (atual-lotesAtual)-(reservada-lotesReservada))
	porSerie := seriesLivres + max(0, (atual-seriesEstoque)-(reservada-seriesReservadas))
	return min(porLote, porSerie), nil
}

// reservarRastreio reserva, da peca, os lotes por FEFO (validade mais proxima
// primeiro, vencidos fora) e as series de componente em estoque. Saldo de
// antes da v1.2 (sem lote/serie) fica de fora do rastro, sem bloquear a OP.
func reservarRastreio(ctx context.Context, tx pgx.Tx, opID, peca int64, necessaria int) error {
	linhas, err := tx.Query(ctx, `SELECT id, quantidade_atual - quantidade_reservada FROM lotes
		WHERE parte_peca_id = $1 AND quantidade_atual > quantidade_reservada AND (validade IS NULL OR validade >= CURRENT_DATE)
		ORDER BY validade NULLS LAST, id FOR UPDATE`, peca)
	if err != nil {
		return fmt.Errorf("travar lotes: %w", err)
	}
	type reserva struct {
		lote int64
		qtd  int
	}
	var reservas []reserva
	falta := necessaria
	for linhas.Next() && falta > 0 {
		var lote int64
		var disponivel int
		if err := linhas.Scan(&lote, &disponivel); err != nil {
			linhas.Close()
			return err
		}
		q := min(disponivel, falta)
		reservas = append(reservas, reserva{lote, q})
		falta -= q
	}
	linhas.Close()
	for _, r := range reservas {
		if _, err := tx.Exec(ctx, `UPDATE lotes SET quantidade_reservada = quantidade_reservada + $2 WHERE id = $1`, r.lote, r.qtd); err != nil {
			return fmt.Errorf("reservar lote: %w", err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO reservas_lote (ordem_producao_id, parte_peca_id, lote_id, quantidade) VALUES ($1, $2, $3, $4)`,
			opID, peca, r.lote, r.qtd); err != nil {
			return fmt.Errorf("gravar reserva de lote: %w", err)
		}
	}
	// Series: primeiro as dos lotes reservados, depois as mais antigas.
	if _, err := tx.Exec(ctx, `
		UPDATE series_componente SET status = 'Reservado', ordem_producao_id = $1
		WHERE id IN (
		  SELECT s.id FROM series_componente s
		  WHERE s.parte_peca_id = $2 AND s.status = 'Em Estoque'
		  ORDER BY (s.lote_id IN (SELECT lote_id FROM reservas_lote WHERE ordem_producao_id = $1)) DESC NULLS LAST, s.id
		  LIMIT $3 FOR UPDATE)`, opID, peca, necessaria); err != nil {
		return fmt.Errorf("reservar series: %w", err)
	}
	return nil
}

// gerarSeries cria uma serie por unidade: <CODIGO-PA>-<AAAA>-<NNNNN>, com a
// sequencia por produto e ano (trava consultiva por produto contra corrida).
func gerarSeries(ctx context.Context, tx pgx.Tx, opID int64, o *opTravada) error {
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(2, $1::int)`, o.produtoID); err != nil {
		return fmt.Errorf("travar sequencia de series: %w", err)
	}
	_, err := tx.Exec(ctx, `
		WITH prefixo AS (SELECT $3 || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' AS p),
		ultimo AS (
		  SELECT coalesce(max(substr(s.numero, length(prefixo.p) + 1)::int), 0) AS n
		  FROM prefixo LEFT JOIN numeros_serie s
		    ON s.produto_acabado_id = $2 AND left(s.numero, length(prefixo.p)) = prefixo.p
		   AND substr(s.numero, length(prefixo.p) + 1) ~ '^[0-9]+$')
		INSERT INTO numeros_serie (numero, ordem_producao_id, produto_acabado_id)
		SELECT prefixo.p || lpad((ultimo.n + g)::text, greatest(5, length((ultimo.n + g)::text)), '0'), $1, $2
		FROM prefixo, ultimo, generate_series(1, $4::int) g`, opID, o.produtoID, o.produtoCodigo, o.quantidade)
	if err != nil {
		return fmt.Errorf("gerar numeros de serie: %w", err)
	}
	return nil
}

// Cancelar cancela a OP: Aberta, ou Liberada ainda na Separacao sem consumo
// (devolve a reserva). O pedido volta a Aberto se ficar sem OP ativa.
func (r *ProducaoRepositorio) Cancelar(ctx context.Context, id int64, autor string) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		o, err := travarOP(ctx, tx, id)
		if err != nil {
			return err
		}
		switch o.status {
		case producao.StatusAberta:
		case producao.StatusLiberada:
			if o.etapa != producao.EtapaSeparacao {
				return producao.ErrOPJaConsumiu
			}
			linhas, err := tx.Query(ctx, `SELECT parte_peca_id, quantidade_reservada FROM reserva_estoque
				WHERE ordem_producao_id = $1 AND status = 'Reservada' ORDER BY parte_peca_id`, id)
			if err != nil {
				return fmt.Errorf("ler reservas: %w", err)
			}
			type devolucao struct {
				peca int64
				qtd  int
			}
			var devolucoes []devolucao
			var pecas []int64
			for linhas.Next() {
				var d devolucao
				if err := linhas.Scan(&d.peca, &d.qtd); err != nil {
					linhas.Close()
					return err
				}
				devolucoes = append(devolucoes, d)
				pecas = append(pecas, d.peca)
			}
			linhas.Close()
			if _, err := travarSaldos(ctx, tx, pecas); err != nil {
				return err
			}
			for _, d := range devolucoes {
				if _, err := tx.Exec(ctx, `UPDATE saldo_estoque SET quantidade_reservada = quantidade_reservada - $2, updated_by = $3
					WHERE parte_peca_id = $1`, d.peca, d.qtd, autor); err != nil {
					return fmt.Errorf("devolver reserva: %w", err)
				}
			}
			if _, err := tx.Exec(ctx, `UPDATE reserva_estoque SET status = 'Liberada', updated_at = CURRENT_TIMESTAMP
				WHERE ordem_producao_id = $1`, id); err != nil {
				return fmt.Errorf("liberar reservas: %w", err)
			}
			if _, err := tx.Exec(ctx, `UPDATE lotes l SET quantidade_reservada = l.quantidade_reservada - r.quantidade
				FROM reservas_lote r WHERE r.ordem_producao_id = $1 AND NOT r.consumida AND l.id = r.lote_id`, id); err != nil {
				return fmt.Errorf("devolver lotes: %w", err)
			}
			if _, err := tx.Exec(ctx, `DELETE FROM reservas_lote WHERE ordem_producao_id = $1 AND NOT consumida`, id); err != nil {
				return fmt.Errorf("apagar reservas de lote: %w", err)
			}
			if _, err := tx.Exec(ctx, `UPDATE series_componente SET status = 'Em Estoque', ordem_producao_id = NULL
				WHERE ordem_producao_id = $1 AND status = 'Reservado'`, id); err != nil {
				return fmt.Errorf("devolver series: %w", err)
			}
			if _, err := tx.Exec(ctx, `UPDATE numeros_serie SET status = 'Cancelado' WHERE ordem_producao_id = $1`, id); err != nil {
				return fmt.Errorf("cancelar series: %w", err)
			}
			if _, err := tx.Exec(ctx, `UPDATE apontamento_producao SET tempo_fim = CURRENT_TIMESTAMP,
				duracao_minutos = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - tempo_inicio)) / 60))::int,
				custo_hora = (SELECT custo_hora FROM centros_trabalho WHERE id = centro_trabalho_id)
				WHERE ordem_producao_id = $1 AND tempo_fim IS NULL`, id); err != nil {
				return fmt.Errorf("encerrar apontamento: %w", err)
			}
		default:
			return producao.ErrStatusInvalidoParaAcao
		}
		if _, err := tx.Exec(ctx, `UPDATE ordens_producao SET status = 'Cancelada', updated_by = $2 WHERE id = $1`, id, autor); err != nil {
			return fmt.Errorf("cancelar OP: %w", err)
		}
		_, err = tx.Exec(ctx, `
			UPDATE pedidos_venda SET status = 'Aberto', updated_by = $2
			WHERE id = $1 AND status = 'Em Producao' AND NOT EXISTS (
			  SELECT 1 FROM ordens_producao op JOIN itens_pedido_venda i ON i.id = op.item_pedido_venda_id
			  WHERE i.pedido_venda_id = $1 AND op.status <> 'Cancelada')`, o.pedidoID, autor)
		return err
	})
}

// IniciarApontamento abre um apontamento na etapa atual da OP.
func (r *ProducaoRepositorio) IniciarApontamento(ctx context.Context, opID, centroID, operadorID int64, observacoes string) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		o, err := travarOP(ctx, tx, opID)
		if err != nil {
			return err
		}
		if o.status != producao.StatusLiberada {
			return producao.ErrStatusInvalidoParaAcao
		}
		var etapaCentro string
		err = tx.QueryRow(ctx, `SELECT etapa FROM centros_trabalho WHERE id = $1 AND ativo`, centroID).Scan(&etapaCentro)
		if errors.Is(err, pgx.ErrNoRows) || (err == nil && producao.EtapaDoCentro(etapaCentro) != o.etapa) {
			return producao.ErrCentroInvalido
		}
		if err != nil {
			return fmt.Errorf("ler centro de trabalho: %w", err)
		}
		_, err = tx.Exec(ctx, `INSERT INTO apontamento_producao (ordem_producao_id, etapa, tempo_inicio, operador_id, centro_trabalho_id, observacoes)
			VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, NULLIF($5, ''))`, opID, o.etapa, operadorID, centroID, observacoes)
		if violouIndiceUnico(err) {
			return producao.ErrApontamentoAberto
		}
		if err != nil {
			return fmt.Errorf("iniciar apontamento: %w", err)
		}
		return nil
	})
}

// EncerrarApontamento fecha o apontamento em andamento (duracao minima: 1
// min), congelando o custo/hora do centro. So o proprio operador encerra,
// salvo `deOutros` (quem pode cancelar OP destrava um apontamento esquecido).
func (r *ProducaoRepositorio) EncerrarApontamento(ctx context.Context, opID, operadorID int64, deOutros bool, observacoes string) error {
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx, `
		UPDATE apontamento_producao SET tempo_fim = CURRENT_TIMESTAMP,
		  duracao_minutos = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - tempo_inicio)) / 60))::int,
		  observacoes = coalesce(NULLIF($2, ''), observacoes),
		  custo_hora = (SELECT custo_hora FROM centros_trabalho WHERE id = centro_trabalho_id)
		WHERE ordem_producao_id = $1 AND tempo_fim IS NULL AND ($3 OR operador_id = $4)`, opID, observacoes, deOutros, operadorID)
	if err != nil {
		return fmt.Errorf("encerrar apontamento: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return producao.ErrSemApontamentoAberto
	}
	return nil
}

// Avancar leva a OP a proxima etapa, com o efeito de cada passagem: consumo do
// material ao sair da Separacao, conferencia de teste/metrologia ao sair de
// Testes e conclusao (PA no estoque) ao sair da Expedicao.
func (r *ProducaoRepositorio) Avancar(ctx context.Context, id, usuarioID int64, autor string) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		o, err := travarOP(ctx, tx, id)
		if err != nil {
			return err
		}
		if o.status != producao.StatusLiberada {
			return producao.ErrStatusInvalidoParaAcao
		}
		var aberto, encerrado bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (SELECT 1 FROM apontamento_producao WHERE ordem_producao_id = $1 AND tempo_fim IS NULL),
			       EXISTS (SELECT 1 FROM apontamento_producao WHERE ordem_producao_id = $1 AND etapa = $2 AND tempo_fim IS NOT NULL)`,
			id, o.etapa).Scan(&aberto, &encerrado); err != nil {
			return fmt.Errorf("conferir apontamentos: %w", err)
		}
		if aberto {
			return producao.ErrApontamentoAberto
		}
		if !encerrado {
			return producao.ErrSemApontamentoNaEtapa
		}

		switch o.etapa {
		case producao.EtapaSeparacao:
			if err := consumirMaterial(ctx, tx, id, o.numero, autor); err != nil {
				return err
			}
		case producao.EtapaTestes:
			var pendentes, semMetrologia int
			if err := tx.QueryRow(ctx, `
				SELECT count(*) FILTER (WHERE s.status <> 'Aprovado'),
				       count(*) FILTER (WHERE m.id IS NULL OR m.validade < CURRENT_DATE)
				FROM numeros_serie s LEFT JOIN metrologia_serie m ON m.numero_serie_id = s.id
				WHERE s.ordem_producao_id = $1 AND s.status <> 'Cancelado'`, id).Scan(&pendentes, &semMetrologia); err != nil {
				return fmt.Errorf("conferir testes: %w", err)
			}
			if pendentes > 0 {
				return producao.ErrSeriesPendentes
			}
			if o.exigeMetrologia && semMetrologia > 0 {
				return producao.ErrMetrologiaPendente
			}
		case producao.EtapaExpedicao:
			return concluirOP(ctx, tx, id, o, usuarioID, autor)
		}

		proxima := producao.ProximaEtapa(o.etapa)
		if _, err := tx.Exec(ctx, `UPDATE ordens_producao SET etapa_atual = $2, updated_by = $3 WHERE id = $1`, id, proxima, autor); err != nil {
			return fmt.Errorf("avancar etapa: %w", err)
		}
		anterior := o.etapa
		return registrarTransicao(ctx, tx, id, &anterior, proxima, usuarioID)
	})
}

// consumirMaterial baixa do estoque o material reservado (custo pelo CMP do momento).
func consumirMaterial(ctx context.Context, tx pgx.Tx, opID int64, numeroOP, autor string) error {
	linhas, err := tx.Query(ctx, `SELECT parte_peca_id, quantidade_reservada FROM reserva_estoque
		WHERE ordem_producao_id = $1 AND status = 'Reservada' ORDER BY parte_peca_id`, opID)
	if err != nil {
		return fmt.Errorf("ler reservas: %w", err)
	}
	type consumo struct {
		peca int64
		qtd  int
	}
	var consumos []consumo
	var pecas []int64
	for linhas.Next() {
		var c consumo
		if err := linhas.Scan(&c.peca, &c.qtd); err != nil {
			linhas.Close()
			return err
		}
		consumos = append(consumos, c)
		pecas = append(pecas, c.peca)
	}
	linhas.Close()
	saldos, err := travarSaldos(ctx, tx, pecas)
	if err != nil {
		return err
	}
	for _, c := range consumos {
		s := saldos[c.peca]
		novo := s.atual - c.qtd
		if _, err := tx.Exec(ctx, `UPDATE saldo_estoque SET quantidade_atual = $2, quantidade_reservada = quantidade_reservada - $3,
			status = $4, updated_by = $5 WHERE parte_peca_id = $1`,
			c.peca, novo, c.qtd, estoque.SituacaoDoSaldo(novo, s.minimo), autor); err != nil {
			return fmt.Errorf("baixar material: %w", err)
		}
		// Um movimento por lote consumido (kardex por lote); o que nao tinha
		// lote sai num movimento sem lote.
		lotes, err := tx.Query(ctx, `SELECT lote_id, quantidade FROM reservas_lote
			WHERE ordem_producao_id = $1 AND parte_peca_id = $2 AND NOT consumida ORDER BY lote_id`, opID, c.peca)
		if err != nil {
			return fmt.Errorf("ler reservas de lote: %w", err)
		}
		type porLote struct {
			lote int64
			qtd  int
		}
		var consumosLote []porLote
		for lotes.Next() {
			var l porLote
			if err := lotes.Scan(&l.lote, &l.qtd); err != nil {
				lotes.Close()
				return err
			}
			consumosLote = append(consumosLote, l)
		}
		lotes.Close()
		semLote := c.qtd
		for _, l := range consumosLote {
			semLote -= l.qtd
			if _, err := tx.Exec(ctx, `UPDATE lotes SET quantidade_atual = quantidade_atual - $2, quantidade_reservada = quantidade_reservada - $2
				WHERE id = $1`, l.lote, l.qtd); err != nil {
				return fmt.Errorf("baixar lote: %w", err)
			}
			if err := movimentoDeOP(ctx, tx, c.peca, -l.qtd, numeroOP, autor, s.custo, opID, &l.lote); err != nil {
				return err
			}
		}
		if semLote > 0 {
			if err := movimentoDeOP(ctx, tx, c.peca, -semLote, numeroOP, autor, s.custo, opID, nil); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE reservas_lote SET consumida = TRUE WHERE ordem_producao_id = $1 AND parte_peca_id = $2`, opID, c.peca); err != nil {
			return fmt.Errorf("marcar lotes consumidos: %w", err)
		}
		if _, err := tx.Exec(ctx, `UPDATE reserva_estoque SET quantidade_consumida = quantidade_reservada, status = 'Consumida',
			custo_unitario_consumo = $3, updated_at = CURRENT_TIMESTAMP WHERE ordem_producao_id = $1 AND parte_peca_id = $2`,
			opID, c.peca, s.custo); err != nil {
			return fmt.Errorf("registrar consumo da reserva: %w", err)
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE series_componente SET status = 'Consumido' WHERE ordem_producao_id = $1 AND status = 'Reservado'`, opID); err != nil {
		return fmt.Errorf("consumir series: %w", err)
	}
	return nil
}

// movimentoDeOP grava a saida de material da OP no kardex, com o documento.
func movimentoDeOP(ctx context.Context, tx pgx.Tx, peca int64, quantidade int, numeroOP, autor string, custo float64, opID int64, lote *int64) error {
	_, err := tx.Exec(ctx, `INSERT INTO movimentacao_estoque (parte_peca_id, tipo, quantidade, motivo, referencia_numero, usuario_id,
		custo_unitario, documento_tipo, documento_id, lote_id)
		VALUES ($1, $2, $3, $4, $5, (SELECT id FROM usuarios WHERE username = $6), $7, 'ORDEM_PRODUCAO', $8, $9)`,
		peca, estoque.TipoSaida, quantidade, estoque.MotivoOP, numeroOP, autor, custo, opID, lote)
	if err != nil {
		return fmt.Errorf("registrar consumo: %w", err)
	}
	return nil
}

// concluirOP poe o PA no estoque, fecha a OP e, se for a ultima do pedido,
// deixa o pedido Pronto para Envio.
func concluirOP(ctx context.Context, tx pgx.Tx, id int64, o *opTravada, usuarioID int64, autor string) error {
	if _, err := tx.Exec(ctx, `UPDATE ordens_producao SET status = 'Concluida', data_conclusao_real = CURRENT_DATE, updated_by = $2
		WHERE id = $1`, id, autor); err != nil {
		return fmt.Errorf("concluir OP: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO saldo_produto_acabado (produto_acabado_id, quantidade_atual, updated_by) VALUES ($1, $2, $3)
		ON CONFLICT (produto_acabado_id) DO UPDATE
		  SET quantidade_atual = saldo_produto_acabado.quantidade_atual + EXCLUDED.quantidade_atual,
		      updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`, o.produtoID, o.quantidade, autor); err != nil {
		return fmt.Errorf("dar entrada do produto acabado: %w", err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO movimentacao_estoque (produto_acabado_id, tipo, quantidade, motivo, referencia_numero, usuario_id,
		documento_tipo, documento_id)
		VALUES ($1, $2, $3, $4, $5, NULLIF($6, 0), 'ORDEM_PRODUCAO', $7)`, o.produtoID, estoque.TipoEntrada, o.quantidade, estoque.MotivoOP,
		o.numero, usuarioID, id); err != nil {
		return fmt.Errorf("registrar entrada do produto acabado: %w", err)
	}
	// Serie de componente instalada na unidade (serie pai): k-esima serie da
	// peca vai para a unidade k / (quantidade por unidade na BOM).
	if _, err := tx.Exec(ctx, `
		WITH comp AS (
		  SELECT s.id, s.parte_peca_id, row_number() OVER (PARTITION BY s.parte_peca_id ORDER BY s.id) - 1 AS k
		  FROM series_componente s WHERE s.ordem_producao_id = $1 AND s.status = 'Consumido'),
		q AS (SELECT parte_peca_id, quantidade FROM itens_estrutura_produto WHERE estrutura_produto_id = $2),
		pa AS (SELECT id, row_number() OVER (ORDER BY numero) - 1 AS u FROM numeros_serie
		  WHERE ordem_producao_id = $1 AND status <> 'Cancelado')
		UPDATE series_componente sc SET status = 'Instalado', numero_serie_pai_id = pa.id
		FROM comp JOIN q ON q.parte_peca_id = comp.parte_peca_id JOIN pa ON pa.u = comp.k / q.quantidade
		WHERE sc.id = comp.id`, id, o.estruturaID); err != nil {
		return fmt.Errorf("instalar series de componente: %w", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE numeros_serie SET status = 'Em Estoque' WHERE ordem_producao_id = $1 AND status = 'Aprovado'`, id); err != nil {
		return fmt.Errorf("atualizar series: %w", err)
	}
	anterior := producao.EtapaExpedicao
	if err := registrarTransicao(ctx, tx, id, &anterior, producao.StatusConcluida, usuarioID); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		UPDATE pedidos_venda SET status = 'Pronto para Envio', updated_by = $2
		WHERE id = $1 AND status = 'Em Producao' AND NOT EXISTS (
		  SELECT 1 FROM itens_pedido_venda i
		  WHERE i.pedido_venda_id = $1 AND NOT EXISTS (
		    SELECT 1 FROM ordens_producao op WHERE op.item_pedido_venda_id = i.id AND op.status = 'Concluida'))`,
		o.pedidoID, autor)
	if err != nil {
		return fmt.Errorf("atualizar pedido de venda: %w", err)
	}
	return nil
}

// travarOPDaSerie trava pedido e OP da unidade (antes da propria serie).
func travarOPDaSerie(ctx context.Context, tx pgx.Tx, serieID int64) (*opTravada, error) {
	var opID int64
	err := tx.QueryRow(ctx, `SELECT ordem_producao_id FROM numeros_serie WHERE id = $1`, serieID).Scan(&opID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, producao.ErrSerieNaoEncontrada
	}
	if err != nil {
		return nil, fmt.Errorf("ler serie: %w", err)
	}
	return travarOP(ctx, tx, opID)
}

// RegistrarTeste grava aprovado/reprovado de uma unidade da OP em Testes.
func (r *ProducaoRepositorio) RegistrarTeste(ctx context.Context, serieID int64, aprovado bool, resultado string, usuarioID int64) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		o, err := travarOPDaSerie(ctx, tx, serieID)
		if err != nil {
			return err
		}
		var statusSerie string
		if err := tx.QueryRow(ctx, `SELECT status FROM numeros_serie WHERE id = $1 FOR UPDATE`, serieID).Scan(&statusSerie); err != nil {
			return fmt.Errorf("travar serie: %w", err)
		}
		if o.status != producao.StatusLiberada || o.etapa != producao.EtapaTestes ||
			(statusSerie != producao.SerieEmProducao && statusSerie != producao.SerieAprovado && statusSerie != producao.SerieReprovado) {
			return producao.ErrSerieForaDeTeste
		}
		novo := producao.SerieReprovado
		if aprovado {
			novo = producao.SerieAprovado
		}
		_, err = tx.Exec(ctx, `UPDATE numeros_serie SET status = $2, resultado_teste = $3, testado_por = NULLIF($4, 0),
			testado_em = CURRENT_TIMESTAMP WHERE id = $1`, serieID, novo, resultado, usuarioID)
		return err
	})
}

// RegistrarMetrologia grava ou substitui a metrologia de uma unidade.
func (r *ProducaoRepositorio) RegistrarMetrologia(ctx context.Context, serieID int64, m producao.Metrologia, autor string) error {
	return emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		o, err := travarOPDaSerie(ctx, tx, serieID)
		if err != nil {
			return err
		}
		var statusSerie string
		if err := tx.QueryRow(ctx, `SELECT status FROM numeros_serie WHERE id = $1 FOR UPDATE`, serieID).Scan(&statusSerie); err != nil {
			return fmt.Errorf("travar serie: %w", err)
		}
		if !o.exigeMetrologia {
			return producao.ErrProdutoSemMetrologia
		}
		if statusSerie == producao.SerieCancelado {
			return producao.ErrStatusInvalidoParaAcao
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO metrologia_serie (numero_serie_id, numero_aprovacao_modelo, data_verificacao, numero_lacre, validade,
			  observacoes, created_by, updated_by)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
			ON CONFLICT (numero_serie_id) DO UPDATE SET numero_aprovacao_modelo = EXCLUDED.numero_aprovacao_modelo,
			  data_verificacao = EXCLUDED.data_verificacao, numero_lacre = EXCLUDED.numero_lacre,
			  validade = EXCLUDED.validade, observacoes = EXCLUDED.observacoes, updated_by = EXCLUDED.updated_by`,
			serieID, m.NumeroAprovacaoModelo, m.DataVerificacao, m.NumeroLacre, m.Validade, m.Observacoes, autor)
		if err != nil {
			return fmt.Errorf("gravar metrologia: %w", err)
		}
		return nil
	})
}

// FichaAsBuilt monta a rastreabilidade de uma unidade.
func (r *ProducaoRepositorio) FichaAsBuilt(ctx context.Context, numero string) (*producao.FichaAsBuilt, error) {
	conexao := db.DoContexto(ctx, r.pool)
	var opID int64
	err := conexao.QueryRow(ctx, `SELECT ordem_producao_id FROM numeros_serie WHERE numero = $1`, numero).Scan(&opID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, producao.ErrSerieNaoEncontrada
	}
	if err != nil {
		return nil, fmt.Errorf("buscar serie: %w", err)
	}
	s, err := lerSerie(conexao.QueryRow(ctx, `SELECT `+colunasSerie+fromSerie+`WHERE s.numero = $1`, numero))
	if err != nil {
		return nil, fmt.Errorf("ler serie: %w", err)
	}
	o, err := r.buscarOP(ctx, opID)
	if err != nil {
		return nil, err
	}
	f := &producao.FichaAsBuilt{Serie: *s, OP: *o}
	if err := conexao.QueryRow(ctx, `SELECT data_pedido FROM pedidos_venda WHERE id = $1`, o.PedidoVendaID).Scan(&f.DataPedido); err != nil {
		return nil, fmt.Errorf("ler pedido: %w", err)
	}
	linhas, err := conexao.Query(ctx, `
		SELECT pp.codigo, pp.descricao, ie.quantidade FROM itens_estrutura_produto ie
		JOIN partes_pecas pp ON pp.id = ie.parte_peca_id WHERE ie.estrutura_produto_id = $1 ORDER BY pp.codigo`, o.EstruturaID)
	if err != nil {
		return nil, fmt.Errorf("ler componentes: %w", err)
	}
	f.Componentes = []producao.ComponenteBOM{}
	for linhas.Next() {
		var c producao.ComponenteBOM
		if err := linhas.Scan(&c.Codigo, &c.Descricao, &c.Quantidade); err != nil {
			linhas.Close()
			return nil, err
		}
		f.Componentes = append(f.Componentes, c)
	}
	linhas.Close()
	porOP, err := r.apontamentos(ctx, `WHERE a.ordem_producao_id = $1`, opID)
	if err != nil {
		return nil, err
	}
	f.Apontamentos = porOP[opID]
	if f.Apontamentos == nil {
		f.Apontamentos = []producao.Apontamento{}
	}
	if f.Historico, err = r.historico(ctx, opID); err != nil {
		return nil, err
	}
	if f.SeriesComponentes, err = r.seriesInstaladas(ctx, f.Serie.ID); err != nil {
		return nil, err
	}
	if f.LotesConsumidos, err = r.lotesConsumidos(ctx, opID); err != nil {
		return nil, err
	}
	if f.Documentos, err = r.laudosDaOP(ctx, opID); err != nil {
		return nil, err
	}
	return f, nil
}

// laudosDaOP: laudos de teste e relatorios de inspecao vigentes da OP.
func (r *ProducaoRepositorio) laudosDaOP(ctx context.Context, opID int64) ([]producao.DocumentoOP, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT an.id, an.categoria, an.titulo, an.arquivo_id::text, ar.nome_original, an.data_emissao, an.created_at
		FROM anexos an JOIN arquivos ar ON ar.id = an.arquivo_id
		WHERE an.entidade = 'ordem_producao' AND an.entidade_id = $1 AND an.vigente AND an.categoria = ANY($2)
		ORDER BY an.created_at, an.id`, opID, arquivo.CategoriasLaudo)
	if err != nil {
		return nil, fmt.Errorf("listar laudos da OP: %w", err)
	}
	defer linhas.Close()
	lista := []producao.DocumentoOP{}
	for linhas.Next() {
		var d producao.DocumentoOP
		if err := linhas.Scan(&d.AnexoID, &d.Categoria, &d.Titulo, &d.ArquivoID, &d.NomeArquivo, &d.DataEmissao, &d.CreatedAt); err != nil {
			return nil, err
		}
		lista = append(lista, d)
	}
	return lista, linhas.Err()
}

// seriesInstaladas: componentes com serie instalados na unidade.
func (r *ProducaoRepositorio) seriesInstaladas(ctx context.Context, serieID int64) ([]producao.SerieComponente, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT pp.codigo, pp.descricao, sc.numero, coalesce(l.numero_lote, ''),
		       coalesce(n.numero || '/' || n.serie, ''), n.id, coalesce(f.razao_social, ''), n.data_entrada
		FROM series_componente sc
		JOIN partes_pecas pp ON pp.id = sc.parte_peca_id
		LEFT JOIN lotes l ON l.id = sc.lote_id
		LEFT JOIN itens_nf_entrada i ON i.id = sc.item_nf_id
		LEFT JOIN notas_fiscais_entrada n ON n.id = i.nota_id
		LEFT JOIN fornecedores f ON f.id = n.fornecedor_id
		WHERE sc.numero_serie_pai_id = $1 ORDER BY pp.codigo, sc.numero`, serieID)
	if err != nil {
		return nil, fmt.Errorf("series instaladas: %w", err)
	}
	defer linhas.Close()
	lista := []producao.SerieComponente{}
	for linhas.Next() {
		var x producao.SerieComponente
		if err := linhas.Scan(&x.PecaCodigo, &x.PecaDescricao, &x.Numero, &x.NumeroLote, &x.Nota, &x.NotaID, &x.FornecedorNome, &x.DataEntrada); err != nil {
			return nil, err
		}
		lista = append(lista, x)
	}
	return lista, linhas.Err()
}

// lotesConsumidos: lotes de componente consumidos pela OP.
func (r *ProducaoRepositorio) lotesConsumidos(ctx context.Context, opID int64) ([]producao.LoteConsumido, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT l.id, pp.codigo, l.numero_lote, l.validade, rl.quantidade, coalesce(f.razao_social, ''),
		       coalesce((SELECT string_agg(DISTINCT n.numero || '/' || n.serie, ', ')
		                 FROM itens_nf_lotes inl JOIN itens_nf_entrada i ON i.id = inl.item_nf_id
		                 JOIN notas_fiscais_entrada n ON n.id = i.nota_id AND n.status = 'Efetivada'
		                 WHERE inl.lote_id = l.id), '')
		FROM reservas_lote rl
		JOIN lotes l ON l.id = rl.lote_id
		JOIN partes_pecas pp ON pp.id = rl.parte_peca_id
		LEFT JOIN fornecedores f ON f.id = l.fornecedor_id
		WHERE rl.ordem_producao_id = $1 AND rl.consumida ORDER BY pp.codigo, l.numero_lote`, opID)
	if err != nil {
		return nil, fmt.Errorf("lotes consumidos: %w", err)
	}
	defer linhas.Close()
	lista := []producao.LoteConsumido{}
	for linhas.Next() {
		var x producao.LoteConsumido
		if err := linhas.Scan(&x.LoteID, &x.PecaCodigo, &x.NumeroLote, &x.Validade, &x.Quantidade, &x.FornecedorNome, &x.Notas); err != nil {
			return nil, err
		}
		lista = append(lista, x)
	}
	return lista, linhas.Err()
}

// VencimentosMetrologia lista verificacoes vencidas ou que vencem em ate `dias`.
func (r *ProducaoRepositorio) VencimentosMetrologia(ctx context.Context, dias int) ([]producao.VencimentoMetrologia, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT s.id, s.numero, pa.codigo, pa.descricao, coalesce(c.razao_social, pv.cliente_nome, ''), m.numero_lacre,
		       m.validade, m.validade < CURRENT_DATE
		FROM metrologia_serie m
		JOIN numeros_serie s ON s.id = m.numero_serie_id
		JOIN produtos_acabados pa ON pa.id = s.produto_acabado_id
		JOIN ordens_producao op ON op.id = s.ordem_producao_id
		JOIN itens_pedido_venda i ON i.id = op.item_pedido_venda_id
		JOIN pedidos_venda pv ON pv.id = i.pedido_venda_id
		LEFT JOIN clientes c ON c.id = pv.cliente_id
		WHERE s.status <> 'Cancelado' AND m.validade <= CURRENT_DATE + $1::int
		ORDER BY m.validade, s.numero`, dias)
	if err != nil {
		return nil, fmt.Errorf("listar vencimentos de metrologia: %w", err)
	}
	defer linhas.Close()
	lista := []producao.VencimentoMetrologia{}
	for linhas.Next() {
		var v producao.VencimentoMetrologia
		if err := linhas.Scan(&v.SerieID, &v.Numero, &v.ProdutoCodigo, &v.ProdutoDescricao, &v.ClienteNome, &v.NumeroLacre,
			&v.Validade, &v.Vencida); err != nil {
			return nil, err
		}
		lista = append(lista, v)
	}
	return lista, linhas.Err()
}
