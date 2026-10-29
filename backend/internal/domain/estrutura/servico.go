package estrutura

import "context"

// Repositorio e a porta de persistencia da estrutura de produto.
type Repositorio interface {
	Criar(ctx context.Context, e *Estrutura, autor string) error
	BuscarPorID(ctx context.Context, id int64) (*Estrutura, error)
	ListarPorProduto(ctx context.Context, produtoAcabadoID int64) ([]Estrutura, error)
	// Versionar grava a nova versao (que chega sem ID/Versao definidos -- o
	// repositorio calcula a proxima versao) e a torna a vigente, inativando
	// a que estava ativa, tudo numa transacao.
	Versionar(ctx context.Context, nova *Estrutura, autor string) (*Estrutura, error)
	// Ativar torna vigente a versao id, inativando a que estava ativa.
	Ativar(ctx context.Context, id int64, autor string) (*Estrutura, error)
}

// Servico reune os casos de uso de estrutura de produto.
type Servico struct{ repo Repositorio }

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico { return &Servico{repo: repo} }

func calcularItens(itens []ItemDados) []Item {
	calculados := make([]Item, len(itens))
	for i, item := range itens {
		calculados[i] = Item{PartePecaID: item.PartePecaID, Quantidade: item.Quantidade}
	}
	return calculados
}

// Criar cadastra a primeira versao da BOM de um produto.
func (s *Servico) Criar(ctx context.Context, dados Dados, autor string) (*Estrutura, error) {
	if err := dados.ValidarProduto(); err != nil {
		return nil, err
	}
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	e := &Estrutura{
		ProdutoAcabadoID: dados.ProdutoAcabadoID, Versao: 1,
		DataVigenciaInicio: dados.DataVigenciaInicio, DataVigenciaFim: dados.DataVigenciaFim,
		Ativo: true, Itens: calcularItens(dados.Itens),
	}
	if err := s.repo.Criar(ctx, e, autor); err != nil {
		return nil, err
	}
	return e, nil
}

func (s *Servico) BuscarPorID(ctx context.Context, id int64) (*Estrutura, error) {
	return s.repo.BuscarPorID(ctx, id)
}

func (s *Servico) ListarPorProduto(ctx context.Context, produtoAcabadoID int64) ([]Estrutura, error) {
	return s.repo.ListarPorProduto(ctx, produtoAcabadoID)
}

// Versionar cria uma nova versao a partir dos itens informados (a tela
// replica a versao de origem e o usuario ajusta) e a torna a vigente. A
// versao de origem idBase so precisa existir: pode ser qualquer uma, nao so
// a vigente.
func (s *Servico) Versionar(ctx context.Context, idBase int64, dados Dados, autor string) (*Estrutura, error) {
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	base, err := s.repo.BuscarPorID(ctx, idBase)
	if err != nil {
		return nil, err
	}

	nova := &Estrutura{
		ProdutoAcabadoID:   base.ProdutoAcabadoID,
		DataVigenciaInicio: dados.DataVigenciaInicio, DataVigenciaFim: dados.DataVigenciaFim,
		Ativo: true, Itens: calcularItens(dados.Itens),
	}
	return s.repo.Versionar(ctx, nova, autor)
}

// Ativar define qual versao e a vigente do produto, seja ela qual for. E a
// versao vigente que aparece em produtos acabados.
func (s *Servico) Ativar(ctx context.Context, id int64, autor string) (*Estrutura, error) {
	return s.repo.Ativar(ctx, id, autor)
}
