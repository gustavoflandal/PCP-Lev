import { api } from './api';
import type { CorpoPerfil, PerfilAcesso, PermissaoCatalogo } from '@/tipos/acesso';

interface EnvelopeItem<T> {
  dados: T;
}

export const chavePerfis = ['acesso', 'perfis'] as const;
export const chaveCatalogo = ['acesso', 'permissoes'] as const;

export async function listarPerfis(): Promise<PerfilAcesso[]> {
  const { data } = await api.get<EnvelopeItem<PerfilAcesso[]>>('/acesso/perfis');
  return data.dados;
}

export async function listarCatalogo(): Promise<PermissaoCatalogo[]> {
  const { data } = await api.get<EnvelopeItem<PermissaoCatalogo[]>>('/acesso/permissoes');
  return data.dados;
}

export async function criarPerfil(corpo: CorpoPerfil): Promise<PerfilAcesso> {
  const { data } = await api.post<EnvelopeItem<PerfilAcesso>>('/acesso/perfis', corpo);
  return data.dados;
}

export async function atualizarPerfil(codigo: string, corpo: CorpoPerfil): Promise<PerfilAcesso> {
  const { data } = await api.put<EnvelopeItem<PerfilAcesso>>(`/acesso/perfis/${encodeURIComponent(codigo)}`, corpo);
  return data.dados;
}

export async function excluirPerfil(codigo: string): Promise<void> {
  await api.delete(`/acesso/perfis/${encodeURIComponent(codigo)}`);
}
