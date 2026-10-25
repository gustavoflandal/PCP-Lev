package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cliente"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasCliente = `id, tipo, razao_social, nome_fantasia, cnpj, inscricao_estadual,
	contato_nome, contato_email, contato_telefone, endereco, cidade, uf, numero_contrato,
	vigencia_inicio, vigencia_fim, condicao_pagamento, observacoes, ativo, created_at, updated_at`

// ClienteRepositorio implementa cliente.Repositorio sobre PostgreSQL.
type ClienteRepositorio struct {
	pool *pgxpool.Pool
}

// NovoClienteRepositorio cria o repositorio de clientes.
func NovoClienteRepositorio(pool *pgxpool.Pool) *ClienteRepositorio {
	return &ClienteRepositorio{pool: pool}
}

func lerCliente(l linha) (*cliente.Cliente, error) {
	var c cliente.Cliente
	err := l.Scan(&c.ID, &c.Tipo, &c.RazaoSocial, &c.NomeFantasia, &c.CNPJ, &c.InscricaoEstadual,
		&c.ContatoNome, &c.ContatoEmail, &c.ContatoTelefone, &c.Endereco, &c.Cidade, &c.UF, &c.NumeroContrato,
		&c.VigenciaInicio, &c.VigenciaFim, &c.CondicaoPagamento, &c.Observacoes, &c.Ativo, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func erroDeCliente(err error, operacao string) error {
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return cliente.ErrNaoEncontrado
	case violouIndiceUnico(err):
		return cliente.ErrCNPJDuplicado
	}
	return fmt.Errorf("%s: %w", operacao, err)
}

func argumentosCliente(d cliente.Dados) []any {
	return []any{d.Tipo, d.RazaoSocial, d.NomeFantasia, d.CNPJ, d.InscricaoEstadual,
		d.ContatoNome, d.ContatoEmail, d.ContatoTelefone, d.Endereco, d.Cidade, d.UF, d.NumeroContrato,
		d.VigenciaInicio, d.VigenciaFim, d.CondicaoPagamento, d.Observacoes}
}

// Criar grava um cliente.
func (r *ClienteRepositorio) Criar(ctx context.Context, d cliente.Dados, ativo bool, autor string) (*cliente.Cliente, error) {
	args := append(argumentosCliente(d), ativo, autor)
	c, err := lerCliente(db.DoContexto(ctx, r.pool).QueryRow(ctx, `
		INSERT INTO clientes (tipo, razao_social, nome_fantasia, cnpj, inscricao_estadual,
		  contato_nome, contato_email, contato_telefone, endereco, cidade, uf, numero_contrato,
		  vigencia_inicio, vigencia_fim, condicao_pagamento, observacoes, ativo, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18)
		RETURNING `+colunasCliente, args...))
	if err != nil {
		return nil, erroDeCliente(err, "criar cliente")
	}
	return c, nil
}

// Atualizar regrava os campos do cliente.
func (r *ClienteRepositorio) Atualizar(ctx context.Context, id int64, d cliente.Dados, ativo bool, autor string) (*cliente.Cliente, error) {
	args := append([]any{id}, argumentosCliente(d)...)
	args = append(args, ativo, autor)
	c, err := lerCliente(db.DoContexto(ctx, r.pool).QueryRow(ctx, `
		UPDATE clientes SET tipo = $2, razao_social = $3, nome_fantasia = $4, cnpj = $5,
		  inscricao_estadual = $6, contato_nome = $7, contato_email = $8, contato_telefone = $9,
		  endereco = $10, cidade = $11, uf = $12, numero_contrato = $13, vigencia_inicio = $14,
		  vigencia_fim = $15, condicao_pagamento = $16, observacoes = $17, ativo = $18, updated_by = $19
		WHERE id = $1
		RETURNING `+colunasCliente, args...))
	if err != nil {
		return nil, erroDeCliente(err, "atualizar cliente")
	}
	return c, nil
}

// BuscarPorID devolve um cliente.
func (r *ClienteRepositorio) BuscarPorID(ctx context.Context, id int64) (*cliente.Cliente, error) {
	c, err := lerCliente(db.DoContexto(ctx, r.pool).QueryRow(ctx,
		`SELECT `+colunasCliente+` FROM clientes WHERE id = $1`, id))
	if err != nil {
		return nil, erroDeCliente(err, "buscar cliente")
	}
	return c, nil
}

// Listar devolve uma pagina de clientes.
func (r *ClienteRepositorio) Listar(ctx context.Context, params consulta.Parametros, tipo string) ([]cliente.Cliente, int, error) {
	filtros, argumentos := filtrosDeCadastro(params, "razao_social", "nome_fantasia", "cnpj", "cidade", "numero_contrato")
	filtros, argumentos = comIgualdade(filtros, argumentos, "tipo", tipo)

	conexao := db.DoContexto(ctx, r.pool)
	var total int
	if err := conexao.QueryRow(ctx, `SELECT count(*) FROM clientes `+filtros, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar clientes: %w", err)
	}
	sql := fmt.Sprintf("SELECT %s FROM clientes %s ORDER BY %s %s NULLS LAST, id LIMIT $%d OFFSET $%d",
		colunasCliente, filtros, params.OrdenarPor, params.Ordem.SQL(), len(argumentos)+1, len(argumentos)+2)
	linhas, err := conexao.Query(ctx, sql, append(argumentos, params.Limite, params.Offset())...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar clientes: %w", err)
	}
	defer linhas.Close()
	itens := make([]cliente.Cliente, 0, params.Limite)
	for linhas.Next() {
		c, err := lerCliente(linhas)
		if err != nil {
			return nil, 0, err
		}
		itens = append(itens, *c)
	}
	return itens, total, linhas.Err()
}

// Desativar inativa o cliente.
func (r *ClienteRepositorio) Desativar(ctx context.Context, id int64, autor string) error {
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx,
		`UPDATE clientes SET ativo = false, updated_by = $2 WHERE id = $1`, id, autor)
	if err != nil {
		return fmt.Errorf("desativar cliente: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return cliente.ErrNaoEncontrado
	}
	return nil
}
