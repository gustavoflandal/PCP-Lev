package produto

import (
	"context"

	"github.com/gustavoflandal/pcp-lev/backend/internal/platform/consulta"
)

// Repositorio e a porta de persistencia do cadastro de produtos acabados.
type Repositorio interface {
	Criar(ctx context.Context, p *ProdutoAcabado, autor string) error
	Atualizar(ctx context.Context, p *ProdutoAcabado, autor string) error
	BuscarPorID(ctx context.Context, id int64) (*ProdutoAcabado, error)
	Listar(ctx context.Context, params consulta.Parametros) ([]ProdutoAcabado, int, error)
	Desativar(ctx context.Context, id int64, autor string) error
	// PossuiVendas informa se ha itens de pedido de venda referenciando o
	// produto — condicao que bloqueia a exclusao (RF1.1).
	PossuiVendas(ctx context.Context, id int64) (bool, error)

	// CriarOuReativarEspelho cria (ou reativa, se ja existia inativo) o registro
	// espelho em partes_pecas para um produto com pode_ser_componente=true.
	CriarOuReativarEspelho(ctx context.Context, p *ProdutoAcabado, autor string) error
	// SincronizarEspelho atualiza codigo, descricao e unidade_medida do espelho.
	SincronizarEspelho(ctx context.Context, p *ProdutoAcabado, autor string) error
	// DesativarEspelho desativa (soft delete) a parte/peca espelho do produto.
	DesativarEspelho(ctx context.Context, produtoID int64, autor string) error
	// EspelhoEmUsoBOM informa se o espelho esta referenciado em alguma BOM ativa.
	EspelhoEmUsoBOM(ctx context.Context, produtoID int64) (bool, error)
}
