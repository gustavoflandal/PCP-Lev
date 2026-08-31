package estrutura

import "context"

// Repositorio e a porta de persistencia da estrutura de produto.
type Repositorio interface {
	Criar(ctx context.Context, e *Estrutura, autor string) error
	BuscarPorID(ctx context.Context, id int64) (*Estrutura, error)
	ListarPorProduto(ctx context.Context, produtoAcabadoID int64) ([]Estrutura, error)
	// Versionar substitui a estrutura ativa em idAtual pela nova (que chega
	// sem ID/Versao definidos -- o repositorio calcula a proxima versao e
	// inativa a antiga, tudo numa transacao).
	Versionar(ctx context.Context, idAtual int64, nova *Estrutura, autor string) (*Estrutura, error)
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

// Versionar substitui a estrutura ativa em idAtual por uma nova versao —
// so permitido se idAtual ainda for a ativa, e se a nova vigencia comecar
// depois da vigencia atual.
func (s *Servico) Versionar(ctx context.Context, idAtual int64, dados Dados, autor string) (*Estrutura, error) {
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	atual, err := s.repo.BuscarPorID(ctx, idAtual)
	if err != nil {
		return nil, err
	}
	if !atual.Ativo {
		return nil, ErrStatusInvalidoParaAcao
	}
	if !dados.DataVigenciaInicio.After(atual.DataVigenciaInicio) {
		return nil, ErrVigenciaAnteriorAAtual
	}

	nova := &Estrutura{
		ProdutoAcabadoID:   atual.ProdutoAcabadoID,
		DataVigenciaInicio: dados.DataVigenciaInicio, DataVigenciaFim: dados.DataVigenciaFim,
		Ativo: true, Itens: calcularItens(dados.Itens),
	}
	return s.repo.Versionar(ctx, idAtual, nova, autor)
}
