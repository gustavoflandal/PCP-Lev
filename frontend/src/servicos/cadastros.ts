import { api } from './api';
import type { DadosPaginacao, Pagina, ParametrosListagem, Recurso } from '@/tipos/cadastros';

interface EnvelopeLista<T> {
  dados: T[];
  paginacao: DadosPaginacao;
}

interface EnvelopeItem<T> {
  dados: T;
}

/**
 * Monta a query string. Busca vazia e filtro nulo sao omitidos: enviar
 * `busca=` faria o backend filtrar por string vazia sem necessidade.
 */
export function paramsDeConsulta(
  params: ParametrosListagem,
): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {
    pagina: params.pagina,
    limite: params.limite,
    ordenar_por: params.ordenar_por,
    ordem: params.ordem,
  };

  if (params.busca.trim() !== '') {
    query.busca = params.busca.trim();
  }
  if (params.filtro_ativo !== null) {
    query.filtro_ativo = params.filtro_ativo;
  }
  return query;
}

export async function listar<T>(recurso: Recurso, params: ParametrosListagem): Promise<Pagina<T>> {
  const { data } = await api.get<EnvelopeLista<T>>(`/${recurso}`, {
    params: paramsDeConsulta(params),
  });
  return { itens: data.dados, paginacao: data.paginacao };
}

export async function obter<T>(recurso: Recurso, id: number): Promise<T> {
  const { data } = await api.get<EnvelopeItem<T>>(`/${recurso}/${id}`);
  return data.dados;
}

export async function criar<T>(recurso: Recurso, corpo: unknown): Promise<T> {
  const { data } = await api.post<EnvelopeItem<T>>(`/${recurso}`, corpo);
  return data.dados;
}

export async function atualizar<T>(recurso: Recurso, id: number, corpo: unknown): Promise<T> {
  const { data } = await api.put<EnvelopeItem<T>>(`/${recurso}/${id}`, corpo);
  return data.dados;
}

export async function excluir(recurso: Recurso, id: number): Promise<void> {
  await api.delete(`/${recurso}/${id}`);
}
