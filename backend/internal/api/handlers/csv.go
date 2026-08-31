package handlers

import (
	"encoding/csv"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
)

// responderCSV escreve um relatorio CSV completo (sem paginacao -- um
// relatorio existe para ser aberto numa planilha inteira). O cabecalho e
// sempre escrito, mesmo com `linhas` vazio, para nao devolver um arquivo
// vazio que confundiria quem abre no Excel.
func responderCSV(c echo.Context, nomeArquivo string, cabecalho []string, linhas [][]string) error {
	c.Response().Header().Set(echo.HeaderContentType, "text/csv; charset=utf-8")
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf(`attachment; filename="%s"`, nomeArquivo))
	c.Response().WriteHeader(http.StatusOK)

	escritor := csv.NewWriter(c.Response())
	if err := escritor.Write(cabecalho); err != nil {
		return err
	}
	if err := escritor.WriteAll(linhas); err != nil {
		return err
	}
	escritor.Flush()
	return escritor.Error()
}
