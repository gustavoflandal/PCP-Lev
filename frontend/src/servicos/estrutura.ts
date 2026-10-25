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

export async function versionarEstrutura(idAtual: number, corpo: CorpoVersionarEstrutura): Promise<Estrutura> {
  const { data } = await api.post<EnvelopeItem<Estrutura>>(`/boms/${idAtual}/versionar`, corpo);
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
