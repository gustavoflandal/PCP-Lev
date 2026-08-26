package repository

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// codigoViolacaoUnica e o SQLSTATE de unique_violation no PostgreSQL.
const codigoViolacaoUnica = "23505"

// codigoViolacaoChaveEstrangeira e o SQLSTATE de foreign_key_violation.
const codigoViolacaoChaveEstrangeira = "23503"

// violouIndiceUnico informa se o erro veio de um indice unico, opcionalmente
// exigindo que seja um indice especifico.
//
// Detectar a colisao pelo erro do banco, em vez de consultar antes de gravar,
// evita a janela de corrida entre a checagem e o INSERT.
func violouIndiceUnico(err error, indices ...string) bool {
	var erroPg *pgconn.PgError
	if !errors.As(err, &erroPg) || erroPg.Code != codigoViolacaoUnica {
		return false
	}
	if len(indices) == 0 {
		return true
	}
	for _, indice := range indices {
		if erroPg.ConstraintName == indice {
			return true
		}
	}
	return false
}

// violouChaveEstrangeira informa se o erro veio de uma FK inexistente.
func violouChaveEstrangeira(err error) bool {
	var erroPg *pgconn.PgError
	return errors.As(err, &erroPg) && erroPg.Code == codigoViolacaoChaveEstrangeira
}
