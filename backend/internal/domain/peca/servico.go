package peca

import (
	"context"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
)

// ColunasOrdenaveis restringe o `ordenar_por` da listagem.
var ColunasOrdenaveis = []string{
	"codigo", "descricao", "estoque_minimo", "estoque_maximo", "lead_time_compra", "created_at",
}

// Repositorio e a porta de persistencia do cadastro de partes/pecas.
type Repositorio interface {
	Criar(ctx context.Context, p *PartePeca, autor string) error
	Atualizar(ctx context.Context, p *PartePeca, autor string) error
	BuscarPorID(ctx context.Context, id int64) (*PartePeca, error)
	Listar(ctx context.Context, params consulta.Parametros) ([]PartePeca, int, error)
	Desativar(ctx context.Context, id int64, autor string) error
	// PossuiMovimentacao informa se a peca ja teve entrada ou saida de
	// estoque — condicao que bloqueia a exclusao (RF1.2).
	PossuiMovimentacao(ctx context.Context, id int64) (bool, error)
}

// Servico reune os casos de uso do cadastro de partes/pecas.
type Servico struct {
	repo Repositorio
}

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo}
}

// Criar cadastra uma nova parte/peca.
func (s *Servico) Criar(ctx context.Context, dados Dados, autor string) (*PartePeca, error) {
	dados.Normalizar()
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	ativo := true
	if dados.Ativo != nil {
		ativo = *dados.Ativo
	}

	p := &PartePeca{
		Codigo:             dados.Codigo,
		Descricao:          dados.Descricao,
		UnidadeMedida:      dados.UnidadeMedida,
		EstoqueMinimo:      dados.EstoqueMinimo,
		EstoqueMaximo:      dados.EstoqueMaximo,
		FornecedorPadraoID: dados.FornecedorPadraoID,
		LeadTimeCompra:     dados.LeadTimeCompra,
		Ativo:              ativo,
	}

	if err := s.repo.Criar(ctx, p, autor); err != nil {
		return nil, err
	}
	return p, nil
}

// Atualizar altera uma parte/peca existente.
func (s *Servico) Atualizar(ctx context.Context, id int64, dados Dados, autor string) (*PartePeca, error) {
	dados.Normalizar()
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	p, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}

	p.Codigo = dados.Codigo
	p.Descricao = dados.Descricao
	p.UnidadeMedida = dados.UnidadeMedida
	p.EstoqueMinimo = dados.EstoqueMinimo
	p.EstoqueMaximo = dados.EstoqueMaximo
	p.FornecedorPadraoID = dados.FornecedorPadraoID
	p.LeadTimeCompra = dados.LeadTimeCompra
	if dados.Ativo != nil {
		p.Ativo = *dados.Ativo
	}

	if err := s.repo.Atualizar(ctx, p, autor); err != nil {
		return nil, err
	}
	return p, nil
}

// BuscarPorID devolve uma parte/peca especifica.
func (s *Servico) BuscarPorID(ctx context.Context, id int64) (*PartePeca, error) {
	return s.repo.BuscarPorID(ctx, id)
}

// Listar devolve a pagina de partes/pecas e o total filtrado.
func (s *Servico) Listar(ctx context.Context, params consulta.Parametros) ([]PartePeca, int, error) {
	return s.repo.Listar(ctx, params)
}

// Excluir inativa a peca (soft delete).
//
// RF1.2: peca com historico de movimentacao nao pode ser excluida — o
// rastreamento do estoque depende do cadastro que originou cada lancamento.
func (s *Servico) Excluir(ctx context.Context, id int64, autor string) error {
	if _, err := s.repo.BuscarPorID(ctx, id); err != nil {
		return err
	}

	movimentada, err := s.repo.PossuiMovimentacao(ctx, id)
	if err != nil {
		return err
	}
	if movimentada {
		return ErrPossuiMovimentacao
	}

	return s.repo.Desativar(ctx, id, autor)
}
