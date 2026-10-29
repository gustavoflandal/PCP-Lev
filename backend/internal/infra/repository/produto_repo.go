package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasProduto = `id, codigo, descricao, unidade_medida, preco_venda,
	lead_time_producao, ativo, created_at, updated_at, created_by, updated_by, exige_metrologia,
	controla_numero_serie, controla_lote, controla_validade, item_critico, exige_certificado, pode_ser_componente`

// ProdutoRepositorio implementa produto.Repositorio sobre PostgreSQL.
type ProdutoRepositorio struct {
	pool *pgxpool.Pool
}

// NovoProdutoRepositorio cria o repositorio de produtos acabados.
func NovoProdutoRepositorio(pool *pgxpool.Pool) *ProdutoRepositorio {
	return &ProdutoRepositorio{pool: pool}
}

func (r *ProdutoRepositorio) Criar(ctx context.Context, p *produto.ProdutoAcabado, autor string) error {
	tx, err := db.DoContexto(ctx, r.pool).Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	sqlPA := `INSERT INTO produtos_acabados
		(codigo, descricao, unidade_medida, preco_venda, lead_time_producao, ativo, created_by, updated_by,
		 exige_metrologia, pode_ser_componente,
		 controla_numero_serie, controla_lote, controla_validade, item_critico, exige_certificado)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, created_at, updated_at`

	err = tx.QueryRow(ctx, sqlPA,
		p.Codigo, p.Descricao, p.UnidadeMedida, p.PrecoVenda, p.LeadTimeProducao, p.Ativo, autor,
		p.ExigeMetrologia, p.PodeSerComponente,
		p.ControlaNumeroSerie, p.ControlaLote, p.ControlaValidade, p.ItemCritico, p.ExigeCertificado,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if violouIndiceUnico(err) {
			return produto.ErrCodigoDuplicado
		}
		return fmt.Errorf("criar produto acabado: %w", err)
	}
	p.CreatedBy, p.UpdatedBy = &autor, &autor

	if p.PodeSerComponente {
		if err := criarEspelhoTx(ctx, tx, p.ID, p.Codigo, p.Descricao, p.UnidadeMedida, autor); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *ProdutoRepositorio) Atualizar(ctx context.Context, p *produto.ProdutoAcabado, autor string) error {
	sql := `UPDATE produtos_acabados
		SET codigo = $2, descricao = $3, unidade_medida = $4, preco_venda = $5,
		    lead_time_producao = $6, ativo = $7, updated_by = $8, exige_metrologia = $9,
		    pode_ser_componente = $10,
		    controla_numero_serie = $11, controla_lote = $12, controla_validade = $13, item_critico = $14,
		    exige_certificado = $15
		WHERE id = $1
		RETURNING updated_at`

	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, sql,
		p.ID, p.Codigo, p.Descricao, p.UnidadeMedida, p.PrecoVenda, p.LeadTimeProducao, p.Ativo, autor, p.ExigeMetrologia,
		p.PodeSerComponente,
		p.ControlaNumeroSerie, p.ControlaLote, p.ControlaValidade, p.ItemCritico, p.ExigeCertificado,
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
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, sql, id).Scan(
		&p.ID, &p.Codigo, &p.Descricao, &p.UnidadeMedida, &p.PrecoVenda,
		&p.LeadTimeProducao, &p.Ativo, &p.CreatedAt, &p.UpdatedAt, &p.CreatedBy, &p.UpdatedBy, &p.ExigeMetrologia,
		&p.ControlaNumeroSerie, &p.ControlaLote, &p.ControlaValidade, &p.ItemCritico, &p.ExigeCertificado, &p.PodeSerComponente,
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
	if err := db.DoContexto(ctx, r.pool).QueryRow(ctx,
		`SELECT count(*) FROM produtos_acabados `+filtros, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar produtos acabados: %w", err)
	}

	// OrdenarPor ja foi validado contra uma lista fechada em consulta.Analisar,
	// entao pode ser interpolado; os valores seguem como parametros.
	sql := fmt.Sprintf(`
		WITH pa AS (SELECT %s FROM produtos_acabados %s)
		SELECT pa.id, pa.codigo, pa.descricao, pa.unidade_medida, pa.preco_venda,
		       pa.lead_time_producao, pa.ativo, pa.created_at, pa.updated_at, pa.created_by, pa.updated_by,
		       pa.exige_metrologia, pa.controla_numero_serie, pa.controla_lote, pa.controla_validade,
		       pa.item_critico, pa.exige_certificado, pa.pode_ser_componente, ep.versao, ep.data_vigencia_inicio
		FROM pa LEFT JOIN estrutura_produto ep ON ep.produto_acabado_id = pa.id AND ep.ativo
		ORDER BY pa.%s %s LIMIT $%d OFFSET $%d`,
		colunasProduto, filtros, params.OrdenarPor, params.Ordem.SQL(),
		len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, params.Limite, params.Offset())

	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, sql, argumentos...)
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
			&p.ExigeMetrologia, &p.ControlaNumeroSerie, &p.ControlaLote, &p.ControlaValidade, &p.ItemCritico, &p.ExigeCertificado,
			&p.PodeSerComponente, &versao, &vigenciaInicio,
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
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx,
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
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM itens_pedido_venda WHERE produto_acabado_id = $1)`, id).Scan(&existe)
	if err != nil {
		return false, fmt.Errorf("verificar vendas do produto: %w", err)
	}
	return existe, nil
}

// ---------------------------------------------------------------------------
// Gestão do registro espelho em partes_pecas
// ---------------------------------------------------------------------------

func (r *ProdutoRepositorio) CriarOuReativarEspelho(ctx context.Context, p *produto.ProdutoAcabado, autor string) error {
	// Verifica se já existe um espelho (possivelmente inativo) para este produto.
	var pecaID int64
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx,
		`SELECT id FROM partes_pecas WHERE produto_acabado_id = $1`, p.ID).Scan(&pecaID)

	if err == nil {
		// Espelho existe — reativa e sincroniza campos básicos.
		_, err = db.DoContexto(ctx, r.pool).Exec(ctx,
			`UPDATE partes_pecas
			 SET codigo = $2, descricao = $3, unidade_medida = $4, ativo = true, updated_by = $5
			 WHERE id = $1`,
			pecaID, p.Codigo, p.Descricao, p.UnidadeMedida, autor)
		if err != nil {
			if violouIndiceUnico(err) {
				return produto.ErrCodigoEspelhoDuplicado
			}
			return fmt.Errorf("reativar espelho: %w", err)
		}
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("verificar espelho existente: %w", err)
	}

	// Espelho não existe — cria dentro de uma transação (peca + saldo).
	tx, err := db.DoContexto(ctx, r.pool).Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar transacao espelho: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := criarEspelhoTx(ctx, tx, p.ID, p.Codigo, p.Descricao, p.UnidadeMedida, autor); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *ProdutoRepositorio) SincronizarEspelho(ctx context.Context, p *produto.ProdutoAcabado, autor string) error {
	_, err := db.DoContexto(ctx, r.pool).Exec(ctx,
		`UPDATE partes_pecas
		 SET codigo = $2, descricao = $3, unidade_medida = $4, updated_by = $5
		 WHERE produto_acabado_id = $1`,
		p.ID, p.Codigo, p.Descricao, p.UnidadeMedida, autor)
	if err != nil {
		if violouIndiceUnico(err) {
			return produto.ErrCodigoEspelhoDuplicado
		}
		return fmt.Errorf("sincronizar espelho: %w", err)
	}
	return nil
}

func (r *ProdutoRepositorio) DesativarEspelho(ctx context.Context, produtoID int64, autor string) error {
	_, err := db.DoContexto(ctx, r.pool).Exec(ctx,
		`UPDATE partes_pecas SET ativo = false, updated_by = $2 WHERE produto_acabado_id = $1`,
		produtoID, autor)
	if err != nil {
		return fmt.Errorf("desativar espelho: %w", err)
	}
	return nil
}

func (r *ProdutoRepositorio) EspelhoEmUsoBOM(ctx context.Context, produtoID int64) (bool, error) {
	var emUso bool
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM itens_estrutura_produto iep
			JOIN estrutura_produto ep ON ep.id = iep.estrutura_produto_id
			JOIN partes_pecas pp ON pp.id = iep.parte_peca_id
			WHERE pp.produto_acabado_id = $1 AND ep.ativo
		)`, produtoID).Scan(&emUso)
	if err != nil {
		return false, fmt.Errorf("verificar espelho em bom: %w", err)
	}
	return emUso, nil
}

// criarEspelhoTx insere a parte/peca espelho e a sua linha de saldo_estoque
// dentro de uma transacao já aberta.
func criarEspelhoTx(ctx context.Context, tx pgx.Tx, produtoID int64, codigo, descricao, unidade, autor string) error {
	var pecaID int64
	err := tx.QueryRow(ctx, `
		INSERT INTO partes_pecas
			(codigo, descricao, unidade_medida, estoque_minimo, estoque_maximo,
			 lead_time_compra, ativo, created_by, updated_by, produto_acabado_id,
			 controla_numero_serie, controla_lote, controla_validade, item_critico, exige_certificado,
			 validade_minima_dias, mascara_serie)
		VALUES ($1, $2, $3, 0, 9999, 1, true, $4, $4, $5, false, false, false, false, false, 0, '')
		RETURNING id`,
		codigo, descricao, unidade, autor, produtoID,
	).Scan(&pecaID)
	if err != nil {
		if violouIndiceUnico(err) {
			return produto.ErrCodigoEspelhoDuplicado
		}
		return fmt.Errorf("criar parte/peca espelho: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO saldo_estoque (parte_peca_id, quantidade_atual, quantidade_reservada, status, updated_by)
		 VALUES ($1, 0, 0, 'CRITICO', $2)`, pecaID, autor); err != nil {
		return fmt.Errorf("abrir saldo espelho: %w", err)
	}
	return nil
}
