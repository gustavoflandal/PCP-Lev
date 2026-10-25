import { Outlet } from 'react-router-dom';
import { Toasts } from '@/componentes/ui/Toast';
import { cn } from '@/lib/cn';
import { useModoTV } from '@/store/modoTV';
import { Cabecalho } from './Cabecalho';
import { CabecalhoImpressao } from './CabecalhoImpressao';
import { ConfiguracaoRegionalCarregada } from './ConfiguracaoRegionalCarregada';
import { NavegacaoLateral } from './NavegacaoLateral';
import { SessaoSincronizada } from './SessaoSincronizada';

/**
 * Moldura das telas internas: cabecalho fixo, navegacao lateral e conteudo.
 * No modo TV dos paineis, so o conteudo fica na tela.
 */
export function Shell() {
  const modoTV = useModoTV((estado) => estado.ativo);

  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      <SessaoSincronizada />
      {!modoTV && <Cabecalho />}

      <div className="flex flex-1">
        {!modoTV && <NavegacaoLateral />}
        <main className={cn('min-w-0 flex-1', modoTV ? 'p-4' : 'p-6')}>
          <CabecalhoImpressao />
          <ConfiguracaoRegionalCarregada>
            <Outlet />
          </ConfiguracaoRegionalCarregada>
        </main>
      </div>

      <Toasts />
    </div>
  );
}
