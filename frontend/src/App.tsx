import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RotaProtegida } from '@/componentes/layout/RotaProtegida';
import { Shell } from '@/componentes/layout/Shell';
import { Fornecedores } from '@/paginas/cadastros/Fornecedores';
import { PartesPecas } from '@/paginas/cadastros/PartesPecas';
import { ProdutosAcabados } from '@/paginas/cadastros/ProdutosAcabados';
import { Cotacoes } from '@/paginas/compras/Cotacoes';
import { DetalheCotacao } from '@/paginas/compras/DetalheCotacao';
import { DetalhePedidoCompra } from '@/paginas/compras/DetalhePedidoCompra';
import { NovaCotacao } from '@/paginas/compras/NovaCotacao';
import { NovoPedidoCompra } from '@/paginas/compras/NovoPedidoCompra';
import { PedidosCompra } from '@/paginas/compras/PedidosCompra';
import { Login } from '@/paginas/Login';
import { Painel } from '@/paginas/Painel';

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
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RotaProtegida />}>
          <Route element={<Shell />}>
            <Route path="/" element={<Painel />} />
            <Route path="/fornecedores" element={<Fornecedores />} />
            <Route path="/partes-pecas" element={<PartesPecas />} />
            <Route path="/produtos-acabados" element={<ProdutosAcabados />} />
            <Route path="/cotacoes" element={<Cotacoes />} />
            <Route path="/cotacoes/nova" element={<NovaCotacao />} />
            <Route path="/cotacoes/:id" element={<DetalheCotacao />} />
            <Route path="/pedidos-compra" element={<PedidosCompra />} />
            <Route path="/pedidos-compra/novo" element={<NovoPedidoCompra />} />
            <Route path="/pedidos-compra/:id" element={<DetalhePedidoCompra />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}
