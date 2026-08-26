// Package dinheiro representa valores monetarios em centavos.
//
// As colunas de preco do doc 2 sao DECIMAL(10,2). Guardar isso em float64
// perde centavos em contas simples (0.07 * 3 = 0.21000000000000002), o que
// apareceria no valor total de um pedido de compra.
package dinheiro

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// Dinheiro guarda o valor em centavos.
type Dinheiro int64

// DeCentavos cria o valor a partir da menor unidade.
func DeCentavos(centavos int64) Dinheiro {
	return Dinheiro(centavos)
}

// DeString le "5000.00", "120" ou "12.5". Recusa mais de duas casas para nao
// arredondar dinheiro silenciosamente.
func DeString(texto string) (Dinheiro, error) {
	texto = strings.TrimSpace(texto)
	if texto == "" {
		return 0, fmt.Errorf("valor monetario vazio")
	}

	negativo := strings.HasPrefix(texto, "-")
	texto = strings.TrimPrefix(texto, "-")

	inteiros, decimais, temPonto := strings.Cut(texto, ".")
	if !temPonto {
		decimais = "00"
	}
	switch len(decimais) {
	case 0:
		decimais = "00"
	case 1:
		decimais += "0"
	case 2:
	default:
		return 0, fmt.Errorf("valor monetario %q tem mais de duas casas decimais", texto)
	}

	parteInteira, err := strconv.ParseInt(inteiros, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("valor monetario %q invalido", texto)
	}
	parteDecimal, err := strconv.ParseInt(decimais, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("valor monetario %q invalido", texto)
	}

	total := parteInteira*100 + parteDecimal
	if negativo {
		total = -total
	}
	return Dinheiro(total), nil
}

// Centavos devolve o valor na menor unidade.
func (d Dinheiro) Centavos() int64 { return int64(d) }

// Positivo informa se ha valor (maior que zero).
func (d Dinheiro) Positivo() bool { return d > 0 }

// Mais soma dois valores.
func (d Dinheiro) Mais(outro Dinheiro) Dinheiro { return d + outro }

// Vezes multiplica por uma quantidade inteira.
func (d Dinheiro) Vezes(quantidade int) Dinheiro { return d * Dinheiro(quantidade) }

// String formata com duas casas decimais e ponto como separador.
func (d Dinheiro) String() string {
	sinal := ""
	valor := int64(d)
	if valor < 0 {
		sinal = "-"
		valor = -valor
	}
	return fmt.Sprintf("%s%d.%02d", sinal, valor/100, valor%100)
}

// MarshalJSON emite um numero decimal, como no contrato do doc 3.
func (d Dinheiro) MarshalJSON() ([]byte, error) {
	return []byte(d.String()), nil
}

// UnmarshalJSON aceita numero (5000.00) ou texto ("5000.00").
func (d *Dinheiro) UnmarshalJSON(bruto []byte) error {
	texto := strings.Trim(string(bruto), `"`)
	if texto == "null" || texto == "" {
		*d = 0
		return nil
	}

	valor, err := DeString(texto)
	if err != nil {
		return err
	}
	*d = valor
	return nil
}

// Scan le o NUMERIC devolvido pelo PostgreSQL.
func (d *Dinheiro) Scan(origem any) error {
	switch v := origem.(type) {
	case nil:
		*d = 0
		return nil
	case string:
		valor, err := DeString(v)
		if err != nil {
			return err
		}
		*d = valor
		return nil
	case []byte:
		valor, err := DeString(string(v))
		if err != nil {
			return err
		}
		*d = valor
		return nil
	case int64:
		*d = Dinheiro(v * 100)
		return nil
	case float64:
		// O driver so devolve float para NUMERIC em configuracoes atipicas;
		// arredondar aqui e melhor que truncar.
		*d = Dinheiro(int64(v*100 + 0.5))
		return nil
	default:
		return fmt.Errorf("nao e possivel ler %T como valor monetario", origem)
	}
}

// Value envia o valor como texto, preservando as duas casas.
func (d Dinheiro) Value() (driver.Value, error) {
	return d.String(), nil
}

var (
	_ json.Marshaler   = Dinheiro(0)
	_ json.Unmarshaler = (*Dinheiro)(nil)
	_ driver.Valuer    = Dinheiro(0)
)
