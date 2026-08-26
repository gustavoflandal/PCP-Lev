// Package consulta interpreta os parametros comuns de listagem descritos em
// docs/3_ESPECIFICACAO_APIS.md (Filtros Comuns).
package consulta

import (
	"fmt"
	"net/url"
	"slices"
	"strconv"
	"strings"
)

const (
	limitePadrao = 50
	limiteMaximo = 200
)

// Ordem de classificacao.
type Ordem string

const (
	Crescente   Ordem = "asc"
	Decrescente Ordem = "desc"
)

// SQL devolve a palavra-chave correspondente. So existem dois valores
// possiveis, entao a interpolacao no SQL e segura.
func (o Ordem) SQL() string {
	if o == Decrescente {
		return "DESC"
	}
	return "ASC"
}

// Parametros reune paginacao, ordenacao e filtros de uma listagem.
type Parametros struct {
	Pagina     int
	Limite     int
	OrdenarPor string
	Ordem      Ordem
	// FiltroAtivo nil significa "sem filtro": traz ativos e inativos.
	FiltroAtivo *bool
	Busca       string
}

// Offset converte a pagina em deslocamento para o SQL.
func (p Parametros) Offset() int {
	return (p.Pagina - 1) * p.Limite
}

// Analisar valida os parametros da query string.
//
// `colunasPermitidas` e obrigatorio porque a coluna de ordenacao e
// interpolada no SQL — aceitar valor livre abriria injecao.
func Analisar(valores url.Values, colunasPermitidas []string, colunaPadrao string) (Parametros, error) {
	p := Parametros{
		Pagina:     1,
		Limite:     limitePadrao,
		OrdenarPor: colunaPadrao,
		Ordem:      Crescente,
		Busca:      strings.TrimSpace(valores.Get("busca")),
	}

	if bruto := valores.Get("pagina"); bruto != "" {
		pagina, err := strconv.Atoi(bruto)
		if err != nil || pagina < 1 {
			return p, fmt.Errorf("pagina deve ser um numero maior ou igual a 1")
		}
		p.Pagina = pagina
	}

	if bruto := valores.Get("limite"); bruto != "" {
		limite, err := strconv.Atoi(bruto)
		if err != nil || limite < 1 || limite > limiteMaximo {
			return p, fmt.Errorf("limite deve ser um numero entre 1 e %d", limiteMaximo)
		}
		p.Limite = limite
	}

	if bruto := valores.Get("ordenar_por"); bruto != "" {
		if !slices.Contains(colunasPermitidas, bruto) {
			return p, fmt.Errorf("ordenar_por aceita apenas: %s", strings.Join(colunasPermitidas, ", "))
		}
		p.OrdenarPor = bruto
	}

	if bruto := valores.Get("ordem"); bruto != "" {
		ordem := Ordem(strings.ToLower(bruto))
		if ordem != Crescente && ordem != Decrescente {
			return p, fmt.Errorf("ordem aceita apenas: asc, desc")
		}
		p.Ordem = ordem
	}

	if bruto := valores.Get("filtro_ativo"); bruto != "" {
		ativo, err := strconv.ParseBool(bruto)
		if err != nil {
			return p, fmt.Errorf("filtro_ativo aceita apenas: true, false")
		}
		p.FiltroAtivo = &ativo
	}

	return p, nil
}
