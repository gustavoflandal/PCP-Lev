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
 * Moldura das telas internas: cabecalho e moldura fixos na janela; a
 * navegacao lateral e o conteudo rolam cada um por conta propria. No papel,
 * a altura volta a ser livre para a impressao sair inteira. No modo TV dos
 * paineis, so o conteudo fica na tela.
 */
export function Shell() {
  const modoTV = useModoTV((estado) => estado.ativo);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-base print:block print:h-auto print:overflow-visible">
      <SessaoSincronizada />
      {!modoTV && <Cabecalho />}

      <div className="flex min-h-0 flex-1 print:block">
        {!modoTV && <NavegacaoLateral />}
        <main className={cn('min-w-0 flex-1 overflow-y-auto print:overflow-visible', modoTV ? 'p-4' : 'p-6')}>
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
