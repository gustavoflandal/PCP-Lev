package necessidadecompra

import "context"

// Repositorio e a porta de leitura da necessidade de compra.
type Repositorio interface {
	Listar(ctx context.Context) ([]Item, error)
}

// Servico reune os casos de uso de necessidade de compra.
type Servico struct{ repo Repositorio }

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico { return &Servico{repo: repo} }

// Listar devolve as pecas ativas com saldo abaixo do estoque minimo.
func (s *Servico) Listar(ctx context.Context) ([]Item, error) {
	return s.repo.Listar(ctx)
}
