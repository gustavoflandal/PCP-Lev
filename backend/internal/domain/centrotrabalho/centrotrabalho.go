// Package centrotrabalho contem o cadastro de centros de trabalho / bancadas
// -- o recurso onde cada etapa do Kanban acontece (doc 0, secao 4.1; RN3).
package centrotrabalho

import (
	"context"
	"errors"
	"math"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
)

// Etapas fixas do Kanban (RN3), mesmo CHECK da migration 016.
const (
	EtapaSeparacao = "SEPARACAO"
	EtapaMontagem  = "MONTAGEM"
	EtapaTestes    = "TESTES"
	EtapaExpedicao = "EXPEDICAO"
)

// EtapasValidas e o conjunto fechado, na ordem do fluxo.
var EtapasValidas = []string{EtapaSeparacao, EtapaMontagem, EtapaTestes, EtapaExpedicao}

// ColunasOrdenaveis restringe o `ordenar_por` da listagem.
var ColunasOrdenaveis = []string{"codigo", "nome", "etapa", "created_at"}

var padraoCodigo = regexp.MustCompile(`^[A-Z0-9_-]{2,20}$`)

var (
	ErrCodigoInvalido     = errors.New("o codigo deve ter de 2 a 20 caracteres: letras maiusculas, numeros, hifen ou sublinhado")
	ErrNomeObrigatorio    = errors.New("informe o nome (ate 100 caracteres)")
	ErrEtapaInvalida      = errors.New("informe a etapa: separacao, montagem, testes ou expedicao")
	ErrCapacidadeInvalida = errors.New("a capacidade deve ser maior que zero e no maximo 24 horas por dia, com no maximo uma casa decimal")
	ErrDescricaoLonga     = errors.New("a descricao vai ate 255 caracteres")
	ErrCustoHoraInvalido  = errors.New("o custo por hora nao pode ser negativo")
	ErrCodigoDuplicado    = errors.New("ja existe um centro de trabalho com este codigo")
	ErrNaoEncontrado      = errors.New("centro de trabalho nao encontrado")
)

// CentroTrabalho e uma bancada ou posto produtivo.
type CentroTrabalho struct {
	ID                 int64    `json:"id"`
	Codigo             string   `json:"codigo"`
	Nome               string   `json:"nome"`
	Etapa              string   `json:"etapa"`
	CapacidadeHorasDia *float64 `json:"capacidade_horas_dia"`
	// CustoHora entra no custo real da OP (horas apontadas x custo/hora).
	CustoHora *float64  `json:"custo_hora"`
	Descricao string    `json:"descricao"`
	Ativo     bool      `json:"ativo"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Dados sao os campos informados. Codigo so vale na criacao (imutavel).
type Dados struct {
	Codigo             string
	Nome               string
	Etapa              string
	CapacidadeHorasDia *float64
	CustoHora          *float64
	// ManterCustoHora: quem edita nao ve custos -- preserva o valor atual.
	ManterCustoHora bool
	Descricao       string
	Ativo           *bool
}

// Normalizar limpa espacos; codigo e etapa em maiusculas.
func (d *Dados) Normalizar() {
	d.Codigo = strings.ToUpper(strings.TrimSpace(d.Codigo))
	d.Nome = strings.TrimSpace(d.Nome)
	d.Etapa = strings.ToUpper(strings.TrimSpace(d.Etapa))
	d.Descricao = strings.TrimSpace(d.Descricao)
}

// Validar confere a forma. checarCodigo e falso na edicao.
func (d Dados) Validar(checarCodigo bool) error {
	switch {
	case checarCodigo && !padraoCodigo.MatchString(d.Codigo):
		return ErrCodigoInvalido
	case d.Nome == "" || utf8.RuneCountInString(d.Nome) > 100:
		return ErrNomeObrigatorio
	case !slices.Contains(EtapasValidas, d.Etapa):
		return ErrEtapaInvalida
	case d.CapacidadeHorasDia != nil && !capacidadeValida(*d.CapacidadeHorasDia):
		return ErrCapacidadeInvalida
	case d.CustoHora != nil && (*d.CustoHora < 0 || *d.CustoHora > 99_999_999):
		return ErrCustoHoraInvalido
	case utf8.RuneCountInString(d.Descricao) > 255:
		return ErrDescricaoLonga
	}
	return nil
}

// capacidadeValida: (0, 24] com no maximo uma casa decimal -- o banco
// (NUMERIC(3,1)) arredondaria 7,25 para 7,3 sem aviso, e 0,04 para 0 (que
// fura o CHECK > 0 e viraria erro interno).
func capacidadeValida(x float64) bool {
	decimos := x * 10
	return x > 0 && x <= 24 && math.Abs(decimos-math.Round(decimos)) < 1e-9
}

// Repositorio e a porta de persistencia.
type Repositorio interface {
	Criar(ctx context.Context, d Dados, ativo bool, autor string) (*CentroTrabalho, error)
	Atualizar(ctx context.Context, id int64, d Dados, ativo bool, autor string) (*CentroTrabalho, error)
	BuscarPorID(ctx context.Context, id int64) (*CentroTrabalho, error)
	Listar(ctx context.Context, params consulta.Parametros, etapa string) ([]CentroTrabalho, int, error)
	Desativar(ctx context.Context, id int64, autor string) error
}

// Servico reune os casos de uso do cadastro.
type Servico struct {
	repo Repositorio
}

// NovoServico monta o servico.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo}
}

// Criar cadastra um centro de trabalho.
func (s *Servico) Criar(ctx context.Context, d Dados, autor string) (*CentroTrabalho, error) {
	d.Normalizar()
	if err := d.Validar(true); err != nil {
		return nil, err
	}
	ativo := true
	if d.Ativo != nil {
		ativo = *d.Ativo
	}
	return s.repo.Criar(ctx, d, ativo, autor)
}

// Atualizar altera nome, etapa, capacidade e descricao (o codigo nao muda).
func (s *Servico) Atualizar(ctx context.Context, id int64, d Dados, autor string) (*CentroTrabalho, error) {
	d.Normalizar()
	if err := d.Validar(false); err != nil {
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
	if d.ManterCustoHora {
		d.CustoHora = atual.CustoHora
	}
	return s.repo.Atualizar(ctx, id, d, ativo, autor)
}

// BuscarPorID devolve um centro de trabalho.
func (s *Servico) BuscarPorID(ctx context.Context, id int64) (*CentroTrabalho, error) {
	return s.repo.BuscarPorID(ctx, id)
}

// Listar devolve uma pagina; etapa vazia = todas.
func (s *Servico) Listar(ctx context.Context, params consulta.Parametros, etapa string) ([]CentroTrabalho, int, error) {
	return s.repo.Listar(ctx, params, etapa)
}

// Excluir inativa o centro de trabalho.
func (s *Servico) Excluir(ctx context.Context, id int64, autor string) error {
	return s.repo.Desativar(ctx, id, autor)
}
