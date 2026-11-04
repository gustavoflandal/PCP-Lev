import { api } from './api';
import type { ChaveApi, ChaveApiCriada, CorpoChaveApi, EndpointIntegracao } from '@/tipos/integracao';

interface EnvelopeItem<T> {
  dados: T;
}

export const chaveChavesApi = ['integracao', 'chaves'] as const;
export const chaveEndpointsApi = ['integracao', 'endpoints'] as const;

export async function listarChavesApi(): Promise<ChaveApi[]> {
  const { data } = await api.get<EnvelopeItem<ChaveApi[] | null>>('/integracao/chaves');
  return data.dados ?? [];
}

/** O segredo vem so nesta resposta: quem chama precisa mostra-lo agora. */
export async function criarChaveApi(corpo: CorpoChaveApi): Promise<ChaveApiCriada> {
  const { data } = await api.post<EnvelopeItem<ChaveApiCriada>>('/integracao/chaves', corpo);
  return data.dados;
}

export async function revogarChaveApi(id: number): Promise<void> {
  await api.delete(`/integracao/chaves/${id}`);
}

export async function listarEndpointsApi(): Promise<EndpointIntegracao[]> {
  const { data } = await api.get<EnvelopeItem<EndpointIntegracao[] | null>>('/integracao/endpoints');
  return data.dados ?? [];
}
