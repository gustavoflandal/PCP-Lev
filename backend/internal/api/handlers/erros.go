package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/httpx"
	"github.com/labstack/echo/v4"
)

// erroDeNegocio descreve como um erro do dominio deve sair na API.
type erroDeNegocio struct {
	err    error
	status int
	codigo string
}

// mapaDeErros e alimentado por cada modulo em seu init/construtor, para que o
// handler nao precise conhecer os erros de todos os dominios.
type mapaDeErros []erroDeNegocio

// responder traduz o erro do dominio no envelope do doc 3. Erros nao mapeados
// viram 500 com mensagem generica e detalhe apenas no log.
func (m mapaDeErros) responder(c echo.Context, err error) error {
	for _, e := range m {
		if errors.Is(err, e.err) {
			return httpx.Erro(c, e.status, e.codigo, err.Error())
		}
	}

	slog.Error("erro nao tratado no handler",
		"rota", c.Request().URL.Path, "metodo", c.Request().Method, "erro", err)
	return httpx.ErroInterno(c)
}

// idDaRota le o parametro {id} como inteiro.
func idDaRota(c echo.Context) (int64, error) {
	return strconv.ParseInt(c.Param("id"), 10, 64)
}

// idDaRotaComNome le um parametro de rota com nome diferente de "id" —
// /estoque/:parte_peca_id, por exemplo.
func idDaRotaComNome(c echo.Context, nome string) (int64, error) {
	return strconv.ParseInt(c.Param(nome), 10, 64)
}

// autorDaRequisicao devolve o username da sessao, usado nas colunas de
// auditoria created_by / updated_by.
func autorDaRequisicao(c echo.Context) string {
	if claims := middleware.ClaimsDoContexto(c); claims != nil {
		return claims.Username
	}
	return "desconhecido"
}

// erroRequisicaoInvalida responde 400 para corpo ou parametro malformado.
func erroRequisicaoInvalida(c echo.Context, mensagem string) error {
	return httpx.Erro(c, http.StatusBadRequest, httpx.CodigoRequisicaoInvalida, mensagem)
}
