package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
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
	tx, err := db.DoContexto(ctx, r.pool).Begin(ctx)
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
			if violouIndiceUnico(err, "uk_estrutura_pp") {
				return estrutura.ErrItemDuplicado
			}
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
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, `SELECT `+colunasEstrutura+` FROM estrutura_produto WHERE id = $1`, id).Scan(
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
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx,
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
// recente para a mais antiga — sem paginacao, lista curta por natureza. Os
// itens de cada versao sao carregados numa segunda query, agrupados em lote
// (evita N+1) -- sem isso o `itens` some do JSON (omitempty) e a tela de
// detalhe quebra ao tentar renderizar os itens da versao ativa.
func (r *EstruturaRepositorio) ListarPorProduto(ctx context.Context, produtoAcabadoID int64) ([]estrutura.Estrutura, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx,
		`SELECT `+colunasEstrutura+` FROM estrutura_produto WHERE produto_acabado_id = $1 ORDER BY versao DESC`,
		produtoAcabadoID)
	if err != nil {
		return nil, fmt.Errorf("listar estruturas do produto: %w", err)
	}
	defer linhas.Close()

	historico := make([]estrutura.Estrutura, 0)
	ids := make([]int64, 0)
	for linhas.Next() {
		var e estrutura.Estrutura
		if err := linhas.Scan(
			&e.ID, &e.ProdutoAcabadoID, &e.Versao, &e.DataVigenciaInicio, &e.DataVigenciaFim,
			&e.Ativo, &e.CreatedAt, &e.UpdatedAt, &e.CreatedBy, &e.UpdatedBy,
		); err != nil {
			return nil, err
		}
		historico = append(historico, e)
		ids = append(ids, e.ID)
	}
	if err := linhas.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return historico, nil
	}

	itensPorEstrutura, err := r.itensDeVariasEstruturas(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range historico {
		historico[i].Itens = itensPorEstrutura[historico[i].ID]
	}
	return historico, nil
}

// itensDeVariasEstruturas carrega os itens de varias estruturas numa unica
// query (batching), agrupados por estrutura_produto_id.
func (r *EstruturaRepositorio) itensDeVariasEstruturas(ctx context.Context, estruturaIDs []int64) (map[int64][]estrutura.Item, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx,
		`SELECT estrutura_produto_id, `+colunasItemEstrutura+`
		 FROM itens_estrutura_produto WHERE estrutura_produto_id = ANY($1) ORDER BY estrutura_produto_id, id`,
		estruturaIDs)
	if err != nil {
		return nil, fmt.Errorf("buscar itens das estruturas: %w", err)
	}
	defer linhas.Close()

	porEstrutura := make(map[int64][]estrutura.Item, len(estruturaIDs))
	for linhas.Next() {
		var estruturaID int64
		var item estrutura.Item
		if err := linhas.Scan(&estruturaID, &item.ID, &item.PartePecaID, &item.Quantidade); err != nil {
			return nil, err
		}
		porEstrutura[estruturaID] = append(porEstrutura[estruturaID], item)
	}
	return porEstrutura, linhas.Err()
}

// inativarVigente tira a vigencia da versao ativa do produto (se houver),
// encerrando-a no dia anterior a novoInicio -- ou no proprio inicio dela, se
// a nova comecar antes (o CHECK chk_vigencia nao admite fim < inicio). Roda
// antes de ativar a outra: o indice uk_estrutura_ativa_por_pa so admite uma.
func inativarVigente(ctx context.Context, tx pgx.Tx, produtoID int64, novoInicio tempo.Data, autor string) error {
	_, err := tx.Exec(ctx,
		`UPDATE estrutura_produto
		 SET ativo = false, data_vigencia_fim = GREATEST(data_vigencia_inicio, $2::date - 1), updated_by = $3
		 WHERE produto_acabado_id = $1 AND ativo`,
		produtoID, novoInicio, autor)
	if err != nil {
		return fmt.Errorf("inativar estrutura vigente: %w", err)
	}
	return nil
}

// Versionar grava a nova versao como a vigente: apura a proxima versao,
// inativa a que estava ativa e insere a nova, tudo numa transacao. Duas
// chamadas concorrentes para o mesmo produto: a segunda espera a primeira
// commitar (o UPDATE trava a linha ativa) e entao inativa a recem-criada.
func (r *EstruturaRepositorio) Versionar(
	ctx context.Context, nova *estrutura.Estrutura, autor string,
) (*estrutura.Estrutura, error) {
	tx, err := db.DoContexto(ctx, r.pool).Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var maxVersao int
	if err := tx.QueryRow(ctx,
		`SELECT coalesce(max(versao), 0) FROM estrutura_produto WHERE produto_acabado_id = $1`, nova.ProdutoAcabadoID,
	).Scan(&maxVersao); err != nil {
		return nil, fmt.Errorf("apurar versao atual: %w", err)
	}
	nova.Versao = maxVersao + 1

	if err := inativarVigente(ctx, tx, nova.ProdutoAcabadoID, nova.DataVigenciaInicio, autor); err != nil {
		return nil, err
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
			if violouIndiceUnico(err, "uk_estrutura_pp") {
				return nil, estrutura.ErrItemDuplicado
			}
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

// Ativar torna vigente a versao id, qualquer que seja o seu historico: a
// vigente atual e encerrada hoje e a escolhida reabre (fim = NULL).
func (r *EstruturaRepositorio) Ativar(ctx context.Context, id int64, autor string) (*estrutura.Estrutura, error) {
	tx, err := db.DoContexto(ctx, r.pool).Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var produtoID int64
	var ativa bool
	err = tx.QueryRow(ctx,
		`SELECT produto_acabado_id, ativo FROM estrutura_produto WHERE id = $1 FOR UPDATE`, id,
	).Scan(&produtoID, &ativa)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, estrutura.ErrNaoEncontrado
		}
		return nil, fmt.Errorf("buscar estrutura a ativar: %w", err)
	}

	if !ativa {
		if err := inativarVigente(ctx, tx, produtoID, tempo.Data{Time: time.Now()}, autor); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx,
			`UPDATE estrutura_produto SET ativo = true, data_vigencia_fim = NULL, updated_by = $2 WHERE id = $1`,
			id, autor); err != nil {
			return nil, fmt.Errorf("ativar estrutura: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("confirmar ativacao: %w", err)
	}
	return r.BuscarPorID(ctx, id)
}
