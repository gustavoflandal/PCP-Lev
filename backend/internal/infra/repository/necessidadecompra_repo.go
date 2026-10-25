package repository

import (
	"context"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/necessidadecompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NecessidadeCompraRepositorio implementa necessidadecompra.Repositorio
// sobre PostgreSQL.
type NecessidadeCompraRepositorio struct {
	pool *pgxpool.Pool
}

// NovoNecessidadeCompraRepositorio cria o repositorio de necessidade de compra.
func NovoNecessidadeCompraRepositorio(pool *pgxpool.Pool) *NecessidadeCompraRepositorio {
	return &NecessidadeCompraRepositorio{pool: pool}
}

// Listar devolve as pecas ativas com saldo abaixo do estoque minimo, com o
// fornecedor padrao (se houver) para o atalho de "gerar cotacao" no
// frontend. A necessidade e calculada em Go, nao em SQL, para nao duplicar
// a subtracao caso um dia precise arredondar por lote de compra.
//
// Fronteira exclusiva (`<`, nao `<=` como estoque.SituacaoDoSaldo/RN5): com
// saldo igual ao minimo a necessidade seria zero, uma sugestao de compra
// inutil -- a tela de Estoque/Painel ainda mostra esse caso como Critico
// (RN5), so aqui ele nao gera sugestao. Divergencia deliberada, nao um erro.
func (r *NecessidadeCompraRepositorio) Listar(ctx context.Context) ([]necessidadecompra.Item, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT pp.id, pp.codigo, pp.descricao, se.quantidade_atual, pp.estoque_minimo,
		       f.id, f.razao_social
		FROM partes_pecas pp
		JOIN saldo_estoque se ON se.parte_peca_id = pp.id
		LEFT JOIN fornecedores f ON f.id = pp.fornecedor_padrao_id AND f.ativo
		WHERE pp.ativo AND se.quantidade_atual < pp.estoque_minimo
		ORDER BY pp.codigo`)
	if err != nil {
		return nil, fmt.Errorf("listar necessidade de compra: %w", err)
	}
	defer linhas.Close()

	itens := make([]necessidadecompra.Item, 0)
	for linhas.Next() {
		var item necessidadecompra.Item
		if err := linhas.Scan(
			&item.PartePecaID, &item.Codigo, &item.Descricao, &item.SaldoAtual, &item.EstoqueMinimo,
			&item.FornecedorPadraoID, &item.FornecedorPadraoNome,
		); err != nil {
			return nil, err
		}
		item.Necessidade = item.EstoqueMinimo - item.SaldoAtual
		itens = append(itens, item)
	}
	return itens, linhas.Err()
}
