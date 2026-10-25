import { api } from './api';
import type {
  Anexo,
  Arquivo,
  CorpoAnexo,
  EntidadeAnexo,
  UrlAssinada,
  VencimentoDocumento,
} from '@/tipos/arquivos';

interface Envelope<T> {
  dados: T;
}

/** Upload de ate 25 MB numa rede de galpao: mais folga que o timeout padrao. */
const TIMEOUT_UPLOAD_MS = 120_000;

/**
 * Envia o arquivo (multipart, campo "arquivo"). O cliente `api` nasce com
 * Content-Type JSON, e o axios converteria o FormData em JSON com ele: o
 * cabecalho multipart aqui evita isso, e no navegador o axios o remove para
 * que o proprio navegador escreva o boundary.
 */
export async function enviarArquivo(conteudo: Blob, nome: string): Promise<Arquivo> {
  const formulario = new FormData();
  formulario.append('arquivo', conteudo, nome);
  const { data } = await api.post<Envelope<Arquivo>>('/arquivos', formulario, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: TIMEOUT_UPLOAD_MS,
  });
  return data.dados;
}

/** URL assinada (5 min) de um arquivo; `miniatura` pede a versao de 240 px. */
export async function obterUrlArquivo(id: string, miniatura = false): Promise<UrlAssinada> {
  const { data } = await api.get<Envelope<UrlAssinada>>(`/arquivos/${id}/url`, {
    params: miniatura ? { miniatura: 1 } : undefined,
  });
  return data.dados;
}

export async function listarAnexos(entidade: EntidadeAnexo, entidadeId: number): Promise<Anexo[]> {
  const { data } = await api.get<Envelope<Anexo[] | null>>('/anexos', {
    params: { entidade, entidade_id: entidadeId },
  });
  return data.dados ?? [];
}

export async function anexar(corpo: CorpoAnexo): Promise<Anexo> {
  const { data } = await api.post<Envelope<Anexo>>('/anexos', corpo);
  return data.dados;
}

export async function atualizarAnexo(id: number, corpo: CorpoAnexo): Promise<Anexo> {
  const { data } = await api.put<Envelope<Anexo>>(`/anexos/${id}`, corpo);
  return data.dados;
}

export async function removerAnexo(id: number): Promise<void> {
  await api.delete(`/anexos/${id}`);
}

/** Documentos vigentes vencidos ou que vencem nos proximos `dias`. */
export async function listarVencimentosDocumentos(dias: number): Promise<VencimentoDocumento[]> {
  const { data } = await api.get<Envelope<VencimentoDocumento[] | null>>('/anexos/vencimentos', {
    params: { dias },
  });
  return data.dados ?? [];
}

/** Corpo de PUT a partir do anexo atual: o PUT substitui todos os metadados. */
export function corpoDoAnexo(a: Anexo): CorpoAnexo {
  return {
    entidade: a.entidade,
    entidade_id: a.entidade_id,
    arquivo_id: a.arquivo.id,
    tipo: a.tipo,
    categoria: a.categoria,
    titulo: a.titulo,
    descricao: a.descricao,
    versao: a.versao,
    data_emissao: a.data_emissao ?? null,
    data_validade: a.data_validade ?? null,
    fornecedor_id: a.fornecedor_id ?? null,
    estrutura_produto_id: a.estrutura_produto_id ?? null,
    principal: a.principal,
  };
}
