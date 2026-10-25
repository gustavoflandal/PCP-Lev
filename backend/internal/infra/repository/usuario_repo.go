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
	ultimo_login, created_at, updated_at, tema, alto_contraste, densidade, tamanho_fonte,
	situacao, matricula, telefone, setor, data_admissao, data_desligamento, deve_trocar_senha,
	tentativas_falhas, bloqueado_ate, versao_sessao`

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
		`UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP, tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("registrar login: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		return usuario.ErrNaoEncontrado
	}
	return nil
}

// RegistrarFalha conta uma senha errada; da 5a seguida em diante bloqueia a
// conta por 15, 30 e depois 60 minutos.
func (r *UsuarioRepositorio) RegistrarFalha(ctx context.Context, id int64) error {
	_, err := db.DoContexto(ctx, r.pool).Exec(ctx, `
		UPDATE usuarios SET tentativas_falhas = tentativas_falhas + 1,
		       bloqueado_ate = CASE WHEN tentativas_falhas + 1 >= $2::int
		         THEN CURRENT_TIMESTAMP + make_interval(mins => 15 * power(2, LEAST(tentativas_falhas + 1 - $2::int, 2))::int)
		         ELSE bloqueado_ate END
		WHERE id = $1`, id, usuario.TentativasAntesDoBloqueio)
	if err != nil {
		return fmt.Errorf("registrar falha de senha: %w", err)
	}
	return nil
}

// ExigirTrocaDaSenhaPadrao marca o admin semeado pela migration 008 para
// trocar a senha se ela ainda for a de instalacao (chamado so em producao).
func (r *UsuarioRepositorio) ExigirTrocaDaSenhaPadrao(ctx context.Context, senhaPadrao string) (bool, error) {
	u, err := r.BuscarPorUsername(ctx, "admin")
	if errors.Is(err, usuario.ErrNaoEncontrado) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if u.DeveTrocarSenha || !u.SenhaConfere(senhaPadrao) {
		return false, nil
	}
	if _, err := r.pool.Exec(ctx, `UPDATE usuarios SET deve_trocar_senha = TRUE WHERE id = $1`, u.ID); err != nil {
		return false, fmt.Errorf("exigir troca da senha padrao: %w", err)
	}
	return true, nil
}

// AtualizarSenha grava o novo hash da senha escolhida pelo proprio usuario --
// o que encerra uma troca obrigatoria pendente.
func (r *UsuarioRepositorio) AtualizarSenha(ctx context.Context, id int64, senhaHash, autor string) error {
	etiqueta, err := db.DoContexto(ctx, r.pool).Exec(ctx,
		`UPDATE usuarios SET senha_hash = $2, updated_by = $3, deve_trocar_senha = FALSE,
		        versao_sessao = versao_sessao + 1, tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = $1`, id, senhaHash, autor)
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
	u, err := lerUsuario(db.DoContexto(ctx, r.pool).QueryRow(ctx, sql, arg))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, usuario.ErrNaoEncontrado
		}
		return nil, fmt.Errorf("buscar usuario: %w", err)
	}
	return u, nil
}

// lerUsuario le uma linha com colunasUsuario, na mesma ordem.
func lerUsuario(linha pgx.Row) (*usuario.Usuario, error) {
	var u usuario.Usuario
	err := linha.Scan(
		&u.ID, &u.Username, &u.Nome, &u.Email, &u.SenhaHash, &u.Perfil,
		&u.Ativo, &u.UltimoLogin, &u.CreatedAt, &u.UpdatedAt,
		&u.Tema, &u.AltoContraste, &u.Densidade, &u.TamanhoFonte,
		&u.Situacao, &u.Matricula, &u.Telefone, &u.Setor, &u.DataAdmissao, &u.DataDesligamento, &u.DeveTrocarSenha,
		&u.TentativasFalhas, &u.BloqueadoAte, &u.VersaoSessao,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}
