// Package repository implementa as portas de persistencia do dominio sobre
// PostgreSQL, usando pgx.
package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasUsuario = `id, username, nome, email, senha_hash, perfil, ativo,
	ultimo_login, created_at, updated_at`

// UsuarioRepositorio implementa usuario.Repositorio.
type UsuarioRepositorio struct {
	pool *pgxpool.Pool
}

// NovoUsuarioRepositorio cria o repositorio de usuarios.
func NovoUsuarioRepositorio(pool *pgxpool.Pool) *UsuarioRepositorio {
	return &UsuarioRepositorio{pool: pool}
}

// BuscarPorUsername localiza o usuario ignorando a caixa do login digitado.
func (r *UsuarioRepositorio) BuscarPorUsername(ctx context.Context, username string) (*usuario.Usuario, error) {
	sql := `SELECT ` + colunasUsuario + ` FROM usuarios WHERE lower(username) = lower($1)`
	return r.buscarUm(ctx, sql, strings.TrimSpace(username))
}

// BuscarPorID localiza o usuario pela chave primaria.
func (r *UsuarioRepositorio) BuscarPorID(ctx context.Context, id int64) (*usuario.Usuario, error) {
	sql := `SELECT ` + colunasUsuario + ` FROM usuarios WHERE id = $1`
	return r.buscarUm(ctx, sql, id)
}

// RegistrarLogin grava o instante do acesso bem-sucedido.
func (r *UsuarioRepositorio) RegistrarLogin(ctx context.Context, id int64) error {
	etiqueta, err := r.pool.Exec(ctx,
		`UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("registrar login: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return usuario.ErrNaoEncontrado
	}
	return nil
}

// AtualizarSenha grava o novo hash da senha do usuario.
func (r *UsuarioRepositorio) AtualizarSenha(ctx context.Context, id int64, senhaHash, autor string) error {
	etiqueta, err := r.pool.Exec(ctx,
		`UPDATE usuarios SET senha_hash = $2, updated_by = $3 WHERE id = $1`, id, senhaHash, autor)
	if err != nil {
		return fmt.Errorf("atualizar senha: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return usuario.ErrNaoEncontrado
	}
	return nil
}

func (r *UsuarioRepositorio) buscarUm(ctx context.Context, sql string, arg any) (*usuario.Usuario, error) {
	var u usuario.Usuario
	err := r.pool.QueryRow(ctx, sql, arg).Scan(
		&u.ID, &u.Username, &u.Nome, &u.Email, &u.SenhaHash, &u.Perfil,
		&u.Ativo, &u.UltimoLogin, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, usuario.ErrNaoEncontrado
		}
		return nil, fmt.Errorf("buscar usuario: %w", err)
	}
	return &u, nil
}
