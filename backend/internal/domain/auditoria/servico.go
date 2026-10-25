package auditoria

import "context"

// Repositorio e a porta de leitura da trilha de auditoria.
type Repositorio interface {
	Listar(ctx context.Context, filtros Filtros) ([]Registro, int, error)
	ListarParaExportar(ctx context.Context, filtros Filtros) ([]Registro, error)
}

// Servico reune os casos de uso de consulta da auditoria.
type Servico struct{ repo Repositorio }

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico { return &Servico{repo: repo} }

// Listar valida os filtros e devolve a pagina de registros mais o total.
func (s *Servico) Listar(ctx context.Context, filtros Filtros) ([]Registro, int, error) {
	if err := filtros.Validar(); err != nil {
		return nil, 0, err
	}
	return s.repo.Listar(ctx, filtros)
}

// ListarParaExportar e como Listar, mas sem paginacao -- usado pelo CSV.
func (s *Servico) ListarParaExportar(ctx context.Context, filtros Filtros) ([]Registro, error) {
	if err := filtros.Validar(); err != nil {
		return nil, err
	}
	return s.repo.ListarParaExportar(ctx, filtros)
}
