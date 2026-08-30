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

// filtrosDeCompras monta o WHERE das listagens de cotacao/pedido de compra:
// filtro por status (nao por ativo — essas tabelas nao tem essa coluna) e
// busca textual numa unica coluna (numero_cotacao / numero_pc).
func filtrosDeCompras(params consulta.Parametros, colunaBusca string) (string, []any) {
	condicoes := make([]string, 0, 2)
	argumentos := make([]any, 0, 2)

	if params.FiltroStatus != nil {
		argumentos = append(argumentos, *params.FiltroStatus)
		condicoes = append(condicoes, fmt.Sprintf("status = $%d", len(argumentos)))
	}

	if params.Busca != "" {
		argumentos = append(argumentos, "%"+strings.ToLower(params.Busca)+"%")
		condicoes = append(condicoes, fmt.Sprintf("lower(%s) LIKE $%d", colunaBusca, len(argumentos)))
	}

	if len(condicoes) == 0 {
		return "", argumentos
	}
	return "WHERE " + strings.Join(condicoes, " AND "), argumentos
}
