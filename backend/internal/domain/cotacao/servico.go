package cotacao

import (
	"context"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

// ColunasOrdenaveis restringe o `ordenar_por` da listagem.
var ColunasOrdenaveis = []string{
	"numero_cotacao", "data_emissao", "data_validade", "valor_total", "status", "created_at",
}

// StatusPermitidos restringe o `status` da listagem (consulta.AnalisarComStatus).
var StatusPermitidos = []string{StatusRascunho, StatusEnviada, StatusRespondida, StatusCancelada}

// RespostaDados sao os dados informados ao registrar a resposta do
// fornecedor. Apenas PartePecaID e PrecoUnitario de cada item sao usados —
// quantidade nao muda numa resposta de cotacao.
type RespostaDados struct {
	DataResposta tempo.Data
	Itens        []ItemDados
}

// Repositorio e a porta de persistencia das cotacoes.
type Repositorio interface {
	Criar(ctx context.Context, c *Cotacao, autor string) error
	Atualizar(ctx context.Context, c *Cotacao, autor string) error
	BuscarPorID(ctx context.Context, id int64) (*Cotacao, error)
	Listar(ctx context.Context, params consulta.Parametros) ([]Cotacao, int, error)
	AtualizarStatus(ctx context.Context, id int64, status string, autor string) error
	RegistrarResposta(ctx context.Context, id int64, resposta RespostaDados, autor string) (*Cotacao, error)
}

// Servico reune os casos de uso de cotacoes.
type Servico struct {
	repo Repositorio
}

// NovoServico monta o servico sobre o repositorio informado.
func NovoServico(repo Repositorio) *Servico {
	return &Servico{repo: repo}
}

func calcularItens(itens []ItemDados) ([]ItemCotacao, dinheiro.Dinheiro) {
	calculados := make([]ItemCotacao, len(itens))
	var total dinheiro.Dinheiro
	for i, item := range itens {
		subtotal := item.PrecoUnitario.Vezes(item.Quantidade)
		calculados[i] = ItemCotacao{
			PartePecaID: item.PartePecaID, Quantidade: item.Quantidade,
			PrecoUnitario: item.PrecoUnitario, Total: subtotal,
		}
		total = total.Mais(subtotal)
	}
	return calculados, total
}

// Criar cadastra uma nova cotacao em Rascunho.
func (s *Servico) Criar(ctx context.Context, dados Dados, autor string) (*Cotacao, error) {
	dados.Normalizar()
	if dados.DataEmissao.IsZero() {
		dados.DataEmissao = tempo.Hoje()
	}
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	itens, total := calcularItens(dados.Itens)
	c := &Cotacao{
		NumeroCotacao: dados.NumeroCotacao,
		FornecedorID:  dados.FornecedorID,
		DataEmissao:   dados.DataEmissao,
		DataValidade:  dados.DataValidade,
		Observacoes:   dados.Observacoes,
		Status:        StatusRascunho,
		ValorTotal:    total,
		Itens:         itens,
	}

	if err := s.repo.Criar(ctx, c, autor); err != nil {
		return nil, err
	}
	return c, nil
}

// Atualizar altera uma cotacao existente — so permitido em Rascunho: uma vez
// enviada, a interacao com o fornecedor passa por RegistrarResposta, nao por
// edicao livre.
func (s *Servico) Atualizar(ctx context.Context, id int64, dados Dados, autor string) (*Cotacao, error) {
	dados.Normalizar()
	if dados.DataEmissao.IsZero() {
		dados.DataEmissao = tempo.Hoje()
	}
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	atual, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if atual.Status != StatusRascunho {
		return nil, ErrStatusInvalidoParaAcao
	}

	itens, total := calcularItens(dados.Itens)
	atual.NumeroCotacao = dados.NumeroCotacao
	atual.FornecedorID = dados.FornecedorID
	atual.DataEmissao = dados.DataEmissao
	atual.DataValidade = dados.DataValidade
	atual.Observacoes = dados.Observacoes
	atual.ValorTotal = total
	atual.Itens = itens

	if err := s.repo.Atualizar(ctx, atual, autor); err != nil {
		return nil, err
	}
	return atual, nil
}

// BuscarPorID devolve uma cotacao especifica, com os itens.
func (s *Servico) BuscarPorID(ctx context.Context, id int64) (*Cotacao, error) {
	return s.repo.BuscarPorID(ctx, id)
}

// Listar devolve a pagina de cotacoes e o total filtrado.
func (s *Servico) Listar(ctx context.Context, params consulta.Parametros) ([]Cotacao, int, error) {
	return s.repo.Listar(ctx, params)
}

// Enviar marca a cotacao como enviada ao fornecedor.
func (s *Servico) Enviar(ctx context.Context, id int64, autor string) (*Cotacao, error) {
	c, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if c.Status != StatusRascunho {
		return nil, ErrStatusInvalidoParaAcao
	}
	if err := s.repo.AtualizarStatus(ctx, id, StatusEnviada, autor); err != nil {
		return nil, err
	}
	c.Status = StatusEnviada
	return c, nil
}

// RegistrarResposta atualiza o preco de cada item com o que o fornecedor
// respondeu, recalcula o valor total e marca a cotacao como respondida.
func (s *Servico) RegistrarResposta(ctx context.Context, id int64, resposta RespostaDados, autor string) (*Cotacao, error) {
	c, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if c.Status != StatusEnviada {
		return nil, ErrStatusInvalidoParaAcao
	}
	for _, item := range resposta.Itens {
		if !item.PrecoUnitario.Positivo() {
			return nil, ErrPrecoInvalido
		}
	}
	if resposta.DataResposta.IsZero() {
		resposta.DataResposta = tempo.Hoje()
	}
	return s.repo.RegistrarResposta(ctx, id, resposta, autor)
}

// Cancelar marca a cotacao como cancelada. Idempotente: cancelar uma cotacao
// ja cancelada e um erro, nao um no-op silencioso — evita mascarar um clique
// duplo que a pessoa nao percebeu.
func (s *Servico) Cancelar(ctx context.Context, id int64, autor string) error {
	c, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if c.Status == StatusCancelada {
		return ErrStatusInvalidoParaAcao
	}
	return s.repo.AtualizarStatus(ctx, id, StatusCancelada, autor)
}
