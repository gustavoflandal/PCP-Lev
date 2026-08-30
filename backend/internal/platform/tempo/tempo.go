// Package tempo representa datas sem hora (colunas DATE do doc 2), com o
// mesmo cuidado de dinheiro.Dinheiro: um tipo que sabe se ler/escrever
// sozinho no formato certo em JSON (doc 3: "2026-09-25", nao RFC3339) e no
// Postgres (DATE via pgx).
package tempo

import (
	"database/sql/driver"
	"fmt"
	"strings"
	"time"
)

const camada = "2006-01-02"

// Data guarda um dia, sem hora nem fuso.
type Data struct {
	Time time.Time
}

// Hoje devolve a data corrente, sem hora (UTC).
func Hoje() Data {
	return Data{time.Now().UTC().Truncate(24 * time.Hour)}
}

// DeString le "2026-09-25".
func DeString(texto string) (Data, error) {
	t, err := time.Parse(camada, strings.TrimSpace(texto))
	if err != nil {
		return Data{}, fmt.Errorf("data %q invalida, use AAAA-MM-DD", texto)
	}
	return Data{t}, nil
}

// After informa se esta data e posterior a outra.
func (d Data) After(outra Data) bool { return d.Time.After(outra.Time) }

// IsZero informa se a data nao foi informada.
func (d Data) IsZero() bool { return d.Time.IsZero() }

// MarshalJSON emite a data pura, como no contrato do doc 3.
func (d Data) MarshalJSON() ([]byte, error) {
	if d.IsZero() {
		return []byte("null"), nil
	}
	return []byte(`"` + d.Time.Format(camada) + `"`), nil
}

// UnmarshalJSON aceita "2026-09-25" ou null.
func (d *Data) UnmarshalJSON(bruto []byte) error {
	texto := strings.Trim(string(bruto), `"`)
	if texto == "null" || texto == "" {
		*d = Data{}
		return nil
	}
	valor, err := DeString(texto)
	if err != nil {
		return err
	}
	*d = valor
	return nil
}

// Scan le o DATE devolvido pelo pgx (jackc/pgx mapeia DATE para time.Time).
func (d *Data) Scan(origem any) error {
	switch v := origem.(type) {
	case nil:
		*d = Data{}
		return nil
	case time.Time:
		*d = Data{v}
		return nil
	default:
		return fmt.Errorf("nao e possivel ler %T como data", origem)
	}
}

// Value envia time.Time puro — o pgx sabe codificar isso para DATE.
func (d Data) Value() (driver.Value, error) {
	if d.IsZero() {
		return nil, nil
	}
	return d.Time, nil
}

var (
	_ driver.Valuer = Data{}
)
