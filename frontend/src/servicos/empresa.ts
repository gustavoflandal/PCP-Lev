import { api } from './api';
import type { CorpoAtualizarEmpresa, CorpoAtualizarImagemEmpresa, DadosEmpresa } from '@/tipos/empresa';

interface EnvelopeItem<T> {
  dados: T;
}

export async function buscarDadosEmpresa(): Promise<DadosEmpresa> {
  const { data } = await api.get<EnvelopeItem<DadosEmpresa>>('/configuracoes/empresa');
  return data.dados;
}

export async function atualizarDadosEmpresa(corpo: CorpoAtualizarEmpresa): Promise<DadosEmpresa> {
  const { data } = await api.put<EnvelopeItem<DadosEmpresa>>('/configuracoes/empresa', corpo);
  return data.dados;
}

export async function atualizarLogoClaro(corpo: CorpoAtualizarImagemEmpresa): Promise<DadosEmpresa> {
  const { data } = await api.put<EnvelopeItem<DadosEmpresa>>('/configuracoes/empresa/logotipo/claro', corpo);
  return data.dados;
}

export async function atualizarLogoEscuro(corpo: CorpoAtualizarImagemEmpresa): Promise<DadosEmpresa> {
  const { data } = await api.put<EnvelopeItem<DadosEmpresa>>('/configuracoes/empresa/logotipo/escuro', corpo);
  return data.dados;
}

export async function atualizarFavicon(corpo: CorpoAtualizarImagemEmpresa): Promise<DadosEmpresa> {
  const { data } = await api.put<EnvelopeItem<DadosEmpresa>>('/configuracoes/empresa/favicon', corpo);
  return data.dados;
}

/** Monta a URL absoluta das imagens publicas -- usadas direto em <img src> e
 * <link rel="icon">, nunca via axios (nao sao JSON). */
function urlBinaria(caminho: string): string {
  const base = api.defaults.baseURL ?? '/api/v1';
  return `${base}${caminho}`;
}

export function urlLogoClaro(): string {
  return urlBinaria('/configuracoes/empresa/logotipo/claro');
}

export function urlLogoEscuro(): string {
  return urlBinaria('/configuracoes/empresa/logotipo/escuro');
}

export function urlFavicon(): string {
  return urlBinaria('/configuracoes/empresa/favicon');
}
