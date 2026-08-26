package repository

import (
	"fmt"
	"strings"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
)

// filtrosDeCadastro monta o WHERE comum das listagens de cadastro: situacao
// (ativo) e busca textual nas colunas informadas.
//
// Os nomes de coluna vem do codigo, nunca da requisicao; os valores vao como
// parametros posicionais.
func filtrosDeCadastro(params consulta.Parametros, colunasBusca ...string) (string, []any) {
	condicoes := make([]string, 0, 2)
	argumentos := make([]any, 0, 2)

	if params.FiltroAtivo != nil {
		argumentos = append(argumentos, *params.FiltroAtivo)
		condicoes = append(condicoes, fmt.Sprintf("ativo = $%d", len(argumentos)))
	}

	if params.Busca != "" && len(colunasBusca) > 0 {
		argumentos = append(argumentos, "%"+strings.ToLower(params.Busca)+"%")
		posicao := len(argumentos)

		alternativas := make([]string, 0, len(colunasBusca))
		for _, coluna := range colunasBusca {
			alternativas = append(alternativas, fmt.Sprintf("lower(%s) LIKE $%d", coluna, posicao))
		}
		condicoes = append(condicoes, "("+strings.Join(alternativas, " OR ")+")")
	}

	if len(condicoes) == 0 {
		return "", argumentos
	}
	return "WHERE " + strings.Join(condicoes, " AND "), argumentos
}
