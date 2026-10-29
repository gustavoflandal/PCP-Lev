import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { Campo } from './Campo';
import { Selecao } from './Selecao';

export interface BarraDeFiltrosProps {
  busca: string;
  aoBuscar: (texto: string) => void;
  /** Rotulo especifico da tela: diz por quais campos a busca procura. */
  rotuloBusca: string;
  filtroAtivo: boolean | null;
  aoFiltrarSituacao: (valor: boolean | null) => void;
  /** Filtros proprios da tela (tipo, etapa...), exibidos depois da situacao. */
  filtrosExtras?: ReactNode;
  /** Acao principal da tela, alinhada a direita. */
  children?: ReactNode;
}

const opcoesSituacao = () => [
  { valor: 'ativos', rotulo: t('Ativos') },
  { valor: 'inativos', rotulo: t('Inativos') },
  { valor: 'todos', rotulo: t('Todos') },
];

function paraValor(filtroAtivo: boolean | null): string {
  if (filtroAtivo === null) return 'todos';
  return filtroAtivo ? 'ativos' : 'inativos';
}

function paraFiltro(valor: string): boolean | null {
  if (valor === 'todos') return null;
  return valor === 'ativos';
}

/**
 * Filtros da listagem. A situacao comeca em "Ativos" porque o cadastro
 * inativo e historico: quem abre a tela quer trabalhar com o que esta em uso.
 */
export function BarraDeFiltros({
  busca,
  aoBuscar,
  rotuloBusca,
  filtroAtivo,
  aoFiltrarSituacao,
  filtrosExtras,
  children,
}: BarraDeFiltrosProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-[320px] max-w-full">
          <Campo
            rotulo={rotuloBusca}
            value={busca}
            onChange={(evento) => aoBuscar(evento.target.value)}
            placeholder={t('Digite para filtrar')}
          />
        </div>

        <div className="w-[160px]">
          <Selecao
            rotulo={t('Situação')}
            opcoes={opcoesSituacao()}
            value={paraValor(filtroAtivo)}
            onChange={(evento) => aoFiltrarSituacao(paraFiltro(evento.target.value))}
          />
        </div>

        {filtrosExtras}
      </div>

      {children}
    </div>
  );
}
