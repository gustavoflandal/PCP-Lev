import { Outlet } from 'react-router-dom';
import { Toasts } from '@/componentes/ui/Toast';
import { Cabecalho } from './Cabecalho';
import { NavegacaoLateral } from './NavegacaoLateral';

/** Moldura das telas internas: cabecalho fixo, navegacao lateral e conteudo. */
export function Shell() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      <Cabecalho />

      <div className="flex flex-1">
        <NavegacaoLateral />
        <main className="min-w-0 flex-1 p-6">
          <Outlet />
        </main>
      </div>

      <Toasts />
    </div>
  );
}
