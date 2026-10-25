package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/acesso"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AcessoRepositorio implementa a persistencia de perfis e permissoes.
type AcessoRepositorio struct {
	pool *pgxpool.Pool
}

// NovoAcessoRepositorio cria o repositorio de perfis e permissoes.
func NovoAcessoRepositorio(pool *pgxpool.Pool) *AcessoRepositorio {
	return &AcessoRepositorio{pool: pool}
}

// ListarPermissoes devolve o catalogo na ordem de exibicao.
func (r *AcessoRepositorio) ListarPermissoes(ctx context.Context) ([]acesso.Permissao, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx,
		`SELECT codigo, modulo, acao, descricao, sensivel FROM permissoes ORDER BY ordem`)
	if err != nil {
		return nil, fmt.Errorf("listar permissoes: %w", err)
	}
	return pgx.CollectRows(linhas, func(l pgx.CollectableRow) (acesso.Permissao, error) {
		var p acesso.Permissao
		err := l.Scan(&p.Codigo, &p.Modulo, &p.Acao, &p.Descricao, &p.Sensivel)
		return p, err
	})
}

// consultaPerfis traz cada perfil com as permissoes (em ordem de catalogo) e
// quantos usuarios o usam.
const consultaPerfis = `
	SELECT pf.codigo, pf.nome, pf.descricao, pf.sistema,
	       COALESCE(array_agg(pm.codigo ORDER BY pm.ordem) FILTER (WHERE pm.codigo IS NOT NULL), '{}'),
	       (SELECT count(*) FROM usuarios u WHERE u.perfil = pf.codigo)
	FROM perfis pf
	LEFT JOIN perfil_permissoes pp ON pp.perfil_codigo = pf.codigo
	LEFT JOIN permissoes pm ON pm.codigo = pp.permissao_codigo`

func lerPerfil(l pgx.CollectableRow) (acesso.Perfil, error) {
	var p acesso.Perfil
	err := l.Scan(&p.Codigo, &p.Nome, &p.Descricao, &p.Sistema, &p.Permissoes, &p.Usuarios)
	return p, err
}

// ListarPerfis devolve os perfis do sistema primeiro, depois os
// personalizados, por nome.
func (r *AcessoRepositorio) ListarPerfis(ctx context.Context) ([]acesso.Perfil, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx,
		consultaPerfis+` GROUP BY pf.id ORDER BY pf.sistema DESC, pf.id`)
	if err != nil {
		return nil, fmt.Errorf("listar perfis: %w", err)
	}
	return pgx.CollectRows(linhas, lerPerfil)
}

// BuscarPerfil devolve um perfil pelo codigo.
func (r *AcessoRepositorio) BuscarPerfil(ctx context.Context, codigo string) (acesso.Perfil, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx,
		consultaPerfis+` WHERE pf.codigo = $1 GROUP BY pf.id`, codigo)
	if err != nil {
		return acesso.Perfil{}, fmt.Errorf("buscar perfil: %w", err)
	}
	p, err := pgx.CollectExactlyOneRow(linhas, lerPerfil)
	if errors.Is(err, pgx.ErrNoRows) {
		return acesso.Perfil{}, acesso.ErrPerfilNaoEncontrado
	}
	return p, err
}

// PermissoesDoPerfil devolve so os codigos (caminho quente da autorizacao).
func (r *AcessoRepositorio) PermissoesDoPerfil(ctx context.Context, codigo string) ([]string, error) {
	linhas, err := r.pool.Query(ctx,
		`SELECT permissao_codigo FROM perfil_permissoes WHERE perfil_codigo = $1`, codigo)
	if err != nil {
		return nil, fmt.Errorf("permissoes do perfil: %w", err)
	}
	return pgx.CollectRows(linhas, pgx.RowTo[string])
}

// CriarPerfil grava o perfil e as permissoes numa transacao.
func (r *AcessoRepositorio) CriarPerfil(ctx context.Context, codigo string, d acesso.Dados, autor string) (acesso.Perfil, error) {
	err := r.naTransacao(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx,
			`INSERT INTO perfis (codigo, nome, descricao, sistema, created_by, updated_by)
			 VALUES ($1, $2, $3, FALSE, $4, $4)`, codigo, d.Nome, d.Descricao, autor)
		if violouIndiceUnico(err) {
			return acesso.ErrCodigoDuplicado
		}
		if err != nil {
			return fmt.Errorf("criar perfil: %w", err)
		}
		return gravarPermissoes(ctx, tx, codigo, d.Permissoes)
	})
	if err != nil {
		return acesso.Perfil{}, err
	}
	return r.BuscarPerfil(ctx, codigo)
}

// AtualizarPerfil troca nome, descricao e o conjunto inteiro de permissoes.
func (r *AcessoRepositorio) AtualizarPerfil(ctx context.Context, codigo string, d acesso.Dados, autor string) (acesso.Perfil, error) {
	err := r.naTransacao(ctx, func(tx pgx.Tx) error {
		etiqueta, err := tx.Exec(ctx,
			`UPDATE perfis SET nome = $2, descricao = $3, updated_by = $4 WHERE codigo = $1`,
			codigo, d.Nome, d.Descricao, autor)
		if err != nil {
			return fmt.Errorf("atualizar perfil: %w", err)
		}
		if etiqueta.RowsAffected() == 0 {
			return acesso.ErrPerfilNaoEncontrado
		}
		// Diff, e nao "apaga tudo e insere de novo": a trilha de auditoria
		// registra so o que de fato foi concedido ou retirado.
		if _, err := tx.Exec(ctx,
			`DELETE FROM perfil_permissoes WHERE perfil_codigo = $1 AND NOT (permissao_codigo = ANY($2))`,
			codigo, d.Permissoes); err != nil {
			return fmt.Errorf("retirar permissoes: %w", err)
		}
		return gravarPermissoes(ctx, tx, codigo, d.Permissoes)
	})
	if err != nil {
		return acesso.Perfil{}, err
	}
	return r.BuscarPerfil(ctx, codigo)
}

func gravarPermissoes(ctx context.Context, tx pgx.Tx, codigo string, permissoes []string) error {
	if len(permissoes) == 0 {
		return nil
	}
	_, err := tx.Exec(ctx,
		`INSERT INTO perfil_permissoes (perfil_codigo, permissao_codigo)
		 SELECT $1, unnest($2::varchar[]) ON CONFLICT DO NOTHING`, codigo, permissoes)
	if violouChaveEstrangeira(err) {
		return acesso.ErrPermissaoDesconhecida
	}
	if err != nil {
		return fmt.Errorf("conceder permissoes: %w", err)
	}
	return nil
}

// ExcluirPerfil apaga o perfil (as permissoes saem em cascata). A FK de
// usuarios.perfil impede apagar um perfil em uso mesmo numa corrida com a
// conferencia do Servico.
func (r *AcessoRepositorio) ExcluirPerfil(ctx context.Context, codigo string) error {
	_, err := db.DoContexto(ctx, r.pool).Exec(ctx, `DELETE FROM perfis WHERE codigo = $1 AND NOT sistema`, codigo)
	if violouChaveEstrangeira(err) {
		return acesso.ErrPerfilEmUso
	}
	if err != nil {
		return fmt.Errorf("excluir perfil: %w", err)
	}
	return nil
}

func (r *AcessoRepositorio) naTransacao(ctx context.Context, f func(pgx.Tx) error) error {
	tx, err := db.DoContexto(ctx, r.pool).Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := f(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// DadosDeAcesso le perfil, situacao, troca pendente e permissoes individuais
// do usuario numa consulta (caminho quente da autorizacao, com cache acima).
func (r *AcessoRepositorio) DadosDeAcesso(ctx context.Context, usuarioID int64) (acesso.DadosDeAcesso, error) {
	var d acesso.DadosDeAcesso
	err := r.pool.QueryRow(ctx, `
		SELECT u.perfil, u.situacao, u.deve_trocar_senha, u.versao_sessao,
		       COALESCE(array_agg(up.permissao_codigo) FILTER (WHERE up.concedida), '{}'),
		       COALESCE(array_agg(up.permissao_codigo) FILTER (WHERE NOT up.concedida), '{}')
		FROM usuarios u
		LEFT JOIN usuario_permissoes up ON up.usuario_id = u.id
		WHERE u.id = $1
		GROUP BY u.id`, usuarioID).Scan(&d.Perfil, &d.Situacao, &d.DeveTrocarSenha, &d.VersaoSessao, &d.Concedidas, &d.Retiradas)
	if errors.Is(err, pgx.ErrNoRows) {
		return acesso.DadosDeAcesso{}, acesso.ErrUsuarioNaoEncontrado
	}
	if err != nil {
		return acesso.DadosDeAcesso{}, fmt.Errorf("dados de acesso do usuario: %w", err)
	}
	return d, nil
}
