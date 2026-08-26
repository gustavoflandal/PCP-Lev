import { Outlet } from 'react-router-dom';
import { Cabecalho } from './Cabecalho';

/** Moldura das telas internas: cabecalho fixo e area de conteudo. */
export function Shell() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      <Cabecalho />
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
