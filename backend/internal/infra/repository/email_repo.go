package repository

import (
	"context"
	"fmt"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/email"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasSMTP = `habilitado, host, porta, criptografia, usuario, senha_cifrada,
	remetente_email, remetente_nome, updated_at, updated_by`

// EmailRepositorio implementa a persistencia do singleton do servidor SMTP.
// A linha id=1 e semeada pela migration 013.
type EmailRepositorio struct {
	pool *pgxpool.Pool
}

// NovoEmailRepositorio cria o repositorio da configuracao de e-mail.
func NovoEmailRepositorio(pool *pgxpool.Pool) *EmailRepositorio {
	return &EmailRepositorio{pool: pool}
}

// Buscar devolve a configuracao com a senha ainda cifrada.
func (r *EmailRepositorio) Buscar(ctx context.Context) (email.Registro, error) {
	return r.buscarUm(ctx, `SELECT `+colunasSMTP+` FROM configuracao_smtp WHERE id = 1`)
}

func (r *EmailRepositorio) buscarUm(ctx context.Context, sql string, args ...any) (email.Registro, error) {
	var reg email.Registro
	err := db.DoContexto(ctx, r.pool).QueryRow(ctx, sql, args...).Scan(
		&reg.Habilitado, &reg.Host, &reg.Porta, &reg.Criptografia, &reg.Usuario, &reg.SenhaCifrada,
		&reg.RemetenteEmail, &reg.RemetenteNome, &reg.UpdatedAt, &reg.UpdatedBy,
	)
	if err != nil {
		return email.Registro{}, fmt.Errorf("buscar configuracao smtp: %w", err)
	}
	reg.SenhaDefinida = reg.SenhaCifrada != nil
	return reg, nil
}

// Atualizar grava os campos. A senha so muda quando ha uma nova (cifrada) ou
// quando removerSenha e pedido -- um PUT sem senha mantem a atual, ja que a
// tela nunca recebe a senha para devolve-la.
func (r *EmailRepositorio) Atualizar(
	ctx context.Context, d email.Dados, senhaCifrada *string, removerSenha bool, autor string,
) (email.Registro, error) {
	sql := `UPDATE configuracao_smtp SET
			habilitado = $1, host = $2, porta = $3, criptografia = $4, usuario = $5,
			senha_cifrada = CASE WHEN $6 THEN NULL WHEN $7::text IS NOT NULL THEN $7 ELSE senha_cifrada END,
			remetente_email = $8, remetente_nome = $9, updated_at = now(), updated_by = $10
		WHERE id = 1
		RETURNING ` + colunasSMTP

	return r.buscarUm(ctx, sql, d.Habilitado, d.Host, d.Porta, d.Criptografia, d.Usuario,
		removerSenha, senhaCifrada, d.RemetenteEmail, d.RemetenteNome, autor)
}
