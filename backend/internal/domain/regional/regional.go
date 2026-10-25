// Package regional contem os parametros regionais e de formatacao (doc 0,
// secao 4.6.4). E um singleton: uma unica linha no banco, nunca uma lista --
// Buscar/Atualizar em vez de Listar/Criar/Excluir. Mesmo molde de
// internal/domain/empresa.
package regional

import (
	"errors"
	"slices"
	"time"
)

// FormatoData e o conjunto fechado de formatos de exibicao de data.
type FormatoData string

const (
	FormatoDataBR    FormatoData = "DD/MM/AAAA"
	FormatoDataTraco FormatoData = "DD-MM-AAAA"
	FormatoDataISO   FormatoData = "AAAA-MM-DD"
)

var formatosDataValidos = []FormatoData{FormatoDataBR, FormatoDataTraco, FormatoDataISO}

// FormatoHora e o conjunto fechado de formatos de exibicao de hora.
type FormatoHora string

const (
	FormatoHora24 FormatoHora = "24H"
	FormatoHora12 FormatoHora = "12H"
)

var formatosHoraValidos = []FormatoHora{FormatoHora24, FormatoHora12}

var (
	ErrFormatoDataInvalido = errors.New("formato de data invalido")
	ErrFormatoHoraInvalido = errors.New("formato de hora invalido")
)

// Regional e a configuracao singleton lida por GET /configuracoes/regional.
type Regional struct {
	FormatoData FormatoData `json:"formato_data"`
	FormatoHora FormatoHora `json:"formato_hora"`
	UpdatedAt   time.Time   `json:"updated_at"`
	UpdatedBy   *string     `json:"updated_by,omitempty"`
}

// Dados sao os campos informados no PUT -- sempre a configuracao inteira
// sendo salva de novo, mesmo padrao de empresa.Dados.
type Dados struct {
	FormatoData FormatoData
	FormatoHora FormatoHora
}

// Validar confere o conjunto fechado de cada campo -- um valor fora da lista
// quebraria o CHECK constraint da migration 011 com um 500 generico em vez
// de um 400 explicando o motivo (mesmo padrao de usuario.Preferencias.Validar).
func (d Dados) Validar() error {
	if !slices.Contains(formatosDataValidos, d.FormatoData) {
		return ErrFormatoDataInvalido
	}
	if !slices.Contains(formatosHoraValidos, d.FormatoHora) {
		return ErrFormatoHoraInvalido
	}
	return nil
}
