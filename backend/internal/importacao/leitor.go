package importacao

import (
	"fmt"
	"io"
	"strings"

	"github.com/xuri/excelize/v2"
)

// Linha e uma linha de dados da planilha, com os valores na ordem das
// colunas do modelo da aba.
type Linha struct {
	// Numero e a linha na planilha (a primeira de dados e a 2).
	Numero  int
	Valores []string
}

// Planilha guarda as linhas de dados lidas, por aba.
type Planilha map[string][]Linha

// Ler abre a planilha, confere os cabecalhos e devolve as linhas de dados.
// Abas ausentes sao ignoradas; uma aba presente sem uma coluna obrigatoria
// do modelo e erro (a pessoa provavelmente usou um arquivo que nao e o
// gabarito).
func Ler(r io.Reader) (Planilha, []Erro, error) {
	f, err := excelize.OpenReader(r)
	if err != nil {
		return nil, nil, fmt.Errorf("o arquivo não é uma planilha Excel (.xlsx) válida: %w", err)
	}
	defer f.Close()

	existentes := map[string]bool{}
	for _, nome := range f.GetSheetList() {
		existentes[nome] = true
	}

	planilha := Planilha{}
	var erros []Erro
	for _, aba := range Abas {
		if !existentes[aba.Nome] {
			continue
		}
		linhas, err := f.GetRows(aba.Nome, excelize.Options{RawCellValue: true})
		if err != nil {
			return nil, nil, fmt.Errorf("ler a aba %s: %w", aba.Nome, err)
		}
		if len(linhas) == 0 {
			continue
		}

		posicao, errosCab := mapearCabecalho(aba, linhas[0])
		if len(errosCab) > 0 {
			erros = append(erros, errosCab...)
			continue
		}

		dados := linhas[1:]
		if len(dados) > MaxLinhasPorAba+1 { // folga para linhas vazias no fim
			ultima := 0
			for i, l := range dados {
				if !linhaVazia(l) {
					ultima = i + 1
				}
			}
			if ultima > MaxLinhasPorAba {
				erros = append(erros, Erro{Aba: aba.Nome, Linha: MaxLinhasPorAba + 2,
					Mensagem: fmt.Sprintf("a aba tem mais de %d linhas; divida em mais de uma planilha", MaxLinhasPorAba)})
				continue
			}
		}
		for i, bruta := range dados {
			if linhaVazia(bruta) {
				continue
			}
			valores := make([]string, len(aba.Colunas))
			for j := range aba.Colunas {
				if p := posicao[j]; p >= 0 && p < len(bruta) {
					valores[j] = strings.TrimSpace(bruta[p])
				}
			}
			planilha[aba.Nome] = append(planilha[aba.Nome], Linha{Numero: i + 2, Valores: valores})
		}
	}
	return planilha, erros, nil
}

// mapearCabecalho acha a posicao de cada coluna do modelo no cabecalho lido
// (-1 quando uma coluna opcional nao existe na planilha).
func mapearCabecalho(aba Aba, cabecalho []string) ([]int, []Erro) {
	indice := map[string]int{}
	for i, titulo := range cabecalho {
		if t := normalizarTitulo(titulo); t != "" {
			if _, repetido := indice[t]; !repetido {
				indice[t] = i
			}
		}
	}
	posicao := make([]int, len(aba.Colunas))
	var erros []Erro
	for j, col := range aba.Colunas {
		p, achou := indice[normalizarTitulo(col.Titulo)]
		if !achou {
			posicao[j] = -1
			if col.Obrigatoria {
				erros = append(erros, Erro{Aba: aba.Nome, Linha: 1, Coluna: col.Titulo,
					Mensagem: "coluna obrigatória não encontrada no cabeçalho; use o gabarito do sistema"})
			}
			continue
		}
		posicao[j] = p
	}
	return posicao, erros
}

func linhaVazia(celulas []string) bool {
	for _, c := range celulas {
		if strings.TrimSpace(c) != "" {
			return false
		}
	}
	return true
}
