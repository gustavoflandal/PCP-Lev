import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AplicarBrandingEmpresa } from '@/componentes/layout/AplicarBrandingEmpresa';
import { RotaProtegida } from '@/componentes/layout/RotaProtegida';
import { Shell } from '@/componentes/layout/Shell';
import { Fornecedores } from '@/paginas/cadastros/Fornecedores';
import { PartesPecas } from '@/paginas/cadastros/PartesPecas';
import { ProdutosAcabados } from '@/paginas/cadastros/ProdutosAcabados';
import { Cotacoes } from '@/paginas/compras/Cotacoes';
import { DetalheCotacao } from '@/paginas/compras/DetalheCotacao';
import { DetalhePedidoCompra } from '@/paginas/compras/DetalhePedidoCompra';
import { NecessidadeCompra } from '@/paginas/compras/NecessidadeCompra';
import { NovaCotacao } from '@/paginas/compras/NovaCotacao';
import { NovoPedidoCompra } from '@/paginas/compras/NovoPedidoCompra';
import { PedidosCompra } from '@/paginas/compras/PedidosCompra';
import { Auditoria } from '@/paginas/configuracoes/Auditoria';
import { DadosEmpresaPagina } from '@/paginas/configuracoes/DadosEmpresa';
import { Estoque } from '@/paginas/estoque/Estoque';
import { Movimentacoes } from '@/paginas/estoque/Movimentacoes';
import { DetalheEstruturaProduto } from '@/paginas/estrutura/DetalheEstruturaProduto';
import { EstruturaProdutos } from '@/paginas/estrutura/EstruturaProdutos';
import { NovaEstruturaProduto } from '@/paginas/estrutura/NovaEstruturaProduto';
import { Login } from '@/paginas/Login';
import { Painel } from '@/paginas/Painel';
import { PreferenciasPagina } from '@/paginas/Preferencias';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Uma falha de rede na fabrica costuma ser momentanea; uma nova
      // tentativa evita mandar o operador recarregar a tela.
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AplicarBrandingEmpresa />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RotaProtegida />}>
          <Route element={<Shell />}>
            <Route path="/" element={<Painel />} />
            <Route path="/fornecedores" element={<Fornecedores />} />
            <Route path="/partes-pecas" element={<PartesPecas />} />
            <Route path="/produtos-acabados" element={<ProdutosAcabados />} />
            <Route path="/estrutura-produtos" element={<EstruturaProdutos />} />
            <Route path="/estrutura-produtos/:produtoId" element={<DetalheEstruturaProduto />} />
            <Route path="/estrutura-produtos/:produtoId/nova" element={<NovaEstruturaProduto />} />
            <Route path="/cotacoes" element={<Cotacoes />} />
            <Route path="/cotacoes/nova" element={<NovaCotacao />} />
            <Route path="/cotacoes/:id" element={<DetalheCotacao />} />
            <Route path="/pedidos-compra" element={<PedidosCompra />} />
            <Route path="/pedidos-compra/novo" element={<NovoPedidoCompra />} />
            <Route path="/pedidos-compra/:id" element={<DetalhePedidoCompra />} />
            <Route path="/necessidade-compra" element={<NecessidadeCompra />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/movimentacoes" element={<Movimentacoes />} />
            <Route path="/preferencias" element={<PreferenciasPagina />} />
            <Route path="/configuracoes/empresa" element={<DadosEmpresaPagina />} />
            <Route path="/configuracoes/auditoria" element={<Auditoria />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}
