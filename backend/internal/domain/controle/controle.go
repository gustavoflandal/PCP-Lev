// Package controle reune as flags de controle do item (doc 0, 4.1.1), comuns a
// partes/pecas e produtos acabados: determinam o que o recebimento exige
// (serie, lote, validade, certificado) e o que a OP rastreia.
package controle

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

var (
	ErrValidadeSemLote  = errors.New("controle de validade so existe junto com controle de lote")
	ErrMascaraInvalida  = errors.New("a mascara de numero de serie deve ser uma expressao regular valida (ate 120 caracteres)")
	ErrValidadeMinima   = errors.New("a validade minima vai de 0 a 3650 dias")
	ErrSerieForaMascara = errors.New("numero de serie fora do formato cadastrado para o item")
)

// Flags sao as cinco flags do 4.1.1.
type Flags struct {
	ControlaNumeroSerie bool `json:"controla_numero_serie"`
	ControlaLote        bool `json:"controla_lote"`
	ControlaValidade    bool `json:"controla_validade"`
	ItemCritico         bool `json:"item_critico"`
	ExigeCertificado    bool `json:"exige_certificado"`
}

// Validar: validade so com lote (combinacao do 4.1.1).
func (f Flags) Validar() error {
	if f.ControlaValidade && !f.ControlaLote {
		return ErrValidadeSemLote
	}
	return nil
}

// ValidarRecebimento confere a validade minima e a mascara de serie
// cadastradas na parte/peca.
func ValidarRecebimento(validadeMinimaDias int, mascara string) error {
	if validadeMinimaDias < 0 || validadeMinimaDias > 3650 {
		return ErrValidadeMinima
	}
	mascara = strings.TrimSpace(mascara)
	if mascara == "" {
		return nil
	}
	if utf8.RuneCountInString(mascara) > 120 {
		return ErrMascaraInvalida
	}
	if _, err := regexp.Compile("^(?:" + mascara + ")$"); err != nil {
		return ErrMascaraInvalida
	}
	return nil
}

// SerieConfere diz se o numero de serie segue a mascara (vazia = livre).
func SerieConfere(mascara, serie string) bool {
	mascara = strings.TrimSpace(mascara)
	if mascara == "" {
		return true
	}
	re, err := regexp.Compile("^(?:" + mascara + ")$")
	return err == nil && re.MatchString(serie)
}
