import { api } from './api';
import type { CorpoCriarEstrutura, CorpoVersionarEstrutura, Estrutura } from '@/tipos/estrutura';

interface EnvelopeItem<T> {
  dados: T;
}
interface EnvelopeLista<T> {
  dados: T[];
}

export async function criarEstrutura(corpo: CorpoCriarEstrutura): Promise<Estrutura> {
  const { data } = await api.post<EnvelopeItem<Estrutura>>('/boms', corpo);
  return data.dados;
}

/** Cria uma nova versao a partir da versao `idBase` (qualquer uma) e a torna a vigente. */
export async function versionarEstrutura(idBase: number, corpo: CorpoVersionarEstrutura): Promise<Estrutura> {
  const { data } = await api.post<EnvelopeItem<Estrutura>>(`/boms/${idBase}/versionar`, corpo);
  return data.dados;
}

/** Define a versao `id` como a vigente do produto, seja ela qual for. */
export async function ativarEstrutura(id: number): Promise<Estrutura> {
  const { data } = await api.post<EnvelopeItem<Estrutura>>(`/boms/${id}/ativar`);
  return data.dados;
}

export async function obterEstrutura(id: number): Promise<Estrutura> {
  const { data } = await api.get<EnvelopeItem<Estrutura>>(`/boms/${id}`);
  return data.dados;
}

export async function listarEstruturasPorProduto(produtoId: number): Promise<Estrutura[]> {
  const { data } = await api.get<EnvelopeLista<Estrutura>>(`/produtos-acabados/${produtoId}/boms`);
  return data.dados;
}
