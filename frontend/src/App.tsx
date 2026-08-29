import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RotaProtegida } from '@/componentes/layout/RotaProtegida';
import { Shell } from '@/componentes/layout/Shell';
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
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}
