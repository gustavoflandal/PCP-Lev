package pedidocompra

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/negocio"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/dinheiro"
	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/tempo"
)

// ColunasOrdenaveis restringe o `ordenar_por` da listagem.
var ColunasOrdenaveis = []string{
	"numero_pc", "data_pedido", "data_entrega_prevista", "valor_total", "status", "created_at",
}

// StatusPermitidos restringe o `status` da listagem (consulta.AnalisarComStatus).
var StatusPermitidos = []string{
	StatusRascunho, StatusEmitido, StatusAceito, StatusAguardandoEntrega,
	StatusRecebidoParcial, StatusConcluido, StatusCancelado,
}

// statusTerminais nao aparecem em "em atraso": um pedido concluido ou
// cancelado nao gera mais cobranca de prazo.
var statusTerminais = []string{StatusConcluido, StatusCancelado}

// Repositorio e a porta de persistencia dos pedidos de compra.
type Repositorio interface {
	Criar(ctx context.Context, p *PedidoCompra, autor string) error
	Atualizar(ctx context.Context, p *PedidoCompra, autor string) error
	BuscarPorID(ctx context.Context, id int64) (*PedidoCompra, error)
	Listar(ctx context.Context, params consulta.Parametros) ([]PedidoCompra, int, error)
	AtualizarStatus(ctx context.Context, id int64, status string, autor string) error
	EmAtraso(ctx context.Context, statusTerminais []string) ([]PedidoCompra, error)
	// Encerrar fecha o pedido com saldo pendente, com motivo (v1.2, 4.3.6).
	Encerrar(ctx context.Context, id int64, motivo, autor string) error
	// ContarCotacoesRespondidas devolve, para cada peca informada, quantas
	// cotacoes Respondidas com data_emissao a partir de `desde` a incluem.
	ContarCotacoesRespondidas(ctx context.Context, pecaIDs []int64, desde, ate tempo.Data) ([]ContagemCotacoes, error)
	// Emitir grava a emissao so se o pedido ainda estiver em Rascunho com o
	// valor total conferido (ErrStatusInvalidoParaAcao caso contrario).
	Emitir(ctx context.Context, id int64, valorConferido dinheiro.Dinheiro, status, autor string) error
	ListarParaRelatorio(ctx context.Context) ([]LinhaRelatorio, error)
}

// ParametrosNegocio e a porta de leitura dos parametros de negocio (doc 0,
// secao 4.7.5) -- tolerancia de recebimento, alcada e minimo de cotacoes.
type ParametrosNegocio interface {
	Buscar(ctx context.Context) (negocio.Configuracao, error)
}

// ContagemCotacoes e quantos fornecedores distintos responderam cotacao
// recente para a peca.
type ContagemCotacoes struct {
	PartePecaID int64
	Codigo      string
	Quantidade  int
}

// janelaCotacoesDias e quantos dias para tras uma cotacao respondida conta
// para o minimo de cotacoes -- decisao provisoria da spec de parametros de
// negocio (vira parametro se o Gestor pedir).
const janelaCotacoesDias = 90

// Servico reune os casos de uso de pedidos de compra. A dependencia direta
// de *estoque.Servico (tipo concreto, nao uma interface nova) e o mesmo
// padrao de acoplamento que CotacaoHandler ja usa sobre *pedidocompra.Servico
// -- o recebimento precisa dar entrada em estoque.
type Servico struct {
	repo       Repositorio
	estoque    *estoque.Servico
	parametros ParametrosNegocio
}

// NovoServico monta o servico sobre o repositorio, o servico de estoque
// (recebimento da entrada) e os parametros de negocio (tolerancia, alcada,
// minimo de cotacoes).
func NovoServico(repo Repositorio, estoqueServico *estoque.Servico, parametros ParametrosNegocio) *Servico {
	return &Servico{repo: repo, estoque: estoqueServico, parametros: parametros}
}

func calcularItens(itens []ItemDados) ([]ItemPedido, dinheiro.Dinheiro) {
	calculados := make([]ItemPedido, len(itens))
	var total dinheiro.Dinheiro
	for i, item := range itens {
		subtotal := item.PrecoUnitario.Vezes(item.QuantidadeSolicitada)
		calculados[i] = ItemPedido{
			PartePecaID: item.PartePecaID, QuantidadeSolicitada: item.QuantidadeSolicitada,
			PrecoUnitario: item.PrecoUnitario, Total: subtotal,
		}
		total = total.Mais(subtotal)
	}
	return calculados, total
}

// Criar cadastra um novo pedido de compra em Rascunho.
func (s *Servico) Criar(ctx context.Context, dados Dados, autor string) (*PedidoCompra, error) {
	dados.Normalizar()
	if dados.DataPedido.IsZero() {
		dados.DataPedido = tempo.Hoje()
	}
	if err := dados.Validar(); err != nil {
		return nil, err
	}

	itens, total := calcularItens(dados.Itens)
	p := &PedidoCompra{
		NumeroPC:            dados.NumeroPC,
		CotacaoID:           dados.CotacaoID,
		FornecedorID:        dados.FornecedorID,
		DataPedido:          dados.DataPedido,
		DataEntregaPrevista: dados.DataEntregaPrevista,
		CondicaoPagamento:   dados.CondicaoPagamento,
		Observacoes:         dados.Observacoes,
		Status:              StatusRascunho,
		ValorTotal:          total,
		Itens:               itens,
	}

	if err := s.repo.Criar(ctx, p, autor); err != nil {
		return nil, err
	}
	return p, nil
}

// Atualizar altera um pedido de compra existente — so permitido em Rascunho.
func (s *Servico) Atualizar(ctx context.Context, id int64, dados Dados, autor string) (*PedidoCompra, error) {
	dados.Normalizar()
	if dados.DataPedido.IsZero() {
		dados.DataPedido = tempo.Hoje()
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
	atual.NumeroPC = dados.NumeroPC
	atual.FornecedorID = dados.FornecedorID
	atual.DataPedido = dados.DataPedido
	atual.DataEntregaPrevista = dados.DataEntregaPrevista
	atual.CondicaoPagamento = dados.CondicaoPagamento
	atual.Observacoes = dados.Observacoes
	atual.ValorTotal = total
	atual.Itens = itens

	if err := s.repo.Atualizar(ctx, atual, autor); err != nil {
		return nil, err
	}
	return atual, nil
}

// BuscarPorID devolve um pedido de compra especifico, com os itens.
func (s *Servico) BuscarPorID(ctx context.Context, id int64) (*PedidoCompra, error) {
	return s.repo.BuscarPorID(ctx, id)
}

// Listar devolve a pagina de pedidos de compra e o total filtrado.
func (s *Servico) Listar(ctx context.Context, params consulta.Parametros) ([]PedidoCompra, int, error) {
	return s.repo.Listar(ctx, params)
}

// ListarParaRelatorio devolve todos os pedidos de compra (sem paginacao)
// com o nome do fornecedor ja resolvido, para a exportacao CSV.
func (s *Servico) ListarParaRelatorio(ctx context.Context) ([]LinhaRelatorio, error) {
	return s.repo.ListarParaRelatorio(ctx)
}

// Emitir marca o pedido de compra como emitido e ja aguardando a entrega --
// nao existe, em nenhum requisito, um passo separado de "o fornecedor
// confirmou o aceite" (Emitido/Aceito ficam no enum por fidelidade ao CHECK
// do banco, mas inalcancaveis).
//
// Antes, aplica os parametros de negocio de Compras: a alcada (acima do
// limite, so quem tem pedidos_compra.emitir_acima_alcada emite) e o minimo de cotacoes
// respondidas por peca para pedidos a partir do valor configurado.
func (s *Servico) Emitir(ctx context.Context, id int64, autor string, podeAcimaDaAlcada bool) (*PedidoCompra, error) {
	p, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.Status != StatusRascunho {
		return nil, ErrStatusInvalidoParaAcao
	}

	cfg, err := s.parametros.Buscar(ctx)
	if err != nil {
		return nil, err
	}
	if !podeAcimaDaAlcada && !cfg.GestorPodeEmitir(p.ValorTotal) {
		return nil, ErrAcimaDaAlcada
	}
	if cfg.ExigeCotacoes(p.ValorTotal) {
		if err := s.conferirCotacoes(ctx, p, cfg.CotacoesMinimas); err != nil {
			return nil, err
		}
	}
	// Grava condicionada ao valor conferido acima: se o pedido foi editado
	// (ou emitido) por outra requisicao nesse meio-tempo, nada e gravado.
	if err := s.repo.Emitir(ctx, id, p.ValorTotal, StatusAguardandoEntrega, autor); err != nil {
		return nil, err
	}
	p.Status = StatusAguardandoEntrega
	return p, nil
}

// conferirCotacoes exige ao menos `minimo` cotacoes respondidas recentes
// para cada peca do pedido, e lista na mensagem de erro todas as que faltam
// (nao so a primeira) para o comprador resolver de uma vez.
func (s *Servico) conferirCotacoes(ctx context.Context, p *PedidoCompra, minimo int) error {
	pecaIDs := make([]int64, len(p.Itens))
	for i, item := range p.Itens {
		pecaIDs[i] = item.PartePecaID
	}
	hoje := tempo.Hoje()
	desde := tempo.Data{Time: hoje.Time.AddDate(0, 0, -janelaCotacoesDias)}
	contagens, err := s.repo.ContarCotacoesRespondidas(ctx, pecaIDs, desde, hoje)
	if err != nil {
		return err
	}

	var faltando []string
	for _, c := range contagens {
		if c.Quantidade < minimo {
			faltando = append(faltando, fmt.Sprintf("%s (%d de %d)", c.Codigo, c.Quantidade, minimo))
		}
	}
	if len(faltando) > 0 {
		return fmt.Errorf("%w nos ultimos %d dias: %s", ErrCotacoesInsuficientes, janelaCotacoesDias, strings.Join(faltando, ", "))
	}
	return nil
}

// Cancelar marca o pedido de compra como cancelado. Um pedido ja concluido
// ou ja cancelado nao pode ser cancelado de novo — RF3.3 nao preve reabrir
// um ciclo de compra encerrado.
func (s *Servico) Cancelar(ctx context.Context, id int64, autor string) error {
	p, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if p.Status == StatusCancelado || p.Status == StatusConcluido {
		return ErrStatusInvalidoParaAcao
	}
	return s.repo.AtualizarStatus(ctx, id, StatusCancelado, autor)
}

// EmAtraso devolve os pedidos com entrega vencida e ainda nao encerrados.
func (s *Servico) EmAtraso(ctx context.Context) ([]PedidoCompra, error) {
	return s.repo.EmAtraso(ctx, statusTerminais)
}

// Encerrar fecha manualmente um pedido com saldo pendente (cancelamento pelo
// fornecedor, item descontinuado, entrega a menor aceita) -- motivo
// obrigatorio. A entrada em estoque e so por nota fiscal (RN-001, v1.2).
func (s *Servico) Encerrar(ctx context.Context, id int64, motivo, autor string) error {
	motivo = strings.TrimSpace(motivo)
	if n := utf8.RuneCountInString(motivo); n < 10 || n > 255 {
		return ErrMotivoEncerramento
	}
	p, err := s.repo.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if p.Status != StatusAguardandoEntrega && p.Status != StatusRecebidoParcial {
		return ErrStatusInvalidoParaAcao
	}
	return s.repo.Encerrar(ctx, id, motivo, autor)
}
