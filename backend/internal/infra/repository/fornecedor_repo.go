package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Os campos de contato e endereco sao opcionais no schema. O dominio os trata
// como texto simples ("nao informado" e string vazia), entao a leitura resolve
// o NULL aqui, na fronteira do banco.
const colunasFornecedor = `id, razao_social, cnpj,
	coalesce(contato_nome, '') AS contato_nome,
	coalesce(contato_email, '') AS contato_email,
	coalesce(contato_telefone, '') AS contato_telefone,
	coalesce(endereco, '') AS endereco,
	lead_time_medio,
	coalesce(condicao_pagamento, '') AS condicao_pagamento,
	ativo, created_at, updated_at, created_by, updated_by`

// statusEncerrados sao os status de pedido de compra que nao geram mais
// pendencia — os demais impedem a exclusao do fornecedor (RF1.4).
var statusEncerrados = []string{"Concluido", "Cancelado"}

// FornecedorRepositorio implementa fornecedor.Repositorio sobre PostgreSQL.
type FornecedorRepositorio struct {
	pool *pgxpool.Pool
}

// NovoFornecedorRepositorio cria o repositorio de fornecedores.
func NovoFornecedorRepositorio(pool *pgxpool.Pool) *FornecedorRepositorio {
	return &FornecedorRepositorio{pool: pool}
}

func (r *FornecedorRepositorio) Criar(ctx context.Context, f *fornecedor.Fornecedor, autor string) error {
	sql := `INSERT INTO fornecedores
		(razao_social, cnpj, contato_nome, contato_email, contato_telefone,
		 endereco, lead_time_medio, condicao_pagamento, ativo, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
		RETURNING id, created_at, updated_at`

	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, sql,
		f.RazaoSocial, f.CNPJ, f.ContatoNome, f.ContatoEmail, f.ContatoTelefone,
		f.Endereco, f.LeadTimeMedio, f.CondicaoPagamento, f.Ativo, autor,
	).Scan(&f.ID, &f.CreatedAt, &f.UpdatedAt)

	if err != nil {
		if violouIndiceUnico(err) {
			return fornecedor.ErrCNPJDuplicado
		}
		return fmt.Errorf("criar fornecedor: %w", err)
	}
	f.CreatedBy, f.UpdatedBy = &autor, &autor
	return nil
}

func (r *FornecedorRepositorio) Atualizar(ctx context.Context, f *fornecedor.Fornecedor, autor string) error {
	sql := `UPDATE fornecedores
		SET razao_social = $2, cnpj = $3, contato_nome = $4, contato_email = $5,
		    contato_telefone = $6, endereco = $7, lead_time_medio = $8,
		    condicao_pagamento = $9, ativo = $10, updated_by = $11
		WHERE id = $1
		RETURNING updated_at`

	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, sql,
		f.ID, f.RazaoSocial, f.CNPJ, f.ContatoNome, f.ContatoEmail, f.ContatoTelefone,
		f.Endereco, f.LeadTimeMedio, f.CondicaoPagamento, f.Ativo, autor,
	).Scan(&f.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fornecedor.ErrNaoEncontrado
		}
		if violouIndiceUnico(err) {
			return fornecedor.ErrCNPJDuplicado
		}
		return fmt.Errorf("atualizar fornecedor: %w", err)
	}
	f.UpdatedBy = &autor
	return nil
}

func (r *FornecedorRepositorio) BuscarPorID(ctx context.Context, id int64) (*fornecedor.Fornecedor, error) {
	sql := `SELECT ` + colunasFornecedor + ` FROM fornecedores WHERE id = $1`

	f, err := lerFornecedor(db.DoContexto(ctx, r.pool).QueryRow(ctx, sql, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fornecedor.ErrNaoEncontrado
		}
		return nil, fmt.Errorf("buscar fornecedor: %w", err)
	}
	return &f, nil
}

func (r *FornecedorRepositorio) Listar(ctx context.Context, params consulta.Parametros) ([]fornecedor.Fornecedor, int, error) {
	filtros, argumentos := filtrosDeCadastro(params, "razao_social", "cnpj", "contato_nome")

	var total int
	if err := db.DoContexto(ctx, r.pool).QueryRow(ctx,
		`SELECT count(*) FROM fornecedores `+filtros, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar fornecedores: %w", err)
	}

	sql := fmt.Sprintf("SELECT %s FROM fornecedores %s ORDER BY %s %s LIMIT $%d OFFSET $%d",
		colunasFornecedor, filtros, params.OrdenarPor, params.Ordem.SQL(),
		len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, params.Limite, params.Offset())

	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar fornecedores: %w", err)
	}
	defer linhas.Close()

	itens := make([]fornecedor.Fornecedor, 0, params.Limite)
	for linhas.Next() {
		f, err := lerFornecedor(linhas)
		if err != nil {
			return nil, 0, err
		}
		itens = append(itens, f)
	}
	return itens, total, linhas.Err()
}

func (r *FornecedorRepositorio) Desativar(ctx context.Context, id int64, autor string) error {
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx,
		`UPDATE fornecedores SET ativo = false, updated_by = $2 WHERE id = $1`, id, autor)
	if err != nil {
		return fmt.Errorf("desativar fornecedor: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return fornecedor.ErrNaoEncontrado
	}
	return nil
}

func (r *FornecedorRepositorio) PossuiPedidosPendentes(ctx context.Context, id int64) (bool, error) {
	var existe bool
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM pedidos_compra
			WHERE fornecedor_id = $1 AND status <> ALL($2)
		)`, id, statusEncerrados).Scan(&existe)
	if err != nil {
		return false, fmt.Errorf("verificar pedidos do fornecedor: %w", err)
	}
	return existe, nil
}

// linha cobre pgx.Row e pgx.Rows, que expoem o mesmo Scan.
type linha interface {
	Scan(destinos ...any) error
}

func lerFornecedor(l linha) (fornecedor.Fornecedor, error) {
	var f fornecedor.Fornecedor
	err := l.Scan(
		&f.ID, &f.RazaoSocial, &f.CNPJ, &f.ContatoNome, &f.ContatoEmail, &f.ContatoTelefone,
		&f.Endereco, &f.LeadTimeMedio, &f.CondicaoPagamento, &f.Ativo,
		&f.CreatedAt, &f.UpdatedAt, &f.CreatedBy, &f.UpdatedBy,
	)
	return f, err
}
