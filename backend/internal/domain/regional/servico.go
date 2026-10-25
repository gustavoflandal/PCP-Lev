package regional

import "context"

// Repositorio e a porta de persistencia do singleton de configuracao.
type Repositorio interface {
	Buscar(ctx context.Context) (Regional, error)
	Atualizar(ctx context.Context, dados Dados, atualizadoPor string) (Regional, error)
}

// Servico reune os casos de uso de parametros regionais.
type Servico struct{ repo Repositorio }

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico { return &Servico{repo: repo} }

// Buscar devolve a configuracao atual.
func (s *Servico) Buscar(ctx context.Context) (Regional, error) {
	return s.repo.Buscar(ctx)
}

// Atualizar valida e grava os dois campos.
func (s *Servico) Atualizar(ctx context.Context, dados Dados, atualizadoPor string) (Regional, error) {
	if err := dados.Validar(); err != nil {
		return Regional{}, err
	}
	return s.repo.Atualizar(ctx, dados, atualizadoPor)
}
