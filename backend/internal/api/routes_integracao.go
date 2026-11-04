package api

import (
	"github.com/gustavoflandal/pcp-lev/backend/internal/api/handlers"
	"github.com/gustavoflandal/pcp-lev/backend/internal/api/middleware"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/arquivo"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/cliente"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estoque"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/estrutura"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/fornecedor"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/integracao"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/negocio"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/peca"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidocompra"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/pedidovenda"
	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/produto"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/repository"
	"github.com/labstack/echo/v4"
)

// registrarIntegracao publica as APIs de integracao com o ERP:
//   - /api/v1/integracao/*: gestao das chaves e documentacao (JWT + permissao);
//   - /api/integracao/v1/*: consulta somente leitura, autenticada por chave
//     (X-API-Key). Fica fora do grupo /api/v1 de proposito: o ERP nao tem
//     sessao de usuario.
func registrarIntegracao(e *echo.Echo, v1 *echo.Group, dep Dependencias, autenticacao echo.MiddlewareFunc,
	estoqueServico *estoque.Servico, arquivos *arquivo.Servico) {
	chaves := integracao.NovoServico(repository.NovoIntegracaoRepositorio(dep.Pool))
	handlers.NovoIntegracaoHandler(chaves).Registrar(v1, autenticacao)

	pedidoCompra := pedidocompra.NovoServico(repository.NovoPedidoCompraRepositorio(dep.Pool), estoqueServico,
		negocio.NovoServico(repository.NovoNegocioRepositorio(dep.Pool)))
	handlers.NovoIntegracaoPublicaHandler(handlers.ServicosIntegracao{
		Clientes:      cliente.NovoServico(repository.NovoClienteRepositorio(dep.Pool)),
		Fornecedores:  fornecedor.NovoServico(repository.NovoFornecedorRepositorio(dep.Pool)),
		Produtos:      produto.NovoServico(repository.NovoProdutoRepositorio(dep.Pool)),
		Pecas:         peca.NovoServico(repository.NovoPecaRepositorio(dep.Pool)),
		Estoque:       estoqueServico,
		PedidosVenda:  pedidovenda.NovoServico(repository.NovoPedidoVendaRepositorio(dep.Pool)),
		PedidosCompra: pedidoCompra,
		Estruturas:    estrutura.NovoServico(repository.NovoEstruturaRepositorio(dep.Pool)),
		Arquivos:      arquivos,
	}).Registrar(e, middleware.AutenticacaoPorChave(chaves))
}
