package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasProduto = `id, codigo, descricao, unidade_medida, preco_venda,
	lead_time_producao, ativo, created_at, updated_at, created_by, updated_by`

// ProdutoRepositorio implementa produto.Repositorio sobre PostgreSQL.
type ProdutoRepositorio struct {
	pool *pgxpool.Pool
}

// NovoProdutoRepositorio cria o repositorio de produtos acabados.
func NovoProdutoRepositorio(pool *pgxpool.Pool) *ProdutoRepositorio {
	return &ProdutoRepositorio{pool: pool}
}

func (r *ProdutoRepositorio) Criar(ctx context.Context, p *produto.ProdutoAcabado, autor string) error {
	sql := `INSERT INTO produtos_acabados
		(codigo, descricao, unidade_medida, preco_venda, lead_time_producao, ativo, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
		RETURNING id, created_at, updated_at`

	err := r.pool.QueryRow(ctx, sql,
		p.Codigo, p.Descricao, p.UnidadeMedida, p.PrecoVenda, p.LeadTimeProducao, p.Ativo, autor,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		if violouIndiceUnico(err) {
			return produto.ErrCodigoDuplicado
		}
		return fmt.Errorf("criar produto acabado: %w", err)
	}
	p.CreatedBy, p.UpdatedBy = &autor, &autor
	return nil
}

func (r *ProdutoRepositorio) Atualizar(ctx context.Context, p *produto.ProdutoAcabado, autor string) error {
	sql := `UPDATE produtos_acabados
		SET codigo = $2, descricao = $3, unidade_medida = $4, preco_venda = $5,
		    lead_time_producao = $6, ativo = $7, updated_by = $8
		WHERE id = $1
		RETURNING updated_at`

	err := r.pool.QueryRow(ctx, sql,
		p.ID, p.Codigo, p.Descricao, p.UnidadeMedida, p.PrecoVenda, p.LeadTimeProducao, p.Ativo, autor,
	).Scan(&p.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return produto.ErrNaoEncontrado
		}
		if violouIndiceUnico(err) {
			return produto.ErrCodigoDuplicado
		}
		return fmt.Errorf("atualizar produto acabado: %w", err)
	}
	p.UpdatedBy = &autor
	return nil
}

func (r *ProdutoRepositorio) BuscarPorID(ctx context.Context, id int64) (*produto.ProdutoAcabado, error) {
	sql := `SELECT ` + colunasProduto + ` FROM produtos_acabados WHERE id = $1`

	var p produto.ProdutoAcabado
	err := r.pool.QueryRow(ctx, sql, id).Scan(
		&p.ID, &p.Codigo, &p.Descricao, &p.UnidadeMedida, &p.PrecoVenda,
		&p.LeadTimeProducao, &p.Ativo, &p.CreatedAt, &p.UpdatedAt, &p.CreatedBy, &p.UpdatedBy,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, produto.ErrNaoEncontrado
		}
		return nil, fmt.Errorf("buscar produto acabado: %w", err)
	}
	return &p, nil
}

// Listar devolve a pagina de produtos, com a estrutura ativa de cada um (se
// houver). O filtro (filtrosDeCadastro) roda dentro do CTE `pa`, so contra
// produtos_acabados -- o LEFT JOIN com estrutura_produto (que tambem tem uma
// coluna "ativo") so acontece depois, sobre o resultado ja filtrado. Sem
// isso, informar filtro_ativo deixaria "ativo" ambiguo entre as duas
// tabelas assim que o JOIN entrasse (mesma armadilha corrigida no Sprint 4,
// Task B2, em ListarMovimentacoes).
func (r *ProdutoRepositorio) Listar(ctx context.Context, params consulta.Parametros) ([]produto.ProdutoAcabado, int, error) {
	filtros, argumentos := filtrosDeCadastro(params, "codigo", "descricao")

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT count(*) FROM produtos_acabados `+filtros, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar produtos acabados: %w", err)
	}

	// OrdenarPor ja foi validado contra uma lista fechada em consulta.Analisar,
	// entao pode ser interpolado; os valores seguem como parametros.
	sql := fmt.Sprintf(`
		WITH pa AS (SELECT %s FROM produtos_acabados %s)
		SELECT pa.id, pa.codigo, pa.descricao, pa.unidade_medida, pa.preco_venda,
		       pa.lead_time_producao, pa.ativo, pa.created_at, pa.updated_at, pa.created_by, pa.updated_by,
		       ep.versao, ep.data_vigencia_inicio
		FROM pa LEFT JOIN estrutura_produto ep ON ep.produto_acabado_id = pa.id AND ep.ativo
		ORDER BY pa.%s %s LIMIT $%d OFFSET $%d`,
		colunasProduto, filtros, params.OrdenarPor, params.Ordem.SQL(),
		len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, params.Limite, params.Offset())

	linhas, err := r.pool.Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar produtos acabados: %w", err)
	}
	defer linhas.Close()

	itens := make([]produto.ProdutoAcabado, 0, params.Limite)
	for linhas.Next() {
		var p produto.ProdutoAcabado
		var versao *int
		var vigenciaInicio tempo.Data
		if err := linhas.Scan(
			&p.ID, &p.Codigo, &p.Descricao, &p.UnidadeMedida, &p.PrecoVenda,
			&p.LeadTimeProducao, &p.Ativo, &p.CreatedAt, &p.UpdatedAt, &p.CreatedBy, &p.UpdatedBy,
			&versao, &vigenciaInicio,
		); err != nil {
			return nil, 0, err
		}
		if versao != nil {
			p.EstruturaAtiva = &produto.EstruturaResumo{Versao: *versao, DataVigenciaInicio: vigenciaInicio}
		}
		itens = append(itens, p)
	}
	return itens, total, linhas.Err()
}

func (r *ProdutoRepositorio) Desativar(ctx context.Context, id int64, autor string) error {
	etiqueta, err := r.pool.Exec(ctx,
		`UPDATE produtos_acabados SET ativo = false, updated_by = $2 WHERE id = $1`, id, autor)
	if err != nil {
		return fmt.Errorf("desativar produto acabado: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return produto.ErrNaoEncontrado
	}
	return nil
}

func (r *ProdutoRepositorio) PossuiVendas(ctx context.Context, id int64) (bool, error) {
	var existe bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM itens_pedido_venda WHERE produto_acabado_id = $1)`, id).Scan(&existe)
	if err != nil {
		return false, fmt.Errorf("verificar vendas do produto: %w", err)
	}
	return existe, nil
}
