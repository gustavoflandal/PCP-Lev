import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PERIODOS_PAINEL, PERIODO_PADRAO, type PeriodoPainel } from '@/tipos/paineis';

/** Intervalos de atualizacao automatica, em segundos (0 = desligada). */
export const INTERVALOS_ATUALIZACAO = [0, 30, 60, 120, 300, 600] as const;
export type IntervaloAtualizacao = (typeof INTERVALOS_ATUALIZACAO)[number];
export const ATUALIZACAO_PADRAO: IntervaloAtualizacao = 60;

/** Rotulos dos seletores da barra de controles. */
export const ROTULO_PERIODO: Record<PeriodoPainel, string> = {
  30: 'Últimos 30 dias',
  90: 'Últimos 90 dias',
  180: 'Últimos 180 dias',
  365: 'Últimos 365 dias',
};

export const ROTULO_ATUALIZACAO: Record<IntervaloAtualizacao, string> = {
  0: 'Desligada',
  30: '30 s',
  60: '1 min',
  120: '2 min',
  300: '5 min',
  600: '10 min',
};

export interface ControlesPainel {
  dias: PeriodoPainel;
  /** Segundos entre atualizacoes; 0 = desligada. */
  atualizar: IntervaloAtualizacao;
  tv: boolean;
  definirDias: (dias: PeriodoPainel) => void;
  definirAtualizar: (segundos: IntervaloAtualizacao) => void;
  definirTV: (tv: boolean) => void;
}

function lerDe<T extends number>(valor: string | null, validos: readonly T[], padrao: T): T {
  if (valor === null || valor.trim() === '') return padrao;
  const n = Number(valor);
  return (validos as readonly number[]).includes(n) ? (n as T) : padrao;
}

/**
 * Periodo, intervalo de atualizacao e modo TV ficam no endereco
 * (`?dias=90&atualizar=60&tv=1`): a TV da fabrica abre o painel direto
 * pelo favorito, sem armazenamento local. Valor invalido cai no padrao.
 */
export function useControlesPainel(): ControlesPainel {
  const [params, definirParams] = useSearchParams();

  const alterar = useCallback(
    (chave: string, valor: string | null) => {
      definirParams(
        (anteriores) => {
          const novos = new URLSearchParams(anteriores);
          if (valor === null) novos.delete(chave);
          else novos.set(chave, valor);
          return novos;
        },
        // Trocar o periodo nao e uma navegacao: o Voltar do navegador sai
        // do painel, nao desfaz o filtro.
        { replace: true },
      );
    },
    [definirParams],
  );

  return {
    dias: lerDe(params.get('dias'), PERIODOS_PAINEL, PERIODO_PADRAO),
    atualizar: lerDe(params.get('atualizar'), INTERVALOS_ATUALIZACAO, ATUALIZACAO_PADRAO),
    tv: params.get('tv') === '1',
    definirDias: useCallback((dias: PeriodoPainel) => alterar('dias', String(dias)), [alterar]),
    definirAtualizar: useCallback((segundos: IntervaloAtualizacao) => alterar('atualizar', String(segundos)), [alterar]),
    definirTV: useCallback((tv: boolean) => alterar('tv', tv ? '1' : null), [alterar]),
  };
}
