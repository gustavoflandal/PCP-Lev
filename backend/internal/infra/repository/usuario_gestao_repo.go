package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
	"github.com/jackc/pgx/v5"
)

// Gestao de usuarios (Fase 2.2b): implementa usuario.RepositorioGestao.

// Listar devolve uma pagina de usuarios. FiltroStatus filtra a situacao;
// perfil vazio = todos.
func (r *UsuarioRepositorio) Listar(ctx context.Context, params consulta.Parametros, perfil string) ([]usuario.Usuario, int, error) {
	condicoes := []string{}
	argumentos := []any{}
	if params.FiltroStatus != nil {
		argumentos = append(argumentos, *params.FiltroStatus)
		condicoes = append(condicoes, fmt.Sprintf("situacao = $%d", len(argumentos)))
	}
	if perfil != "" {
		argumentos = append(argumentos, perfil)
		condicoes = append(condicoes, fmt.Sprintf("perfil = $%d", len(argumentos)))
	}
	if params.Busca != "" {
		argumentos = append(argumentos, "%"+strings.ToLower(params.Busca)+"%")
		n := len(argumentos)
		condicoes = append(condicoes, fmt.Sprintf(
			"(lower(nome) LIKE $%d OR lower(username) LIKE $%d OR lower(email) LIKE $%d OR lower(coalesce(matricula, '')) LIKE $%d OR lower(setor) LIKE $%d)",
			n, n, n, n, n))
	}
	where := ""
	if len(condicoes) > 0 {
		where = "WHERE " + strings.Join(condicoes, " AND ")
	}

	conexao := db.DoContexto(ctx, r.pool)
	var total int
	if err := conexao.QueryRow(ctx, `SELECT count(*) FROM usuarios `+where, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar usuarios: %w", err)
	}

	// OrdenarPor vem de usuario.ColunasOrdenaveis (conjunto fechado).
	sql := fmt.Sprintf(`SELECT %s FROM usuarios %s ORDER BY %s %s NULLS LAST, id LIMIT %d OFFSET %d`,
		colunasUsuario, where, params.OrdenarPor, params.Ordem.SQL(), params.Limite, params.Offset())
	linhas, err := conexao.Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar usuarios: %w", err)
	}
	defer linhas.Close()
	itens := []usuario.Usuario{}
	for linhas.Next() {
		u, err := lerUsuario(linhas)
		if err != nil {
			return nil, 0, fmt.Errorf("ler usuario: %w", err)
		}
		itens = append(itens, *u)
	}
	return itens, total, linhas.Err()
}

// errDeEscrita traduz violacoes de indice unico e da FK do perfil.
func errDeEscrita(err error, operacao string) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, pgx.ErrNoRows):
		return usuario.ErrNaoEncontrado
	case violouIndiceUnico(err):
		return usuario.ErrDuplicado
	case violouChaveEstrangeira(err):
		return usuario.ErrPerfilInexistente
	}
	return fmt.Errorf("%s: %w", operacao, err)
}

// Criar grava o usuario com senha temporaria (troca obrigatoria).
func (r *UsuarioRepositorio) Criar(ctx context.Context, d usuario.Dados, senhaHash, autor string) (*usuario.Usuario, error) {
	u, err := lerUsuario(db.DoContexto(ctx, r.pool).QueryRow(ctx, `
		INSERT INTO usuarios (username, nome, email, senha_hash, perfil, matricula, telefone, setor,
		                      data_admissao, deve_trocar_senha, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $10)
		RETURNING `+colunasUsuario,
		d.Username, d.Nome, d.Email, senhaHash, string(d.Perfil), d.Matricula, d.Telefone, d.Setor, d.DataAdmissao, autor))
	if err != nil {
		return nil, errDeEscrita(err, "criar usuario")
	}
	return u, nil
}

// chaveTravaAdmins serializa as escritas de gestao de usuarios
// (pg_advisory_xact_lock): sem ela, dois ADMIN se inativando ao mesmo tempo
// veriam cada um o outro ativo e o sistema ficaria sem Administrador.
const chaveTravaAdmins = 7_204_215

// escritaConferida roda `escrever` numa transacao que: trava as escritas de
// gestao, trava a linha, confere que perfil e situacao ainda sao os lidos
// pelo servico (ErrAlteradoPorOutro) e, se o resultado tirar do ar o ultimo
// ADMIN ativo, recusa (ErrUltimoAdmin).
func (r *UsuarioRepositorio) escritaConferida(ctx context.Context, id int64, esperado usuario.Estado, depois usuario.Estado,
	escrever func(pgx.Tx) error) error {
	tx, err := db.DoContexto(ctx, r.pool).Begin(ctx)
	if err != nil {
		return fmt.Errorf("iniciar transacao: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, chaveTravaAdmins); err != nil {
		return fmt.Errorf("travar gestao de usuarios: %w", err)
	}
	var atual usuario.Estado
	err = tx.QueryRow(ctx, `SELECT perfil, situacao FROM usuarios WHERE id = $1 FOR UPDATE`, id).Scan(&atual.Perfil, &atual.Situacao)
	if errors.Is(err, pgx.ErrNoRows) {
		return usuario.ErrNaoEncontrado
	}
	if err != nil {
		return fmt.Errorf("ler usuario: %w", err)
	}
	if atual != esperado {
		return usuario.ErrAlteradoPorOutro
	}
	adminAtivo := func(e usuario.Estado) bool {
		return e.Perfil == usuario.PerfilAdmin && e.Situacao == usuario.SituacaoAtivo
	}
	if adminAtivo(atual) && !adminAtivo(depois) {
		var outros int
		if err := tx.QueryRow(ctx,
			`SELECT count(*) FROM usuarios WHERE perfil = 'ADMIN' AND situacao = 'ATIVO' AND id <> $1`, id).Scan(&outros); err != nil {
			return fmt.Errorf("contar administradores: %w", err)
		}
		if outros == 0 {
			return usuario.ErrUltimoAdmin
		}
	}
	if err := escrever(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// AtualizarCadastro altera os dados do cadastro (login e situacao nao). Ao
// virar ADMIN, as permissoes individuais sao apagadas: o ADMIN as ignora, e
// elas voltariam a valer, sem nova justificativa, num rebaixamento futuro.
func (r *UsuarioRepositorio) AtualizarCadastro(ctx context.Context, id int64, esperado usuario.Estado, d usuario.Dados, autor string) (*usuario.Usuario, error) {
	var u *usuario.Usuario
	err := r.escritaConferida(ctx, id, esperado, usuario.Estado{Perfil: d.Perfil, Situacao: esperado.Situacao}, func(tx pgx.Tx) error {
		var err error
		u, err = lerUsuario(tx.QueryRow(ctx, `
			UPDATE usuarios SET nome = $2, email = $3, perfil = $4, matricula = $5, telefone = $6,
			       setor = $7, data_admissao = $8, updated_by = $9
			WHERE id = $1
			RETURNING `+colunasUsuario,
			id, d.Nome, d.Email, string(d.Perfil), d.Matricula, d.Telefone, d.Setor, d.DataAdmissao, autor))
		if err != nil {
			return errDeEscrita(err, "atualizar usuario")
		}
		if d.Perfil == usuario.PerfilAdmin && esperado.Perfil != usuario.PerfilAdmin {
			if _, err := tx.Exec(ctx, `DELETE FROM usuario_permissoes WHERE usuario_id = $1`, id); err != nil {
				return fmt.Errorf("apagar permissoes individuais: %w", err)
			}
		}
		return nil
	})
	return u, err
}

// AlterarSituacao grava a situacao. Reativar limpa o desligamento; inativar
// grava a data informada (ou nenhuma); bloquear mantem a que houver.
func (r *UsuarioRepositorio) AlterarSituacao(ctx context.Context, id int64, esperado usuario.Estado, situacao usuario.Situacao, desligamento tempo.Data, autor string) (*usuario.Usuario, error) {
	var u *usuario.Usuario
	err := r.escritaConferida(ctx, id, esperado, usuario.Estado{Perfil: esperado.Perfil, Situacao: situacao}, func(tx pgx.Tx) error {
		var err error
		u, err = lerUsuario(tx.QueryRow(ctx, `
			UPDATE usuarios SET situacao = $2::varchar, updated_by = $4,
			       versao_sessao = versao_sessao + CASE WHEN $2::varchar = 'ATIVO' THEN 0 ELSE 1 END,
			       data_desligamento = CASE $2::varchar WHEN 'ATIVO' THEN NULL WHEN 'INATIVO' THEN $3::date ELSE data_desligamento END
			WHERE id = $1
			RETURNING `+colunasUsuario,
			id, string(situacao), desligamento, autor))
		return errDeEscrita(err, "alterar situacao")
	})
	return u, err
}

// DefinirSenhaTemporaria grava a senha definida pelo Administrador e exige a
// troca no proximo acesso.
func (r *UsuarioRepositorio) DefinirSenhaTemporaria(ctx context.Context, id int64, esperado usuario.Estado, senhaHash, autor string) error {
	return r.escritaConferida(ctx, id, esperado, esperado, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx,
			`UPDATE usuarios SET senha_hash = $2, deve_trocar_senha = TRUE, updated_by = $3,
			        versao_sessao = versao_sessao + 1, tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = $1`,
			id, senhaHash, autor)
		if err != nil {
			return fmt.Errorf("definir senha temporaria: %w", err)
		}
		return nil
	})
}

// ContarAdminsAtivos conta os Administradores ativos, sem contar `exceto`.
func (r *UsuarioRepositorio) ContarAdminsAtivos(ctx context.Context, exceto int64) (int, error) {
	var n int
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx,
		`SELECT count(*) FROM usuarios WHERE perfil = 'ADMIN' AND situacao = 'ATIVO' AND id <> $1`, exceto).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("contar administradores: %w", err)
	}
	return n, nil
}

// PermissoesIndividuais devolve as sobreposicoes do usuario, em ordem de catalogo.
func (r *UsuarioRepositorio) PermissoesIndividuais(ctx context.Context, id int64) ([]usuario.PermissaoIndividual, error) {
	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, `
		SELECT up.permissao_codigo, up.concedida, up.justificativa, up.created_at, up.created_by
		FROM usuario_permissoes up JOIN permissoes p ON p.codigo = up.permissao_codigo
		WHERE up.usuario_id = $1 ORDER BY p.ordem`, id)
	if err != nil {
		return nil, fmt.Errorf("permissoes individuais: %w", err)
	}
	return pgx.CollectRows(linhas, func(l pgx.CollectableRow) (usuario.PermissaoIndividual, error) {
		var p usuario.PermissaoIndividual
		err := l.Scan(&p.Codigo, &p.Concedida, &p.Justificativa, &p.CreatedAt, &p.CreatedBy)
		return p, err
	})
}

// DefinirPermissaoIndividual grava (ou substitui) a sobreposicao.
func (r *UsuarioRepositorio) DefinirPermissaoIndividual(ctx context.Context, id int64, codigo string, concedida bool, justificativa, autor string) error {
	_, err := db.DoContexto(ctx, r.pool).Exec(ctx, `
		INSERT INTO usuario_permissoes (usuario_id, permissao_codigo, concedida, justificativa, created_by)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (usuario_id, permissao_codigo)
		DO UPDATE SET concedida = EXCLUDED.concedida, justificativa = EXCLUDED.justificativa,
		              created_at = CURRENT_TIMESTAMP, created_by = EXCLUDED.created_by`,
		id, codigo, concedida, justificativa, autor)
	if violouChaveEstrangeira(err) {
		return usuario.ErrNaoEncontrado
	}
	if err != nil {
		return fmt.Errorf("definir permissao individual: %w", err)
	}
	return nil
}

// RemoverPermissaoIndividual apaga a sobreposicao.
func (r *UsuarioRepositorio) RemoverPermissaoIndividual(ctx context.Context, id int64, codigo string) error {
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx,
		`DELETE FROM usuario_permissoes WHERE usuario_id = $1 AND permissao_codigo = $2`, id, codigo)
	if err != nil {
		return fmt.Errorf("remover permissao individual: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return usuario.ErrIndividualInexistente
	}
	return nil
}
