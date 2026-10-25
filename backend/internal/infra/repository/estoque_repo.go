package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/controle"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasSaldo = `se.id, se.parte_peca_id, pp.codigo, pp.descricao, se.quantidade_atual,
	se.quantidade_reservada, pp.estoque_minimo, coalesce(se.localizacao_armazem, ''),
	se.status, se.updated_at, se.updated_by, se.custo_medio::float8`

const colunasMovimentacao = `m.id, m.parte_peca_id, pp.codigo, m.tipo, m.quantidade, m.motivo,
	m.referencia_numero, coalesce(m.observacoes, ''), u.username, m.data_hora`

// EstoqueRepositorio implementa estoque.Repositorio sobre PostgreSQL.
type EstoqueRepositorio struct {
	pool *pgxpool.Pool
}

// NovoEstoqueRepositorio cria o repositorio de estoque.
func NovoEstoqueRepositorio(pool *pgxpool.Pool) *EstoqueRepositorio {
	return &EstoqueRepositorio{pool: pool}
}

func escanearSaldo(linha interface{ Scan(...any) error }) (estoque.Saldo, error) {
	var s estoque.Saldo
	err := linha.Scan(
		&s.ID, &s.PartePecaID, &s.Codigo, &s.Descricao, &s.QuantidadeAtual,
		&s.QuantidadeReservada, &s.EstoqueMinimo, &s.LocalizacaoArmazem,
		&s.Status, &s.UpdatedAt, &s.UpdatedBy, &s.CustoMedio,
	)
	s.Disponivel = s.QuantidadeAtual - s.QuantidadeReservada
	return s, err
}

// BuscarSaldo devolve o saldo de uma Parte/Peca especifica.
func (r *EstoqueRepositorio) BuscarSaldo(ctx context.Context, partePecaID int64) (*estoque.Saldo, error) {
	linha := db.DoContexto(ctx, r.pool).QueryRow(ctx,
		`SELECT `+colunasSaldo+` FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id
		 WHERE se.parte_peca_id = $1`, partePecaID)
	s, err := escanearSaldo(linha)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, estoque.ErrNaoEncontrado
		}
		return nil, fmt.Errorf("buscar saldo de estoque: %w", err)
	}
	return &s, nil
}

// ListarSaldo traz o saldo de todas as Partes/Pecas, paginado e filtrado por
// status -- e um JOIN com partes_pecas, nao um SELECT isolado em
// saldo_estoque, porque a listagem nao faz sentido sem codigo/descricao.
func (r *EstoqueRepositorio) ListarSaldo(ctx context.Context, params consulta.Parametros) ([]estoque.Saldo, int, error) {
	filtros, argumentos := filtrosDeEstoque(params)

	var total int
	if err := db.DoContexto(ctx, r.pool).QueryRow(ctx,
		`SELECT count(*) FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id `+filtros,
		argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar saldo de estoque: %w", err)
	}

	ordenarPor := params.OrdenarPor
	if ordenarPor == "codigo" || ordenarPor == "quantidade_atual" || ordenarPor == "status" || ordenarPor == "updated_at" {
		ordenarPor = "se." + ordenarPor
		if params.OrdenarPor == "codigo" {
			ordenarPor = "pp.codigo"
		}
	}
	sql := fmt.Sprintf(
		"SELECT %s FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id %s ORDER BY %s %s LIMIT $%d OFFSET $%d",
		colunasSaldo, filtros, ordenarPor, params.Ordem.SQL(), len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, params.Limite, params.Offset())

	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar saldo de estoque: %w", err)
	}
	defer linhas.Close()

	itens := make([]estoque.Saldo, 0, params.Limite)
	for linhas.Next() {
		s, err := escanearSaldo(linhas)
		if err != nil {
			return nil, 0, err
		}
		itens = append(itens, s)
	}
	return itens, total, linhas.Err()
}

// ListarCriticos e um atalho de ListarSaldo para status=CRITICO, sem
// paginacao -- e um alerta operacional, lista curta por natureza.
func (r *EstoqueRepositorio) ListarCriticos(ctx context.Context) ([]estoque.Saldo, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx,
		`SELECT `+colunasSaldo+` FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id
		 WHERE se.status = $1 ORDER BY pp.codigo`, estoque.StatusCritico)
	if err != nil {
		return nil, fmt.Errorf("listar itens criticos: %w", err)
	}
	defer linhas.Close()

	itens := make([]estoque.Saldo, 0)
	for linhas.Next() {
		s, err := escanearSaldo(linhas)
		if err != nil {
			return nil, err
		}
		itens = append(itens, s)
	}
	return itens, linhas.Err()
}

// ListarParaRelatorio devolve todo o saldo (sem paginacao, sem LIMIT/OFFSET
// nem o count(*) que a listagem paginada paga) -- so para a exportacao CSV.
func (r *EstoqueRepositorio) ListarParaRelatorio(ctx context.Context) ([]estoque.Saldo, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx,
		`SELECT `+colunasSaldo+` FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id
		 ORDER BY pp.codigo`)
	if err != nil {
		return nil, fmt.Errorf("listar saldo de estoque para relatorio: %w", err)
	}
	defer linhas.Close()

	itens := make([]estoque.Saldo, 0)
	for linhas.Next() {
		s, err := escanearSaldo(linhas)
		if err != nil {
			return nil, err
		}
		itens = append(itens, s)
	}
	return itens, linhas.Err()
}

func escanearMovimentacao(linha interface{ Scan(...any) error }) (estoque.Movimentacao, error) {
	var m estoque.Movimentacao
	err := linha.Scan(
		&m.ID, &m.PartePecaID, &m.Codigo, &m.Tipo, &m.Quantidade, &m.Motivo,
		&m.ReferenciaNumero, &m.Observacoes, &m.Usuario, &m.DataHora,
	)
	return m, err
}

// ListarMovimentacoes traz o historico paginado; sem filtro nesta sprint
// (nenhuma rota ainda envia motivo/data/parte_peca_id -- ver RF2.3 para
// quando isso mudar). Nao usar filtrosDeCadastro aqui: o "ativo = $1" que ela
// gera ficaria ambiguo, pois tanto partes_pecas quanto usuarios (JOIN/LEFT
// JOIN abaixo) tem coluna ativo.
func (r *EstoqueRepositorio) ListarMovimentacoes(ctx context.Context, params consulta.Parametros) ([]estoque.Movimentacao, int, error) {
	var total int
	if err := db.DoContexto(ctx, r.pool).QueryRow(ctx,
		`SELECT count(*) FROM movimentacao_estoque m JOIN partes_pecas pp ON pp.id = m.parte_peca_id`,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar movimentacoes: %w", err)
	}

	sql := fmt.Sprintf(
		`SELECT %s FROM movimentacao_estoque m
		 JOIN partes_pecas pp ON pp.id = m.parte_peca_id
		 LEFT JOIN usuarios u ON u.id = m.usuario_id
		 ORDER BY m.data_hora DESC LIMIT $1 OFFSET $2`,
		colunasMovimentacao)

	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, sql, params.Limite, params.Offset())
	if err != nil {
		return nil, 0, fmt.Errorf("listar movimentacoes: %w", err)
	}
	defer linhas.Close()

	itens := make([]estoque.Movimentacao, 0, params.Limite)
	for linhas.Next() {
		m, err := escanearMovimentacao(linhas)
		if err != nil {
			return nil, 0, err
		}
		itens = append(itens, m)
	}
	return itens, total, linhas.Err()
}

func (r *EstoqueRepositorio) BuscarMovimentacao(ctx context.Context, id int64) (*estoque.Movimentacao, error) {
	linha := db.DoContexto(ctx, r.pool).QueryRow(ctx,
		`SELECT `+colunasMovimentacao+` FROM movimentacao_estoque m
		 JOIN partes_pecas pp ON pp.id = m.parte_peca_id
		 LEFT JOIN usuarios u ON u.id = m.usuario_id
		 WHERE m.id = $1`, id)
	m, err := escanearMovimentacao(linha)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, estoque.ErrMovimentacaoNaoEncontrada
		}
		return nil, fmt.Errorf("buscar movimentacao: %w", err)
	}
	return &m, nil
}

// AplicarMovimento e a unica escrita do modulo: le o saldo atual e o
// estoque_minimo com FOR UPDATE (trava a linha -- uma segunda chamada
// concorrente para a mesma peca espera esta transacao terminar, em vez de
// ler um valor que esta prestes a mudar), decide o novo saldo e status em
// Go, grava as duas tabelas na mesma transacao.
func (r *EstoqueRepositorio) AplicarMovimento(
	ctx context.Context, partePecaID int64, delta int, tipo, motivo string, referencia *string, observacoes, autor string,
	custoUnitario *float64,
) (*estoque.Saldo, error) {
	tx, err := db.DoContexto(ctx, r.pool).Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var quantidadeAtual, quantidadeReservada, estoqueMinimo int
	var custoMedio float64
	err = tx.QueryRow(ctx,
		`SELECT se.quantidade_atual, se.quantidade_reservada, pp.estoque_minimo, se.custo_medio::float8
		 FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id
		 WHERE se.parte_peca_id = $1 FOR UPDATE OF se`, partePecaID,
	).Scan(&quantidadeAtual, &quantidadeReservada, &estoqueMinimo, &custoMedio)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, estoque.ErrPartePecaInexistente
		}
		return nil, fmt.Errorf("travar saldo de estoque: %w", err)
	}

	novoSaldo := quantidadeAtual + delta
	// O reservado para OPs liberadas nao pode ser consumido por um ajuste.
	if novoSaldo < 0 || novoSaldo < quantidadeReservada {
		return nil, estoque.ErrSaldoInsuficienteParaAjuste
	}
	novoStatus := estoque.SituacaoDoSaldo(novoSaldo, estoqueMinimo)
	// CMP: (saldo x custo medio + entrada x custo da entrada) / novo saldo.
	custoDoMovimento := custoMedio
	if custoUnitario != nil && delta > 0 {
		custoDoMovimento = *custoUnitario
		if custoMedio == 0 {
			// Saldo anterior sem custo (estoque de antes do CMP): ponderar com
			// zero subestimaria o custo para sempre -- adota o da entrada.
			custoMedio = *custoUnitario
		} else {
			custoMedio = (float64(max(quantidadeAtual, 0))*custoMedio + float64(delta)**custoUnitario) / float64(novoSaldo)
		}
	}

	if _, err := tx.Exec(ctx,
		`UPDATE saldo_estoque SET quantidade_atual = $1, status = $2, updated_by = $3, custo_medio = round($5::numeric, 4)
		 WHERE parte_peca_id = $4`,
		novoSaldo, novoStatus, autor, partePecaID, custoMedio,
	); err != nil {
		return nil, fmt.Errorf("atualizar saldo de estoque: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO movimentacao_estoque (parte_peca_id, tipo, quantidade, motivo, referencia_numero, observacoes, usuario_id, custo_unitario)
		 VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), (SELECT id FROM usuarios WHERE username = $7), round($8::numeric, 4))`,
		partePecaID, tipo, delta, motivo, referencia, observacoes, autor, custoDoMovimento,
	); err != nil {
		return nil, fmt.Errorf("gravar movimentacao de estoque: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("confirmar movimento de estoque: %w", err)
	}
	return r.BuscarSaldo(ctx, partePecaID)
}

// AjustarRastreado aplica o ajuste manual com o rastro: lote (entrada soma ao
// lote, saida baixa dele) e series (entrada cria, saida sucateia), conforme
// as flags da peca -- tudo na transacao do saldo, para o saldo por lote e as
// series nunca divergirem do saldo total.
func (r *EstoqueRepositorio) AjustarRastreado(ctx context.Context, d estoque.AjusteDados, autor string) (*estoque.Saldo, error) {
	err := emTransacao(ctx, r.pool, func(tx pgx.Tx) error {
		var atual, reservada, minimo int
		var controlaLote, controlaSerie, controlaValidade bool
		var mascara string
		err := tx.QueryRow(ctx, `
			SELECT se.quantidade_atual, se.quantidade_reservada, pp.estoque_minimo, pp.controla_lote,
			       pp.controla_numero_serie, pp.mascara_serie, pp.controla_validade
			FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id
			WHERE se.parte_peca_id = $1 FOR UPDATE OF se`, d.PartePecaID).Scan(&atual, &reservada, &minimo, &controlaLote, &controlaSerie, &mascara, &controlaValidade)
		if errors.Is(err, pgx.ErrNoRows) {
			return estoque.ErrPartePecaInexistente
		}
		if err != nil {
			return fmt.Errorf("travar saldo de estoque: %w", err)
		}
		novo := atual + d.Quantidade
		if novo < 0 || novo < reservada {
			return estoque.ErrSaldoInsuficienteParaAjuste
		}
		var loteID *int64
		if controlaLote {
			if d.Lote == nil || d.Lote.NumeroLote == "" {
				return estoque.ErrLoteObrigatorio
			}
			var id int64
			if d.Quantidade > 0 && controlaValidade {
				var existente *tempo.Data
				_ = tx.QueryRow(ctx, `SELECT validade FROM lotes WHERE parte_peca_id = $1 AND fornecedor_id IS NULL AND numero_lote = $2`,
					d.PartePecaID, d.Lote.NumeroLote).Scan(&existente)
				if d.Lote.Validade.IsZero() || (existente != nil && !existente.Time.Equal(d.Lote.Validade.Time)) {
					return estoque.ErrValidadeDoLote
				}
			}
			if d.Quantidade > 0 {
				err = tx.QueryRow(ctx, `
					INSERT INTO lotes (parte_peca_id, numero_lote, validade, data_fabricacao, quantidade_atual)
					VALUES ($1, $2, $3, $4, $5)
					ON CONFLICT (parte_peca_id, coalesce(fornecedor_id, 0), numero_lote) DO UPDATE
					  SET quantidade_atual = lotes.quantidade_atual + EXCLUDED.quantidade_atual,
					      validade = coalesce(lotes.validade, EXCLUDED.validade)
					RETURNING id`, d.PartePecaID, d.Lote.NumeroLote, d.Lote.Validade, d.Lote.DataFabricacao, d.Quantidade).Scan(&id)
			} else {
				err = tx.QueryRow(ctx, `
					UPDATE lotes SET quantidade_atual = quantidade_atual + $3
					WHERE id = (SELECT id FROM lotes WHERE parte_peca_id = $1 AND numero_lote = $2
					            AND quantidade_atual - quantidade_reservada >= -$3 ORDER BY fornecedor_id NULLS FIRST LIMIT 1)
					RETURNING id`, d.PartePecaID, d.Lote.NumeroLote, d.Quantidade).Scan(&id)
				if errors.Is(err, pgx.ErrNoRows) {
					return estoque.ErrLoteInsuficiente
				}
			}
			if err != nil {
				return fmt.Errorf("ajustar lote: %w", err)
			}
			loteID = &id
		}
		if controlaSerie {
			if len(d.Series) != abs(d.Quantidade) {
				return estoque.ErrSeriesDoAjuste
			}
			for _, numero := range d.Series {
				if numero == "" || (d.Quantidade > 0 && !controle.SerieConfere(mascara, numero)) {
					return estoque.ErrSeriesDoAjuste
				}
				if d.Quantidade > 0 {
					if _, err := tx.Exec(ctx, `INSERT INTO series_componente (parte_peca_id, numero, lote_id) VALUES ($1, $2, $3)`,
						d.PartePecaID, numero, loteID); err != nil {
						if violouIndiceUnico(err) {
							return estoque.ErrSerieIndisponivel
						}
						return fmt.Errorf("gravar serie: %w", err)
					}
					continue
				}
				etiqueta, err := tx.Exec(ctx, `UPDATE series_componente SET status = 'Sucateado'
					WHERE parte_peca_id = $1 AND numero = $2 AND status = 'Em Estoque'`, d.PartePecaID, numero)
				if err != nil {
					return fmt.Errorf("baixar serie: %w", err)
				}
				if etiqueta.RowsAffected() == 0 {
					return estoque.ErrSerieIndisponivel
				}
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE saldo_estoque SET quantidade_atual = $2, status = $3, updated_by = $4 WHERE parte_peca_id = $1`,
			d.PartePecaID, novo, estoque.SituacaoDoSaldo(novo, minimo), autor); err != nil {
			return fmt.Errorf("atualizar saldo de estoque: %w", err)
		}
		_, err = tx.Exec(ctx, `INSERT INTO movimentacao_estoque (parte_peca_id, tipo, quantidade, motivo, observacoes, usuario_id,
			custo_unitario, documento_tipo, lote_id)
			VALUES ($1, 'Ajuste', $2, 'Ajuste', NULLIF($3, ''), (SELECT id FROM usuarios WHERE username = $4),
			  (SELECT custo_medio FROM saldo_estoque WHERE parte_peca_id = $1), 'AJUSTE', $5)`,
			d.PartePecaID, d.Quantidade, strings.TrimSpace(d.Motivo+" -- "+d.Observacoes), autor, loteID)
		if err != nil {
			return fmt.Errorf("gravar movimentacao de estoque: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return r.BuscarSaldo(ctx, d.PartePecaID)
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}
