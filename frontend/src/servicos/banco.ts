import { api } from './api';
import type { StatusBanco, TesteConexao } from '@/tipos/banco';

interface EnvelopeItem<T> {
  dados: T;
}

export const chaveStatusBanco = ['configuracoes', 'banco'] as const;

export async function buscarStatusBanco(): Promise<StatusBanco> {
  const { data } = await api.get<EnvelopeItem<StatusBanco>>('/configuracoes/banco');
  return data.dados;
}

export async function testarConexaoBanco(): Promise<TesteConexao> {
  const { data } = await api.post<EnvelopeItem<TesteConexao>>('/configuracoes/banco/testar');
  return data.dados;
}
