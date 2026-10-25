import { api } from './api';
import type { PerfilAcesso, PermissaoCatalogo } from '@/tipos/acesso';
import type { DadosPaginacao, Pagina } from '@/tipos/cadastros';
import type { CorpoUsuario, FiltrosUsuarios, PermissoesDoUsuario, SituacaoUsuario, Usuario } from '@/tipos/usuarios';

interface EnvelopeLista<T> {
  dados: T[];
  paginacao: DadosPaginacao;
}

interface EnvelopeItem<T> {
  dados: T;
}

export const LIMITE_USUARIOS = 20;
export const chaveUsuarios = ['usuarios'] as const;
export const chaveOpcoesUsuarios = ['usuarios', 'opcoes'] as const;

export interface OpcoesUsuarios {
  perfis: PerfilAcesso[];
  permissoes: PermissaoCatalogo[];
}

/** Perfis (com as permissoes) e catalogo -- sem exigir configuracoes.perfis. */
export async function obterOpcoesUsuarios(): Promise<OpcoesUsuarios> {
  const { data } = await api.get<EnvelopeItem<OpcoesUsuarios>>('/usuarios/opcoes');
  return data.dados;
}

export async function listarUsuarios(filtros: FiltrosUsuarios): Promise<Pagina<Usuario>> {
  const params: Record<string, string | number> = {
    pagina: filtros.pagina,
    limite: LIMITE_USUARIOS,
    ordenar_por: filtros.ordenar_por,
    ordem: filtros.ordem,
  };
  if (filtros.busca.trim()) params.busca = filtros.busca.trim();
  if (filtros.perfil) params.perfil = filtros.perfil;
  if (filtros.situacao) params.status = filtros.situacao;
  const { data } = await api.get<EnvelopeLista<Usuario>>('/usuarios', { params });
  return { itens: data.dados, paginacao: data.paginacao };
}

export async function criarUsuario(corpo: CorpoUsuario): Promise<Usuario> {
  const { data } = await api.post<EnvelopeItem<Usuario>>('/usuarios', corpo);
  return data.dados;
}

export async function atualizarUsuario(id: number, corpo: CorpoUsuario): Promise<Usuario> {
  const { data } = await api.put<EnvelopeItem<Usuario>>(`/usuarios/${id}`, corpo);
  return data.dados;
}

export async function alterarSituacao(
  id: number,
  situacao: SituacaoUsuario,
  dataDesligamento: string | null,
): Promise<Usuario> {
  const { data } = await api.post<EnvelopeItem<Usuario>>(`/usuarios/${id}/situacao`, {
    situacao,
    data_desligamento: dataDesligamento,
  });
  return data.dados;
}

export async function redefinirSenha(id: number, senhaTemporaria: string): Promise<void> {
  await api.post(`/usuarios/${id}/redefinir-senha`, { senha_temporaria: senhaTemporaria });
}

export async function permissoesDoUsuario(id: number): Promise<PermissoesDoUsuario> {
  const { data } = await api.get<EnvelopeItem<PermissoesDoUsuario>>(`/usuarios/${id}/permissoes`);
  return data.dados;
}

export async function definirPermissaoIndividual(
  id: number,
  codigo: string,
  concedida: boolean,
  justificativa: string,
): Promise<PermissoesDoUsuario> {
  const { data } = await api.put<EnvelopeItem<PermissoesDoUsuario>>(
    `/usuarios/${id}/permissoes/${encodeURIComponent(codigo)}`,
    { concedida, justificativa },
  );
  return data.dados;
}

export async function removerPermissaoIndividual(id: number, codigo: string): Promise<PermissoesDoUsuario> {
  const { data } = await api.delete<EnvelopeItem<PermissoesDoUsuario>>(
    `/usuarios/${id}/permissoes/${encodeURIComponent(codigo)}`,
  );
  return data.dados;
}

/** Senha temporaria legivel para ditar ao usuario (sem 0/O, 1/l/I). */
export function gerarSenhaTemporaria(tamanho = 10): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const sorteio = new Uint32Array(tamanho);
  crypto.getRandomValues(sorteio);
  return Array.from(sorteio, (n) => alfabeto[n % alfabeto.length]).join('');
}
