package handlers

import (
	"encoding/csv"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"
)

// bomUTF8 marca o arquivo como UTF-8 para o Excel (Windows/pt-BR): sem o
// BOM, o Excel le o CSV pela codepage ANSI local e todo acento vira
// mojibake -- o Content-Type com charset=utf-8 nao basta, o Excel nao
// inspeciona esse header para arquivo local.
var bomUTF8 = []byte{0xEF, 0xBB, 0xBF}

// responderCSV escreve um relatorio CSV completo (sem paginacao -- um
// relatorio existe para ser aberto numa planilha inteira). O cabecalho e
// sempre escrito, mesmo com `linhas` vazio, para nao devolver um arquivo
// vazio que confundiria quem abre no Excel. Separador ';' porque e o padrao
// de lista do Excel em locale pt-BR (a virgula abre tudo numa coluna so).
//
// A resposta ja comecou (status + BOM) quando um erro de escrita pode
// acontecer -- nesse ponto nao da mais para devolver um erro HTTP de
// verdade (o corpo ja foi enviado), entao só loga e devolve nil em vez de
// deixar o erro subir para o tratador global, que tentaria escrever um
// envelope de erro sobre uma resposta ja commitada.
func responderCSV(c echo.Context, nomeArquivo string, cabecalho []string, linhas [][]string) error {
	c.Response().Header().Set(echo.HeaderContentType, "text/csv; charset=utf-8")
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf(`attachment; filename="%s"`, nomeArquivo))
	c.Response().WriteHeader(http.StatusOK)

	if _, err := c.Response().Write(bomUTF8); err != nil {
		slog.Error("erro ao escrever relatorio CSV", "arquivo", nomeArquivo, "erro", err)
		return nil
	}

	escritor := csv.NewWriter(c.Response())
	escritor.Comma = ';'
	escritor.UseCRLF = true
	if err := escritor.Write(cabecalho); err != nil {
		slog.Error("erro ao escrever relatorio CSV", "arquivo", nomeArquivo, "erro", err)
		return nil
	}
	// WriteAll ja da Flush() e devolve escritor.Error() -- nao ha nada a
	// checar depois dela.
	if err := escritor.WriteAll(linhas); err != nil {
		slog.Error("erro ao escrever relatorio CSV", "arquivo", nomeArquivo, "erro", err)
	}
	return nil
}
