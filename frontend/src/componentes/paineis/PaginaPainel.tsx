import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Children, type ReactNode } from 'react';
import { Botao } from '@/componentes/ui/Botao';
import { icones } from '@/componentes/ui/icones';
import { useControlesPainel } from '@/hooks/useControlesPainel';
import { useTelaModoTV } from '@/hooks/useTelaModoTV';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import { useModoTV } from '@/store/modoTV';
import { ErroApi } from '@/servicos/api';
import { BarraControles } from './BarraControles';

export interface ConteudoPainel<T> {
  /** Ausente enquanto a primeira resposta nao chega. */
  dados: T | undefined;
  carregando: boolean;
}

export interface PaginaPainelProps<T> {
  titulo: string;
  descricao: string;
  /** Setor na chave do cache (um cache por setor e periodo). */
  setor: string;
  buscar: (dias: number) => Promise<T>;
  children: (conteudo: ConteudoPainel<T>) => ReactNode;
}

function mensagemDeErro(erro: unknown): string {
  return erro instanceof ErroApi && erro.message
    ? t('Não foi possível carregar o painel: {erro}', { erro: erro.message })
    : t('Não foi possível carregar o painel. Verifique a conexão e tente de novo.');
}

/**
 * Moldura comum dos paineis de setor: titulo, barra de controles (periodo,
 * atualizacao automatica, Modo TV), a consulta ao servidor e os estados de
 * erro. O conteudo (cartoes e graficos) vem de cada tela.
 */
export function PaginaPainel<T>({ titulo, descricao, setor, buscar, children }: PaginaPainelProps<T>) {
  const controles = useControlesPainel();
  const modoTV = useTelaModoTV(controles.tv, controles.definirTV);

  const consulta = useQuery({
    queryKey: ['paineis', setor, controles.dias],
    queryFn: () => buscar(controles.dias),
    refetchInterval: controles.atualizar > 0 ? controles.atualizar * 1000 : false,
    // Trocar o periodo mantem os numeros anteriores na tela ate os novos
    // chegarem, em vez de piscar o esqueleto.
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const IconeFalha = icones['alert-triangle'];
  const semDados = consulta.data === undefined;

  return (
    <div
      className={cn(
        'mx-auto flex flex-col gap-4',
        // Modo TV: ocupa a altura da tela (o conteudo reparte o espaco entre os
        // graficos); fora dele, a pagina cresce com o conteudo.
        controles.tv ? 'h-full min-h-0 max-w-none gap-3' : 'max-w-[1400px]',
      )}
    >
      <div>
        <h1 className="text-title text-texto-primary">{titulo}</h1>
        {!controles.tv && <p className="text-body text-texto-secondary">{descricao}</p>}
      </div>

      <BarraControles
        controles={controles}
        modoTV={modoTV}
        atualizadoEm={consulta.dataUpdatedAt}
        atualizando={consulta.isFetching}
        aoAtualizar={() => void consulta.refetch()}
      />

      {consulta.isError && !semDados && (
        // Falhou uma atualizacao, mas ha numeros anteriores: continuam na
        // tela, com o aviso de que podem estar desatualizados.
        <p
          role="alert"
          className="flex items-center gap-2 rounded-campo border border-estado-warning bg-estado-warning-bg px-3 py-2 text-body text-estado-warning"
        >
          <IconeFalha size={16} aria-hidden="true" />
          {t('Não foi possível atualizar agora. Os números mostrados são os da última atualização.')}
        </p>
      )}

      {consulta.isError && semDados ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-cartao border border-borda-subtle bg-surface-raised p-4"
        >
          <p className="flex items-center gap-2 text-body text-estado-pending">
            <IconeFalha size={16} aria-hidden="true" />
            {mensagemDeErro(consulta.error)}
          </p>
          <Botao variante="secundaria" icone="refresh-cw" onClick={() => void consulta.refetch()}>
            {t('Tentar de novo')}
          </Botao>
        </div>
      ) : (
        children({ dados: consulta.data, carregando: semDados })
      )}
    </div>
  );
}

/** Grade dos cartoes de indicador. */
export function GradeIndicadores({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4">{children}</div>;
}

/**
 * Grade dos graficos: dois por linha a partir de telas medias. No modo TV,
 * as colunas se ajustam a quantidade de graficos e as linhas dividem a altura
 * que sobra na tela, para que todos aparecam sem rolagem.
 */
export function GradeGraficos({ children }: { children: ReactNode }) {
  const modoTV = useModoTV((estado) => estado.ativo);
  const quantidade = Children.toArray(children).length;
  if (!modoTV) return <div className="grid gap-4 lg:grid-cols-2">{children}</div>;

  const colunas = quantidade === 3 || quantidade >= 5 ? 'grid-cols-3' : 'grid-cols-2';
  return <div className={cn('grid min-h-0 flex-1 auto-rows-[minmax(9rem,1fr)] gap-3', colunas)}>{children}</div>;
}
