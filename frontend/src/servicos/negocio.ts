import { api } from './api';
import type { ConfiguracaoNegocio, DadosNegocio } from '@/tipos/negocio';

interface EnvelopeItem<T> {
  dados: T;
}

/** Chave compartilhada — a tela de edição e os formulários de cadastro (lead
 * time padrão) leem do mesmo cache. */
export const chaveParametrosNegocio = ['configuracoes', 'negocio'] as const;

export async function buscarParametrosNegocio(): Promise<ConfiguracaoNegocio> {
  const { data } = await api.get<EnvelopeItem<ConfiguracaoNegocio>>('/configuracoes/negocio');
  return data.dados;
}

export async function atualizarParametrosNegocio(corpo: DadosNegocio): Promise<ConfiguracaoNegocio> {
  const { data } = await api.put<EnvelopeItem<ConfiguracaoNegocio>>('/configuracoes/negocio', corpo);
  return data.dados;
}
