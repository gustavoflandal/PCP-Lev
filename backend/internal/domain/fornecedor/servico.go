package fornecedor

import (
	"context"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
)

// ColunasOrdenaveis restringe o `ordenar_por` da listagem.
var ColunasOrdenaveis = []string{
	"razao_social", "cnpj", "lead_time_medio", "created_at",
}

// Repositorio e a porta de persistencia do cadastro de fornecedores.
type Repositorio interface {
	Criar(ctx context.Context, f *Fornecedor, autor string) error
	Atualizar(ctx context.Context, f *Fornecedor, autor string) error
	BuscarPorID(ctx context.Context, id int64) (*Fornecedor, error)
	Listar(ctx context.Context, params consulta.Parametros) ([]Fornecedor, int, error)
	Desativar(ctx context.Context, id int64, autor string) error
	// PossuiPedidosPendentes informa se sobrou pedido de compra em aberto —
	// condicao que bloqueia a exclusao (RF1.4).
	PossuiPedidosPendentes(ctx context.Context, id int64) (bool, error)
}

// Servico reune os casos de uso do cadastro de fornecedores.
type Servico struct {
	repo Repositorio
}

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo}
}

// Criar cadastra um novo fornecedor.
func (s *Servico) Criar(ctx context.Context, dados Dados, autor string) (*Fornecedor, error) {
	dados.Normalizar()
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	ativo := true
	if dados.Ativo != nil {
		ativo = *dados.Ativo
	}

	f := &Fornecedor{
		RazaoSocial:       dados.RazaoSocial,
		CNPJ:              dados.CNPJ,
		ContatoNome:       dados.ContatoNome,
		ContatoEmail:      dados.ContatoEmail,
		ContatoTelefone:   dados.ContatoTelefone,
		Endereco:          dados.Endereco,
		LeadTimeMedio:     dados.LeadTimeMedio,
		CondicaoPagamento: dados.CondicaoPagamento,
		Ativo:             ativo,
	}

	if err := s.repo.Criar(ctx, f, autor); err != nil {
		return nil, err
	}
	return f, nil
}

// Atualizar altera um fornecedor existente.
func (s *Servico) Atualizar(ctx context.Context, id int64, dados Dados, autor string) (*Fornecedor, error) {
	dados.Normalizar()
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	f, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}

	f.RazaoSocial = dados.RazaoSocial
	f.CNPJ = dados.CNPJ
	f.ContatoNome = dados.ContatoNome
	f.ContatoEmail = dados.ContatoEmail
	f.ContatoTelefone = dados.ContatoTelefone
	f.Endereco = dados.Endereco
	f.LeadTimeMedio = dados.LeadTimeMedio
	f.CondicaoPagamento = dados.CondicaoPagamento
	if dados.Ativo != nil {
		f.Ativo = *dados.Ativo
	}

	if err := s.repo.Atualizar(ctx, f, autor); err != nil {
		return nil, err
	}
	return f, nil
}

// BuscarPorID devolve um fornecedor especifico.
func (s *Servico) BuscarPorID(ctx context.Context, id int64) (*Fornecedor, error) {
	return s.repo.BuscarPorID(ctx, id)
}

// Listar devolve a pagina de fornecedores e o total filtrado.
func (s *Servico) Listar(ctx context.Context, params consulta.Parametros) ([]Fornecedor, int, error) {
	return s.repo.Listar(ctx, params)
}

// Excluir inativa o fornecedor (soft delete).
//
// RF1.4: fornecedor com pedido de compra em aberto nao pode sair do cadastro —
// o pedido pendente ainda vai gerar recebimento e cobranca.
func (s *Servico) Excluir(ctx context.Context, id int64, autor string) error {
	if _, err := s.repo.BuscarPorID(ctx, id); err != nil {
		return err
	}

	pendente, err := s.repo.PossuiPedidosPendentes(ctx, id)
	if err != nil {
		return err
	}
	if pendente {
		return ErrPossuiPedidosPendentes
	}

	return s.repo.Desativar(ctx, id, autor)
}
