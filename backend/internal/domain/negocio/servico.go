package negocio

import "context"

// Repositorio e a porta de persistencia do singleton de configuracao.
type Repositorio interface {
	Buscar(ctx context.Context) (Configuracao, error)
	Atualizar(ctx context.Context, dados Dados, atualizadoPor string) (Configuracao, error)
}

// Servico reune os casos de uso de parametros de negocio.
type Servico struct{ repo Repositorio }

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico { return &Servico{repo: repo} }

// Buscar devolve a configuracao atual.
func (s *Servico) Buscar(ctx context.Context) (Configuracao, error) {
	return s.repo.Buscar(ctx)
}

// Atualizar valida e grava a configuracao inteira.
func (s *Servico) Atualizar(ctx context.Context, dados Dados, atualizadoPor string) (Configuracao, error) {
	if dados.DivergenciaPrecoAcao == "" {
		// Cliente anterior a v1.2 (sem o campo): mantem o comportamento padrao.
		dados.DivergenciaPrecoAcao = "BLOQUEAR"
	}
	if err := dados.Validar(); err != nil {
		return Configuracao{}, err
	}
	return s.repo.Atualizar(ctx, dados, atualizadoPor)
}
