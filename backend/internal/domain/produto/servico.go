package produto

import (
	"context"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
)

// ColunasOrdenaveis restringe o `ordenar_por` da listagem. Campos de auditoria
// ficam de fora: nao interessam ao operador e ampliariam a superficie exposta.
var ColunasOrdenaveis = []string{"codigo", "descricao", "preco_venda", "lead_time_producao", "created_at"}

// Servico reune os casos de uso do cadastro de produtos acabados.
type Servico struct {
	repo Repositorio
}

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo}
}

// Criar cadastra um novo produto acabado.
func (s *Servico) Criar(ctx context.Context, dados Dados, autor string) (*ProdutoAcabado, error) {
	dados.Normalizar()
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	ativo := true
	if dados.Ativo != nil {
		ativo = *dados.Ativo
	}

	p := &ProdutoAcabado{
		Codigo:           dados.Codigo,
		Descricao:        dados.Descricao,
		UnidadeMedida:    dados.UnidadeMedida,
		PrecoVenda:       dados.PrecoVenda,
		LeadTimeProducao: dados.LeadTimeProducao,
		Ativo:            ativo,
	}

	if err := s.repo.Criar(ctx, p, autor); err != nil {
		return nil, err
	}
	return p, nil
}

// Atualizar altera um produto existente.
func (s *Servico) Atualizar(ctx context.Context, id int64, dados Dados, autor string) (*ProdutoAcabado, error) {
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
	p.PrecoVenda = dados.PrecoVenda
	p.LeadTimeProducao = dados.LeadTimeProducao
	if dados.Ativo != nil {
		p.Ativo = *dados.Ativo
	}

	if err := s.repo.Atualizar(ctx, p, autor); err != nil {
		return nil, err
	}
	return p, nil
}

// BuscarPorID devolve um produto especifico.
func (s *Servico) BuscarPorID(ctx context.Context, id int64) (*ProdutoAcabado, error) {
	return s.repo.BuscarPorID(ctx, id)
}

// Listar devolve a pagina de produtos e o total de registros filtrados.
func (s *Servico) Listar(ctx context.Context, params consulta.Parametros) ([]ProdutoAcabado, int, error) {
	return s.repo.Listar(ctx, params)
}

// Excluir inativa o produto (soft delete).
//
// RF1.1: produto com historico de vendas nao pode ser excluido — os pedidos
// antigos precisam continuar legiveis com o cadastro que os originou.
func (s *Servico) Excluir(ctx context.Context, id int64, autor string) error {
	if _, err := s.repo.BuscarPorID(ctx, id); err != nil {
		return err
	}

	possuiVendas, err := s.repo.PossuiVendas(ctx, id)
	if err != nil {
		return err
	}
	if possuiVendas {
		return ErrPossuiVendas
	}

	return s.repo.Desativar(ctx, id, autor)
}
