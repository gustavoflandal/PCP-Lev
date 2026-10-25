// Package cliente contem o cadastro de clientes -- orgaos publicos,
// concessionarias e integradores que compram os paineis (doc 0, secao 4.1).
package cliente

import (
	"context"
	"errors"
	"net/mail"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/documento"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

// Tipos de cliente (mesmo CHECK da migration 016).
const (
	TipoOrgaoPublico   = "ORGAO_PUBLICO"
	TipoConcessionaria = "CONCESSIONARIA"
	TipoIntegrador     = "INTEGRADOR"
	TipoOutro          = "OUTRO"
)

// TiposValidos e o conjunto fechado de tipos.
var TiposValidos = []string{TipoOrgaoPublico, TipoConcessionaria, TipoIntegrador, TipoOutro}

// UFs sao as 27 siglas aceitas.
var UFs = []string{
	"AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB",
	"PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
}

// ColunasOrdenaveis restringe o `ordenar_por` da listagem.
var ColunasOrdenaveis = []string{"razao_social", "cnpj", "tipo", "cidade", "vigencia_fim", "created_at"}

var (
	ErrTipoInvalido           = errors.New("informe o tipo do cliente: orgao publico, concessionaria, integrador ou outro")
	ErrRazaoSocialObrigatoria = errors.New("a razao social e obrigatoria (ate 255 caracteres)")
	ErrCNPJInvalido           = errors.New("o CNPJ informado e invalido")
	ErrEmailInvalido          = errors.New("o email de contato e invalido")
	ErrTelefoneInvalido       = errors.New("o telefone de contato deve ter DDD e 8 ou 9 digitos")
	ErrUFInvalida             = errors.New("UF invalida")
	ErrVigenciaInvalida       = errors.New("o fim da vigencia do contrato nao pode ser antes do inicio")
	ErrCampoLongo             = errors.New("um dos campos passou do tamanho maximo")
	ErrCNPJDuplicado          = errors.New("ja existe um cliente com este CNPJ")
	ErrNaoEncontrado          = errors.New("cliente nao encontrado")
)

// Cliente e quem compra os produtos acabados.
type Cliente struct {
	ID                int64      `json:"id"`
	Tipo              string     `json:"tipo"`
	RazaoSocial       string     `json:"razao_social"`
	NomeFantasia      string     `json:"nome_fantasia"`
	CNPJ              string     `json:"cnpj"`
	InscricaoEstadual string     `json:"inscricao_estadual"`
	ContatoNome       string     `json:"contato_nome"`
	ContatoEmail      string     `json:"contato_email"`
	ContatoTelefone   string     `json:"contato_telefone"`
	Endereco          string     `json:"endereco"`
	Cidade            string     `json:"cidade"`
	UF                string     `json:"uf"`
	NumeroContrato    string     `json:"numero_contrato"`
	VigenciaInicio    tempo.Data `json:"vigencia_inicio,omitzero"`
	VigenciaFim       tempo.Data `json:"vigencia_fim,omitzero"`
	CondicaoPagamento string     `json:"condicao_pagamento"`
	Observacoes       string     `json:"observacoes"`
	Ativo             bool       `json:"ativo"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// Dados sao os campos informados na criacao e na edicao.
type Dados struct {
	Tipo              string
	RazaoSocial       string
	NomeFantasia      string
	CNPJ              string
	InscricaoEstadual string
	ContatoNome       string
	ContatoEmail      string
	ContatoTelefone   string
	Endereco          string
	Cidade            string
	UF                string
	NumeroContrato    string
	VigenciaInicio    tempo.Data
	VigenciaFim       tempo.Data
	CondicaoPagamento string
	Observacoes       string
	// Ativo nil significa "nao informado".
	Ativo *bool
}

// Normalizar deixa os dados na forma persistida.
func (d *Dados) Normalizar() {
	for _, c := range []*string{&d.RazaoSocial, &d.NomeFantasia, &d.InscricaoEstadual, &d.ContatoNome,
		&d.Endereco, &d.Cidade, &d.NumeroContrato, &d.CondicaoPagamento, &d.Observacoes} {
		*c = strings.TrimSpace(*c)
	}
	d.Tipo = strings.ToUpper(strings.TrimSpace(d.Tipo))
	d.CNPJ = documento.ApenasDigitos(d.CNPJ)
	d.ContatoEmail = strings.ToLower(strings.TrimSpace(d.ContatoEmail))
	d.ContatoTelefone = documento.ApenasDigitos(d.ContatoTelefone)
	d.UF = strings.ToUpper(strings.TrimSpace(d.UF))
}

func longo(texto string, maximo int) bool { return utf8.RuneCountInString(texto) > maximo }

// Validar aplica as regras da spec (secao 2). Espera os dados normalizados.
func (d Dados) Validar() error {
	switch {
	case !slices.Contains(TiposValidos, d.Tipo):
		return ErrTipoInvalido
	case d.RazaoSocial == "" || longo(d.RazaoSocial, 255):
		return ErrRazaoSocialObrigatoria
	case !documento.CNPJValido(d.CNPJ):
		return ErrCNPJInvalido
	case d.UF != "" && !slices.Contains(UFs, d.UF):
		return ErrUFInvalida
	case !d.VigenciaInicio.IsZero() && !d.VigenciaFim.IsZero() && d.VigenciaInicio.After(d.VigenciaFim):
		return ErrVigenciaInvalida
	case longo(d.NomeFantasia, 255), longo(d.InscricaoEstadual, 30), longo(d.ContatoNome, 100),
		longo(d.Endereco, 255), longo(d.Cidade, 100), longo(d.NumeroContrato, 60),
		longo(d.CondicaoPagamento, 50), longo(d.Observacoes, 1000):
		return ErrCampoLongo
	}
	if d.ContatoEmail != "" {
		if longo(d.ContatoEmail, 100) {
			return ErrEmailInvalido
		}
		if analisado, err := mail.ParseAddress(d.ContatoEmail); err != nil || analisado.Address != d.ContatoEmail {
			return ErrEmailInvalido
		}
	}
	if t := d.ContatoTelefone; t != "" && (len(t) < 10 || len(t) > 11) {
		return ErrTelefoneInvalido
	}
	return nil
}

// Repositorio e a porta de persistencia.
type Repositorio interface {
	Criar(ctx context.Context, d Dados, ativo bool, autor string) (*Cliente, error)
	Atualizar(ctx context.Context, id int64, d Dados, ativo bool, autor string) (*Cliente, error)
	BuscarPorID(ctx context.Context, id int64) (*Cliente, error)
	Listar(ctx context.Context, params consulta.Parametros, tipo string) ([]Cliente, int, error)
	Desativar(ctx context.Context, id int64, autor string) error
}

// Servico reune os casos de uso do cadastro de clientes.
type Servico struct {
	repo Repositorio
}

// NovoServico monta o servico.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo}
}

// Criar cadastra um cliente (ativo, salvo se informado).
func (s *Servico) Criar(ctx context.Context, d Dados, autor string) (*Cliente, error) {
	d.Normalizar()
	if err := d.Validar(); err != nil {
		return nil, err
	}
	ativo := true
	if d.Ativo != nil {
		ativo = *d.Ativo
	}
	return s.repo.Criar(ctx, d, ativo, autor)
}

// Atualizar altera um cliente; sem `ativo` informado, mantem a situacao.
func (s *Servico) Atualizar(ctx context.Context, id int64, d Dados, autor string) (*Cliente, error) {
	d.Normalizar()
	if err := d.Validar(); err != nil {
		return nil, err
	}
	atual, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	ativo := atual.Ativo
	if d.Ativo != nil {
		ativo = *d.Ativo
	}
	return s.repo.Atualizar(ctx, id, d, ativo, autor)
}

// BuscarPorID devolve um cliente.
func (s *Servico) BuscarPorID(ctx context.Context, id int64) (*Cliente, error) {
	return s.repo.BuscarPorID(ctx, id)
}

// Listar devolve uma pagina; tipo vazio = todos.
func (s *Servico) Listar(ctx context.Context, params consulta.Parametros, tipo string) ([]Cliente, int, error) {
	return s.repo.Listar(ctx, params, tipo)
}

// Excluir inativa o cliente (o historico de pedidos fica).
func (s *Servico) Excluir(ctx context.Context, id int64, autor string) error {
	return s.repo.Desativar(ctx, id, autor)
}
