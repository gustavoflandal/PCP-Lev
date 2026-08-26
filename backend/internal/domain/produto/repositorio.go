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
}
