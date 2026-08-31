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

/**
 * Monta a URL absoluta das imagens publicas -- usadas direto em <img src> e
 * <link rel="icon">, nunca via axios (nao sao JSON).
 *
 * `versao` (o `updated_at` da empresa) vira query string: a URL em si nunca
 * muda quando o admin troca o logo, entao sem isso o navegador manteria a
 * imagem antiga em cache (o <img> so refaz a requisicao quando o `src`
 * muda de valor). Omitir `versao` serve para o unico caso em que o valor
 * ainda nao chegou (primeiro paint, antes do GET /configuracoes/empresa
 * responder) -- o proprio hook de dados so libera a URL quando ja tem
 * `tem_logo_*`, entao a falta de versao nesse instante e inofensiva.
 */
function urlBinaria(caminho: string, versao?: string): string {
  const base = api.defaults.baseURL ?? '/api/v1';
  const query = versao ? `?v=${encodeURIComponent(versao)}` : '';
  return `${base}${caminho}${query}`;
}

export function urlLogoClaro(versao?: string): string {
  return urlBinaria('/configuracoes/empresa/logotipo/claro', versao);
}

export function urlLogoEscuro(versao?: string): string {
  return urlBinaria('/configuracoes/empresa/logotipo/escuro', versao);
}

export function urlFavicon(versao?: string): string {
  return urlBinaria('/configuracoes/empresa/favicon', versao);
}
