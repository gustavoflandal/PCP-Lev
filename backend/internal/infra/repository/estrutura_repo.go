package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasEstrutura = `id, produto_acabado_id, versao, data_vigencia_inicio,
	data_vigencia_fim, ativo, created_at, updated_at, created_by, updated_by`

const colunasItemEstrutura = `id, parte_peca_id, quantidade`

// EstruturaRepositorio implementa estrutura.Repositorio sobre PostgreSQL.
type EstruturaRepositorio struct {
	pool *pgxpool.Pool
}

// NovoEstruturaRepositorio cria o repositorio de estrutura de produto.
func NovoEstruturaRepositorio(pool *pgxpool.Pool) *EstruturaRepositorio {
	return &EstruturaRepositorio{pool: pool}
}

// Criar grava a estrutura e os seus itens na mesma transacao.
func (r *EstruturaRepositorio) Criar(ctx context.Context, e *estrutura.Estrutura, autor string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	sql := `INSERT INTO estrutura_produto
		(produto_acabado_id, versao, data_vigencia_inicio, data_vigencia_fim, ativo, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
		RETURNING id, created_at, updated_at`

	err = tx.QueryRow(ctx, sql,
		e.ProdutoAcabadoID, e.Versao, e.DataVigenciaInicio, e.DataVigenciaFim, e.Ativo, autor,
	).Scan(&e.ID, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		// Criar sempre grava versao=1: uma segunda chamada para o mesmo
		// produto colide tanto com uk_estrutura_ativa_por_pa (indice parcial,
		// so quando ha uma ativa) quanto com uk_pa_versao (versao=1
		// duplicada) -- o Postgres pode reportar qualquer um dos dois,
		// dependendo da ordem de avaliacao dos indices. Os dois significam a
		// mesma coisa aqui: use Versionar, nao Criar, de novo.
		if violouIndiceUnico(err, "uk_estrutura_ativa_por_pa", "uk_pa_versao") {
			return estrutura.ErrJaPossuiEstruturaAtiva
		}
		if violouChaveEstrangeira(err) {
			return estrutura.ErrProdutoAcabadoInexistente
		}
		return fmt.Errorf("criar estrutura de produto: %w", err)
	}

	for i, item := range e.Itens {
		err := tx.QueryRow(ctx,
			`INSERT INTO itens_estrutura_produto (estrutura_produto_id, parte_peca_id, quantidade)
			 VALUES ($1, $2, $3) RETURNING id`,
			e.ID, item.PartePecaID, item.Quantidade,
		).Scan(&e.Itens[i].ID)
		if err != nil {
			if violouChaveEstrangeira(err) {
				return estrutura.ErrPartePecaInexistente
			}
			return fmt.Errorf("criar item da estrutura: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("confirmar criacao da estrutura: %w", err)
	}
	e.CreatedBy, e.UpdatedBy = &autor, &autor
	return nil
}

// BuscarPorID devolve a estrutura com os seus itens.
func (r *EstruturaRepositorio) BuscarPorID(ctx context.Context, id int64) (*estrutura.Estrutura, error) {
	var e estrutura.Estrutura
	err := r.pool.QueryRow(ctx, `SELECT `+colunasEstrutura+` FROM estrutura_produto WHERE id = $1`, id).Scan(
		&e.ID, &e.ProdutoAcabadoID, &e.Versao, &e.DataVigenciaInicio, &e.DataVigenciaFim,
		&e.Ativo, &e.CreatedAt, &e.UpdatedAt, &e.CreatedBy, &e.UpdatedBy,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, estrutura.ErrNaoEncontrado
		}
		return nil, fmt.Errorf("buscar estrutura de produto: %w", err)
	}
	itens, err := r.itensDaEstrutura(ctx, id)
	if err != nil {
		return nil, err
	}
	e.Itens = itens
	return &e, nil
}

func (r *EstruturaRepositorio) itensDaEstrutura(ctx context.Context, estruturaID int64) ([]estrutura.Item, error) {
	linhas, err := r.pool.Query(ctx,
		`SELECT `+colunasItemEstrutura+` FROM itens_estrutura_produto WHERE estrutura_produto_id = $1 ORDER BY id`,
		estruturaID)
	if err != nil {
		return nil, fmt.Errorf("buscar itens da estrutura: %w", err)
	}
	defer linhas.Close()

	itens := make([]estrutura.Item, 0)
	for linhas.Next() {
		var item estrutura.Item
		if err := linhas.Scan(&item.ID, &item.PartePecaID, &item.Quantidade); err != nil {
			return nil, err
		}
		itens = append(itens, item)
	}
	return itens, linhas.Err()
}

// ListarPorProduto devolve o historico completo (todas as versoes), da mais
// recente para a mais antiga — sem paginacao, lista curta por natureza.
func (r *EstruturaRepositorio) ListarPorProduto(ctx context.Context, produtoAcabadoID int64) ([]estrutura.Estrutura, error) {
	linhas, err := r.pool.Query(ctx,
		`SELECT `+colunasEstrutura+` FROM estrutura_produto WHERE produto_acabado_id = $1 ORDER BY versao DESC`,
		produtoAcabadoID)
	if err != nil {
		return nil, fmt.Errorf("listar estruturas do produto: %w", err)
	}
	defer linhas.Close()

	itens := make([]estrutura.Estrutura, 0)
	for linhas.Next() {
		var e estrutura.Estrutura
		if err := linhas.Scan(
			&e.ID, &e.ProdutoAcabadoID, &e.Versao, &e.DataVigenciaInicio, &e.DataVigenciaFim,
			&e.Ativo, &e.CreatedAt, &e.UpdatedAt, &e.CreatedBy, &e.UpdatedBy,
		); err != nil {
			return nil, err
		}
		itens = append(itens, e)
	}
	return itens, linhas.Err()
}

// Versionar substitui a estrutura ativa em idAtual: apura a proxima versao,
// inativa a antiga (so se ainda estiver ativa — o UPDATE com "AND ativo" e
// quem trava a linha; uma segunda chamada concorrente para o mesmo idAtual
// bloqueia ate a primeira commitar, depois nao afeta nenhuma linha) e grava
// a nova, tudo numa transacao.
func (r *EstruturaRepositorio) Versionar(
	ctx context.Context, idAtual int64, nova *estrutura.Estrutura, autor string,
) (*estrutura.Estrutura, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var maxVersao int
	if err := tx.QueryRow(ctx,
		`SELECT max(versao) FROM estrutura_produto WHERE produto_acabado_id = $1`, nova.ProdutoAcabadoID,
	).Scan(&maxVersao); err != nil {
		return nil, fmt.Errorf("apurar versao atual: %w", err)
	}
	nova.Versao = maxVersao + 1

	fimDaAntiga := tempo.Data{Time: nova.DataVigenciaInicio.Time.AddDate(0, 0, -1)}
	etiqueta, err := tx.Exec(ctx,
		`UPDATE estrutura_produto SET ativo = false, data_vigencia_fim = $2, updated_by = $3 WHERE id = $1 AND ativo`,
		idAtual, fimDaAntiga, autor)
	if err != nil {
		return nil, fmt.Errorf("inativar estrutura anterior: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return nil, estrutura.ErrStatusInvalidoParaAcao
	}

	sql := `INSERT INTO estrutura_produto
		(produto_acabado_id, versao, data_vigencia_inicio, data_vigencia_fim, ativo, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
		RETURNING id, created_at, updated_at`
	err = tx.QueryRow(ctx, sql,
		nova.ProdutoAcabadoID, nova.Versao, nova.DataVigenciaInicio, nova.DataVigenciaFim, nova.Ativo, autor,
	).Scan(&nova.ID, &nova.CreatedAt, &nova.UpdatedAt)
	if err != nil {
		if violouChaveEstrangeira(err) {
			return nil, estrutura.ErrProdutoAcabadoInexistente
		}
		return nil, fmt.Errorf("criar nova versao da estrutura: %w", err)
	}

	for i, item := range nova.Itens {
		err := tx.QueryRow(ctx,
			`INSERT INTO itens_estrutura_produto (estrutura_produto_id, parte_peca_id, quantidade)
			 VALUES ($1, $2, $3) RETURNING id`,
			nova.ID, item.PartePecaID, item.Quantidade,
		).Scan(&nova.Itens[i].ID)
		if err != nil {
			if violouChaveEstrangeira(err) {
				return nil, estrutura.ErrPartePecaInexistente
			}
			return nil, fmt.Errorf("criar item da nova versao: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("confirmar versionamento: %w", err)
	}
	nova.CreatedBy, nova.UpdatedBy = &autor, &autor
	return nova, nil
}
