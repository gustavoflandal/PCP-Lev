package importacao

import (
	"bytes"
	"fmt"

	"github.com/xuri/excelize/v2"
)

// ultimaLinhaValidada e ate onde as listas suspensas valem na planilha.
const ultimaLinhaValidada = 1001

// Gabarito gera a planilha Excel vazia, mas estruturada: uma aba de
// instrucoes e uma aba por cadastro, cada uma com o cabecalho (obrigatorios
// marcados com *), listas suspensas e o cabecalho congelado.
func Gabarito() ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	cabecalho, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"1F4E79"}},
		Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
	})
	if err != nil {
		return nil, err
	}
	obrigatorio, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"C0392B"}},
		Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
	})
	if err != nil {
		return nil, err
	}
	texto, err := f.NewStyle(&excelize.Style{NumFmt: 49}) // "@": a coluna e texto (CNPJ com zero a esquerda)
	if err != nil {
		return nil, err
	}

	if err := f.SetSheetName("Sheet1", abaInstrucoes); err != nil {
		return nil, err
	}
	if err := escreverInstrucoes(f); err != nil {
		return nil, err
	}

	for _, aba := range Abas {
		if _, err := f.NewSheet(aba.Nome); err != nil {
			return nil, err
		}
		for i, col := range aba.Colunas {
			letra, _ := excelize.ColumnNumberToName(i + 1)
			celula := letra + "1"
			if err := f.SetCellValue(aba.Nome, celula, col.tituloCelula()); err != nil {
				return nil, err
			}
			estilo := cabecalho
			if col.Obrigatoria {
				estilo = obrigatorio
			}
			if err := f.SetCellStyle(aba.Nome, celula, celula, estilo); err != nil {
				return nil, err
			}
			largura := float64(len([]rune(col.tituloCelula()))) + 6
			if largura < 16 {
				largura = 16
			}
			if err := f.SetColWidth(aba.Nome, letra, letra, largura); err != nil {
				return nil, err
			}
			// Colunas de texto: evita o Excel transformar CNPJ/codigo em numero.
			if err := f.SetColStyle(aba.Nome, letra, texto); err != nil {
				return nil, err
			}
			// SetColStyle sobrescreve o estilo do cabecalho: reaplica.
			if err := f.SetCellStyle(aba.Nome, celula, celula, estilo); err != nil {
				return nil, err
			}
			if len(col.Opcoes) > 0 {
				dv := excelize.NewDataValidation(true)
				dv.Sqref = fmt.Sprintf("%s2:%s%d", letra, letra, ultimaLinhaValidada)
				if err := dv.SetDropList(col.Opcoes); err != nil {
					return nil, err
				}
				dv.SetError(excelize.DataValidationErrorStyleStop, "Valor inválido", "Escolha um valor da lista.")
				if err := f.AddDataValidation(aba.Nome, dv); err != nil {
					return nil, err
				}
			}
		}
		if err := f.SetRowHeight(aba.Nome, 1, 32); err != nil {
			return nil, err
		}
		if err := f.SetPanes(aba.Nome, &excelize.Panes{
			Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft",
		}); err != nil {
			return nil, err
		}
	}

	f.SetActiveSheet(0)
	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func escreverInstrucoes(f *excelize.File) error {
	titulo, err := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Size: 14}})
	if err != nil {
		return err
	}
	negrito, err := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}})
	if err != nil {
		return err
	}
	quebra, err := f.NewStyle(&excelize.Style{Alignment: &excelize.Alignment{WrapText: true, Vertical: "top"}})
	if err != nil {
		return err
	}

	linhas := []string{
		"Gabarito de importação de cadastros",
		"",
		"Como usar",
		"1. Preencha as abas a partir da linha 2 (a linha 1 é o cabeçalho e não deve ser alterada).",
		"2. Colunas em vermelho (com *) são obrigatórias; as azuis são opcionais.",
		"3. Não precisa preencher todas as abas: abas sem dados são ignoradas.",
		"4. No sistema, abra Importar > Importar e envie este arquivo (.xlsx).",
		"",
		"Regras da importação",
		"• Tudo ou nada: se qualquer linha tiver problema, NADA é importado e o sistema mostra aba, linha e coluna de cada erro.",
		"• Ordem: Clientes, Fornecedores, Produtos acabados e Partes e peças. Assim, uma peça pode usar um fornecedor criado na mesma planilha.",
		"• Registro que já existe no sistema (mesmo CNPJ ou código) é ignorado: o cadastro atual não é alterado.",
		"• Repetir o mesmo CNPJ ou código dentro da planilha é erro.",
		"• Datas: AAAA-MM-DD ou DD/MM/AAAA. Sim/Não: use a lista suspensa.",
		"• Limite: " + fmt.Sprint(MaxLinhasPorAba) + " linhas por aba.",
		"",
		"Colunas de cada aba",
	}
	for i, l := range linhas {
		if err := f.SetCellValue(abaInstrucoes, fmt.Sprintf("A%d", i+1), l); err != nil {
			return err
		}
	}
	if err := f.SetCellStyle(abaInstrucoes, "A1", "A1", titulo); err != nil {
		return err
	}
	for _, n := range []int{3, 9, 17} {
		if err := f.SetCellStyle(abaInstrucoes, fmt.Sprintf("A%d", n), fmt.Sprintf("A%d", n), negrito); err != nil {
			return err
		}
	}

	linha := len(linhas) + 1
	for _, aba := range Abas {
		if err := f.SetCellValue(abaInstrucoes, fmt.Sprintf("A%d", linha), aba.Nome); err != nil {
			return err
		}
		if err := f.SetCellStyle(abaInstrucoes, fmt.Sprintf("A%d", linha), fmt.Sprintf("A%d", linha), negrito); err != nil {
			return err
		}
		linha++
		for _, col := range aba.Colunas {
			obrig := "opcional"
			if col.Obrigatoria {
				obrig = "obrigatória"
			}
			if err := f.SetCellValue(abaInstrucoes, fmt.Sprintf("A%d", linha), col.Titulo); err != nil {
				return err
			}
			if err := f.SetCellValue(abaInstrucoes, fmt.Sprintf("B%d", linha), obrig); err != nil {
				return err
			}
			if err := f.SetCellValue(abaInstrucoes, fmt.Sprintf("C%d", linha), col.Dica); err != nil {
				return err
			}
			linha++
		}
		linha++
	}
	if err := f.SetColWidth(abaInstrucoes, "A", "A", 44); err != nil {
		return err
	}
	if err := f.SetColWidth(abaInstrucoes, "B", "B", 14); err != nil {
		return err
	}
	if err := f.SetColWidth(abaInstrucoes, "C", "C", 70); err != nil {
		return err
	}
	return f.SetCellStyle(abaInstrucoes, "C1", fmt.Sprintf("C%d", linha), quebra)
}
