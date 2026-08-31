package estoque

import (
	"context"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
)

// ColunasOrdenaveis restringe o `ordenar_por` da listagem de saldo.
var ColunasOrdenaveis = []string{"codigo", "quantidade_atual", "status", "updated_at"}

// StatusPermitidos restringe o filtro `status` (consulta.AnalisarComStatus).
// BLOQUEADO entra na lista por fidelidade ao CHECK do banco, mesmo
// inalcançavel nesta sprint -- um filtro que nunca traz resultado nao e o
// mesmo que um filtro invalido.
var StatusPermitidos = []string{StatusOK, StatusCritico, StatusBloqueado}

// Repositorio e a porta de persistencia do estoque.
type Repositorio interface {
	BuscarSaldo(ctx context.Context, partePecaID int64) (*Saldo, error)
	ListarSaldo(ctx context.Context, params consulta.Parametros) ([]Saldo, int, error)
	ListarCriticos(ctx context.Context) ([]Saldo, error)
	ListarMovimentacoes(ctx context.Context, params consulta.Parametros) ([]Movimentacao, int, error)
	BuscarMovimentacao(ctx context.Context, id int64) (*Movimentacao, error)
	// AplicarMovimento grava uma movimentacao e ajusta o saldo dentro de
	// uma unica transacao, recalculando o status (OK/CRITICO) contra o
	// estoque_minimo da peca. delta pode ser negativo (ajuste de saida).
	AplicarMovimento(ctx context.Context, partePecaID int64, delta int, tipo, motivo string, referencia *string, observacoes, autor string) (*Saldo, error)
}

// Servico reune os casos de uso de estoque.
type Servico struct {
	repo Repositorio
}

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo}
}

func (s *Servico) BuscarSaldo(ctx context.Context, partePecaID int64) (*Saldo, error) {
	return s.repo.BuscarSaldo(ctx, partePecaID)
}

func (s *Servico) ListarSaldo(ctx context.Context, params consulta.Parametros) ([]Saldo, int, error) {
	return s.repo.ListarSaldo(ctx, params)
}

func (s *Servico) ListarCriticos(ctx context.Context) ([]Saldo, error) {
	return s.repo.ListarCriticos(ctx)
}

func (s *Servico) ListarMovimentacoes(ctx context.Context, params consulta.Parametros) ([]Movimentacao, int, error) {
	return s.repo.ListarMovimentacoes(ctx, params)
}

func (s *Servico) BuscarMovimentacao(ctx context.Context, id int64) (*Movimentacao, error) {
	return s.repo.BuscarMovimentacao(ctx, id)
}

// Ajustar registra um ajuste manual de estoque (RF2.1).
func (s *Servico) Ajustar(ctx context.Context, dados AjusteDados, autor string) (*Saldo, error) {
	dados.Normalizar()
	if err := dados.Validar(); err != nil {
		return nil, err
	}
	return s.repo.AplicarMovimento(ctx, dados.PartePecaID, dados.Quantidade, TipoAjuste, MotivoAjuste, nil, dados.Observacoes, autor)
}

// AplicarMovimento e o ponto de entrada usado por quem nao e um ajuste
// manual -- hoje so pedidocompra.Servico.RegistrarRecebimento, via
// dependencia direta deste *Servico (mesmo padrao de acoplamento concreto
// que CotacaoHandler ja usa sobre *pedidocompra.Servico).
func (s *Servico) AplicarMovimento(ctx context.Context, partePecaID int64, delta int, tipo, motivo string, referencia *string, observacoes, autor string) (*Saldo, error) {
	return s.repo.AplicarMovimento(ctx, partePecaID, delta, tipo, motivo, referencia, observacoes, autor)
}
