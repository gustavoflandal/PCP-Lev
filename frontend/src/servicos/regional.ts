import { api } from './api';
import type { ConfiguracaoRegional, CorpoAtualizarRegional } from '@/tipos/regional';

interface EnvelopeItem<T> {
  dados: T;
}

/** Chave compartilhada — a tela de edição e o carregador global usam a
 * mesma, para invalidar/reconciliar o cache com uma única fonte. */
export const chaveConfiguracaoRegional = ['configuracoes', 'regional'] as const;

export async function buscarConfiguracaoRegional(): Promise<ConfiguracaoRegional> {
  const { data } = await api.get<EnvelopeItem<ConfiguracaoRegional>>('/configuracoes/regional');
  return data.dados;
}

export async function atualizarConfiguracaoRegional(corpo: CorpoAtualizarRegional): Promise<ConfiguracaoRegional> {
  const { data } = await api.put<EnvelopeItem<ConfiguracaoRegional>>('/configuracoes/regional', corpo);
  return data.dados;
}
