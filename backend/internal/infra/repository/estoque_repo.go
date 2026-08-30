package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasSaldo = `se.id, se.parte_peca_id, pp.codigo, pp.descricao, se.quantidade_atual,
	se.quantidade_reservada, pp.estoque_minimo, coalesce(se.localizacao_armazem, ''),
	se.status, se.updated_at, se.updated_by`

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
		&s.Status, &s.UpdatedAt, &s.UpdatedBy,
	)
	s.Disponivel = s.QuantidadeAtual - s.QuantidadeReservada
	return s, err
}

// BuscarSaldo devolve o saldo de uma Parte/Peca especifica.
func (r *EstoqueRepositorio) BuscarSaldo(ctx context.Context, partePecaID int64) (*estoque.Saldo, error) {
	linha := r.pool.QueryRow(ctx,
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
	if err := r.pool.QueryRow(ctx,
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

	linhas, err := r.pool.Query(ctx, sql, argumentos...)
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
	linhas, err := r.pool.Query(ctx,
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

// ListarMovimentacoes traz o historico, paginado e filtrado por
// data/motivo/parte_peca_id.
func (r *EstoqueRepositorio) ListarMovimentacoes(ctx context.Context, params consulta.Parametros) ([]estoque.Movimentacao, int, error) {
	filtros, argumentos := filtrosDeCadastro(params)

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT count(*) FROM movimentacao_estoque m JOIN partes_pecas pp ON pp.id = m.parte_peca_id `+filtros,
		argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar movimentacoes: %w", err)
	}

	sql := fmt.Sprintf(
		`SELECT %s FROM movimentacao_estoque m
		 JOIN partes_pecas pp ON pp.id = m.parte_peca_id
		 LEFT JOIN usuarios u ON u.id = m.usuario_id
		 %s ORDER BY m.data_hora DESC LIMIT $%d OFFSET $%d`,
		colunasMovimentacao, filtros, len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, params.Limite, params.Offset())

	linhas, err := r.pool.Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar movimentacoes: %w", err)
	}
	defer linhas.Close()

	itens := make([]estoque.Movimentacao, 0, params.Limite)
	for linhas.Next() {
		var m estoque.Movimentacao
		if err := linhas.Scan(
			&m.ID, &m.PartePecaID, &m.Codigo, &m.Tipo, &m.Quantidade, &m.Motivo,
			&m.ReferenciaNumero, &m.Observacoes, &m.Usuario, &m.DataHora,
		); err != nil {
			return nil, 0, err
		}
		itens = append(itens, m)
	}
	return itens, total, linhas.Err()
}

func (r *EstoqueRepositorio) BuscarMovimentacao(ctx context.Context, id int64) (*estoque.Movimentacao, error) {
	var m estoque.Movimentacao
	err := r.pool.QueryRow(ctx,
		`SELECT `+colunasMovimentacao+` FROM movimentacao_estoque m
		 JOIN partes_pecas pp ON pp.id = m.parte_peca_id
		 LEFT JOIN usuarios u ON u.id = m.usuario_id
		 WHERE m.id = $1`, id).Scan(
		&m.ID, &m.PartePecaID, &m.Codigo, &m.Tipo, &m.Quantidade, &m.Motivo,
		&m.ReferenciaNumero, &m.Observacoes, &m.Usuario, &m.DataHora,
	)
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
) (*estoque.Saldo, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var quantidadeAtual, estoqueMinimo int
	err = tx.QueryRow(ctx,
		`SELECT se.quantidade_atual, pp.estoque_minimo
		 FROM saldo_estoque se JOIN partes_pecas pp ON pp.id = se.parte_peca_id
		 WHERE se.parte_peca_id = $1 FOR UPDATE OF se`, partePecaID,
	).Scan(&quantidadeAtual, &estoqueMinimo)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, estoque.ErrPartePecaInexistente
		}
		return nil, fmt.Errorf("travar saldo de estoque: %w", err)
	}

	novoSaldo := quantidadeAtual + delta
	if novoSaldo < 0 {
		return nil, estoque.ErrSaldoInsuficienteParaAjuste
	}
	novoStatus := estoque.SituacaoDoSaldo(novoSaldo, estoqueMinimo)

	if _, err := tx.Exec(ctx,
		`UPDATE saldo_estoque SET quantidade_atual = $1, status = $2, updated_by = $3 WHERE parte_peca_id = $4`,
		novoSaldo, novoStatus, autor, partePecaID,
	); err != nil {
		return nil, fmt.Errorf("atualizar saldo de estoque: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO movimentacao_estoque (parte_peca_id, tipo, quantidade, motivo, referencia_numero, observacoes, usuario_id)
		 VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), (SELECT id FROM usuarios WHERE username = $7))`,
		partePecaID, tipo, delta, motivo, referencia, observacoes, autor,
	); err != nil {
		return nil, fmt.Errorf("gravar movimentacao de estoque: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("confirmar movimento de estoque: %w", err)
	}
	return r.BuscarSaldo(ctx, partePecaID)
}
