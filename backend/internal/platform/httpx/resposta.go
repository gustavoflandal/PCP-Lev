// Package httpx padroniza os envelopes de resposta da API.
// Ref: docs/3_ESPECIFICACAO_APIS.md (Padroes Gerais e Codigos de Erro).
package httpx

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// Codigos de erro do contrato (doc 3).
const (
	CodigoRequisicaoInvalida = "REQUISICAO_INVALIDA"
	CodigoErroValidacao      = "ERRO_VALIDACAO"
	CodigoNaoAutorizado      = "NAO_AUTORIZADO"
	CodigoAcessoNegado       = "ACESSO_NEGADO"
	CodigoNaoEncontrado      = "NAO_ENCONTRADO"
	CodigoConflito           = "CONFLITO"
	CodigoErroInterno        = "ERRO_INTERNO"
)

// Paginacao acompanha as respostas de listagem.
type Paginacao struct {
	Pagina       int `json:"pagina"`
	Limite       int `json:"limite"`
	Total        int `json:"total"`
	TotalPaginas int `json:"total_paginas"`
}

// NovaPaginacao calcula o total de paginas a partir do total de registros.
func NovaPaginacao(pagina, limite, total int) *Paginacao {
	totalPaginas := 0
	if limite > 0 && total > 0 {
		totalPaginas = (total + limite - 1) / limite
	}
	return &Paginacao{Pagina: pagina, Limite: limite, Total: total, TotalPaginas: totalPaginas}
}

// RespostaSucesso e o envelope de qualquer resposta bem-sucedida.
type RespostaSucesso struct {
	Sucesso   bool       `json:"sucesso"`
	Dados     any        `json:"dados"`
	Mensagem  string     `json:"mensagem,omitempty"`
	Paginacao *Paginacao `json:"paginacao,omitempty"`
}

// CampoInvalido descreve uma falha de validacao em um campo especifico.
type CampoInvalido struct {
	Campo    string `json:"campo"`
	Mensagem string `json:"mensagem"`
}

// DetalheErro descreve o erro devolvido ao cliente.
type DetalheErro struct {
	Codigo   string          `json:"codigo"`
	Mensagem string          `json:"mensagem"`
	Detalhes []CampoInvalido `json:"detalhes,omitempty"`
}

// RespostaErro e o envelope de qualquer resposta de erro.
type RespostaErro struct {
	Sucesso bool        `json:"sucesso"`
	Erro    DetalheErro `json:"erro"`
}

// OK responde 200 com os dados.
func OK(c echo.Context, dados any) error {
	return c.JSON(http.StatusOK, RespostaSucesso{Sucesso: true, Dados: dados})
}

// OKComMensagem responde 200 com dados e uma mensagem para o usuario.
func OKComMensagem(c echo.Context, dados any, mensagem string) error {
	return c.JSON(http.StatusOK, RespostaSucesso{Sucesso: true, Dados: dados, Mensagem: mensagem})
}

// Criado responde 201 com o recurso recem-criado.
func Criado(c echo.Context, dados any) error {
	return c.JSON(http.StatusCreated, RespostaSucesso{Sucesso: true, Dados: dados})
}

// SemConteudo responde 204.
func SemConteudo(c echo.Context) error {
	return c.NoContent(http.StatusNoContent)
}

// Lista responde 200 com um conjunto de itens e sua paginacao.
func Lista(c echo.Context, dados any, paginacao *Paginacao) error {
	return c.JSON(http.StatusOK, RespostaSucesso{Sucesso: true, Dados: dados, Paginacao: paginacao})
}

// Erro responde com o envelope de erro no status informado.
func Erro(c echo.Context, status int, codigo, mensagem string) error {
	return c.JSON(status, RespostaErro{
		Sucesso: false,
		Erro:    DetalheErro{Codigo: codigo, Mensagem: mensagem},
	})
}

// ErroValidacao responde 400 detalhando os campos invalidos.
func ErroValidacao(c echo.Context, detalhes []CampoInvalido) error {
	return c.JSON(http.StatusBadRequest, RespostaErro{
		Sucesso: false,
		Erro: DetalheErro{
			Codigo:   CodigoErroValidacao,
			Mensagem: "Dados invalidos",
			Detalhes: detalhes,
		},
	})
}

// NaoAutorizado responde 401.
func NaoAutorizado(c echo.Context, mensagem string) error {
	return Erro(c, http.StatusUnauthorized, CodigoNaoAutorizado, mensagem)
}

// AcessoNegado responde 403.
func AcessoNegado(c echo.Context, mensagem string) error {
	return Erro(c, http.StatusForbidden, CodigoAcessoNegado, mensagem)
}

// NaoEncontrado responde 404.
func NaoEncontrado(c echo.Context, mensagem string) error {
	return Erro(c, http.StatusNotFound, CodigoNaoEncontrado, mensagem)
}

// Conflito responde 409.
func Conflito(c echo.Context, mensagem string) error {
	return Erro(c, http.StatusConflict, CodigoConflito, mensagem)
}

// ErroInterno responde 500 com mensagem generica: detalhes de falha interna
// nao sao expostos ao cliente, apenas registrados em log.
func ErroInterno(c echo.Context) error {
	return Erro(c, http.StatusInternalServerError, CodigoErroInterno,
		"Erro interno do servidor")
}
