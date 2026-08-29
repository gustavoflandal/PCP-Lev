// Package fornecedor contem o cadastro de fornecedores — quem abastece as
// partes/pecas consumidas na producao (RF1.4).
package fornecedor

import (
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/documento"
)

// Telefone brasileiro: 10 digitos (fixo) ou 11 (celular), sempre com DDD.
const (
	digitosMinimosTelefone = 10
	digitosMaximosTelefone = 11
)

var (
	ErrRazaoSocialObrigatoria = errors.New("a razao social e obrigatoria")
	ErrCNPJInvalido           = errors.New("o CNPJ informado e invalido")
	ErrEmailInvalido          = errors.New("o email de contato e invalido")
	ErrTelefoneInvalido       = errors.New("o telefone de contato deve ter DDD e 8 ou 9 digitos")
	ErrLeadTimeInvalido       = errors.New("o lead time medio deve ser maior que zero")

	// ErrCNPJDuplicado indica outro fornecedor ja cadastrado com o mesmo CNPJ.
	ErrCNPJDuplicado = errors.New("ja existe um fornecedor com este CNPJ")
	// ErrNaoEncontrado indica fornecedor inexistente.
	ErrNaoEncontrado = errors.New("fornecedor nao encontrado")
	// ErrPossuiPedidosPendentes bloqueia a exclusao de fornecedor com pedido
	// de compra em aberto (RF1.4).
	ErrPossuiPedidosPendentes = errors.New("o fornecedor possui pedidos de compra pendentes e nao pode ser excluido")
)

// Fornecedor e a empresa que fornece as partes/pecas.
type Fornecedor struct {
	ID                int64     `json:"id"`
	RazaoSocial       string    `json:"razao_social"`
	CNPJ              string    `json:"cnpj"`
	ContatoNome       string    `json:"contato_nome"`
	ContatoEmail      string    `json:"contato_email"`
	ContatoTelefone   string    `json:"contato_telefone"`
	Endereco          string    `json:"endereco"`
	LeadTimeMedio     int       `json:"lead_time_medio"`
	CondicaoPagamento string    `json:"condicao_pagamento"`
	Ativo             bool      `json:"ativo"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
	CreatedBy         *string   `json:"created_by,omitempty"`
	UpdatedBy         *string   `json:"updated_by,omitempty"`
}

// CNPJFormatado devolve o documento pontuado para exibicao. O banco guarda
// apenas digitos (VARCHAR(14)), entao a pontuacao e sempre derivada.
func (f Fornecedor) CNPJFormatado() string {
	return documento.FormatarCNPJ(f.CNPJ)
}

// Dados sao os campos informados na criacao e na edicao.
type Dados struct {
	RazaoSocial       string
	CNPJ              string
	ContatoNome       string
	ContatoEmail      string
	ContatoTelefone   string
	Endereco          string
	LeadTimeMedio     int
	CondicaoPagamento string
	// Ativo nil significa "nao informado".
	Ativo *bool
}

// Normalizar deixa os dados na forma em que sao persistidos: documento e
// telefone so com digitos, email em minusculas, texto sem espacos nas pontas.
func (d *Dados) Normalizar() {
	d.RazaoSocial = strings.TrimSpace(d.RazaoSocial)
	d.CNPJ = documento.ApenasDigitos(d.CNPJ)
	d.ContatoNome = strings.TrimSpace(d.ContatoNome)
	d.ContatoEmail = strings.ToLower(strings.TrimSpace(d.ContatoEmail))
	d.ContatoTelefone = documento.ApenasDigitos(d.ContatoTelefone)
	d.Endereco = strings.TrimSpace(d.Endereco)
	d.CondicaoPagamento = strings.TrimSpace(d.CondicaoPagamento)
}

// Validar aplica as regras do RF1.4.
//
// Nao exige Normalizar antes: CNPJ e telefone sao conferidos pelos digitos,
// entao um valor pontuado vindo da interface passa pelas mesmas regras.
func (d Dados) Validar() error {
	if strings.TrimSpace(d.RazaoSocial) == "" {
		return ErrRazaoSocialObrigatoria
	}
	if !documento.CNPJValido(documento.ApenasDigitos(d.CNPJ)) {
		return ErrCNPJInvalido
	}
	if err := validarEmail(d.ContatoEmail); err != nil {
		return err
	}
	if err := validarTelefone(d.ContatoTelefone); err != nil {
		return err
	}
	if d.LeadTimeMedio <= 0 {
		return ErrLeadTimeInvalido
	}
	return nil
}

// validarEmail aceita o campo vazio: o RF1.4 pede o contato, mas nem todo
// fornecedor tem email — o cadastro nao pode travar por causa disso.
func validarEmail(email string) error {
	email = strings.TrimSpace(email)
	if email == "" {
		return nil
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return ErrEmailInvalido
	}
	return nil
}

// validarTelefone tambem aceita vazio, pelo mesmo motivo do email.
func validarTelefone(telefone string) error {
	digitos := documento.ApenasDigitos(telefone)
	if digitos == "" {
		return nil
	}
	if len(digitos) < digitosMinimosTelefone || len(digitos) > digitosMaximosTelefone {
		return ErrTelefoneInvalido
	}
	return nil
}
