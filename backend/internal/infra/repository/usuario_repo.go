// Package repository implementa as portas de persistencia do dominio sobre
// PostgreSQL, usando pgx.
package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/usuario"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasUsuario = `id, username, nome, email, senha_hash, perfil, ativo,
	ultimo_login, created_at, updated_at, tema, alto_contraste, densidade, tamanho_fonte`

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
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx,
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
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx,
		`UPDATE usuarios SET senha_hash = $2, updated_by = $3 WHERE id = $1`, id, senhaHash, autor)
	if err != nil {
		return fmt.Errorf("atualizar senha: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return usuario.ErrNaoEncontrado
	}
	return nil
}

// AtualizarPreferencias grava as preferencias de aparencia do usuario.
func (r *UsuarioRepositorio) AtualizarPreferencias(ctx context.Context, id int64, p usuario.Preferencias) error {
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx,
		`UPDATE usuarios SET tema = $2, alto_contraste = $3, densidade = $4, tamanho_fonte = $5 WHERE id = $1`,
		id, p.Tema, p.AltoContraste, p.Densidade, p.TamanhoFonte)
	if err != nil {
		return fmt.Errorf("atualizar preferencias: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return usuario.ErrNaoEncontrado
	}
	return nil
}

func (r *UsuarioRepositorio) buscarUm(ctx context.Context, sql string, arg any) (*usuario.Usuario, error) {
	var u usuario.Usuario
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, sql, arg).Scan(
		&u.ID, &u.Username, &u.Nome, &u.Email, &u.SenhaHash, &u.Perfil,
		&u.Ativo, &u.UltimoLogin, &u.CreatedAt, &u.UpdatedAt,
		&u.Tema, &u.AltoContraste, &u.Densidade, &u.TamanhoFonte,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, usuario.ErrNaoEncontrado
		}
		return nil, fmt.Errorf("buscar usuario: %w", err)
	}
	return &u, nil
}
