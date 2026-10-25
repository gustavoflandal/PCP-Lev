import { api } from './api';
import type { ConfiguracaoSMTP, CorpoAtualizarSMTP } from '@/tipos/email';

interface EnvelopeItem<T> {
  dados: T;
}

export const chaveConfiguracaoSMTP = ['configuracoes', 'smtp'] as const;

export async function buscarConfiguracaoSMTP(): Promise<ConfiguracaoSMTP> {
  const { data } = await api.get<EnvelopeItem<ConfiguracaoSMTP>>('/configuracoes/smtp');
  return data.dados;
}

export async function atualizarConfiguracaoSMTP(corpo: CorpoAtualizarSMTP): Promise<ConfiguracaoSMTP> {
  const { data } = await api.put<EnvelopeItem<ConfiguracaoSMTP>>('/configuracoes/smtp', corpo);
  return data.dados;
}

/** Envia um e-mail de teste com a configuração SALVA no servidor. */
export async function enviarEmailDeTeste(destinatario: string): Promise<void> {
  await api.post('/configuracoes/smtp/testar', { destinatario });
}
