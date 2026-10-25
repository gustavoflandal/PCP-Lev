// Package documento valida os documentos fiscais usados nos cadastros.
package documento

import "strings"

const tamanhoCNPJ = 14

// pesos usados no calculo dos digitos verificadores (Receita Federal).
var (
	pesosPrimeiroDigito = []int{5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	pesosSegundoDigito  = []int{6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
)

// ApenasDigitos remove pontuacao e qualquer caractere nao numerico.
func ApenasDigitos(valor string) string {
	var b strings.Builder
	b.Grow(len(valor))
	for _, r := range valor {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// CNPJValido confere tamanho e digitos verificadores. Espera o valor ja sem
// formatacao — use ApenasDigitos antes quando vier da interface.
func CNPJValido(cnpj string) bool {
	if len(cnpj) != tamanhoCNPJ {
		return false
	}

	digitos := make([]int, tamanhoCNPJ)
	for i, r := range cnpj {
		if r < '0' || r > '9' {
			return false
		}
		digitos[i] = int(r - '0')
	}

	// Sequencias como 00000000000000 satisfazem a conta, mas nao existem.
	if todosIguais(digitos) {
		return false
	}

	if digitos[12] != digitoVerificador(digitos[:12], pesosPrimeiroDigito) {
		return false
	}
	return digitos[13] == digitoVerificador(digitos[:13], pesosSegundoDigito)
}

// FormatarCNPJ devolve o documento pontuado para exibicao.
func FormatarCNPJ(cnpj string) string {
	if len(cnpj) != tamanhoCNPJ {
		return cnpj
	}
	return cnpj[0:2] + "." + cnpj[2:5] + "." + cnpj[5:8] + "/" + cnpj[8:12] + "-" + cnpj[12:14]
}

func digitoVerificador(digitos []int, pesos []int) int {
	soma := 0
	for i, d := range digitos {
		soma += d * pesos[i]
	}
	resto := soma % 11
	if resto < 2 {
		return 0
	}
	return 11 - resto
}

func todosIguais(digitos []int) bool {
	for _, d := range digitos[1:] {
		if d != digitos[0] {
			return false
		}
	}
	return true
}
