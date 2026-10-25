import { api, ErroApi } from './api';
import type { CorpoDePara, CorpoNota, DePara, NivelPendencia, NotaEntrada, Pendencia, PreviaXML } from '@/tipos/notasEntrada';
import { CODIGO_PENDENCIAS } from '@/tipos/notasEntrada';

interface Envelope<T> {
  dados: T;
}

/** XML de NF-e ate 2 MB numa rede de galpao: mesma folga do upload de arquivos. */
const TIMEOUT_UPLOAD_MS = 120_000;

export async function obterNota(id: number): Promise<NotaEntrada> {
  const { data } = await api.get<Envelope<NotaEntrada>>(`/notas-entrada/${id}`);
  return data.dados;
}

export async function listarPendencias(id: number): Promise<Pendencia[]> {
  const { data } = await api.get<Envelope<Pendencia[] | null>>(`/notas-entrada/${id}/pendencias`);
  return data.dados ?? [];
}

export async function criarNota(corpo: CorpoNota): Promise<NotaEntrada> {
  const { data } = await api.post<Envelope<NotaEntrada>>('/notas-entrada', corpo);
  return data.dados;
}

export async function atualizarNota(id: number, corpo: CorpoNota): Promise<NotaEntrada> {
  const { data } = await api.put<Envelope<NotaEntrada>>(`/notas-entrada/${id}`, corpo);
  return data.dados;
}

async function acao(id: number, nome: string, corpo?: unknown): Promise<NotaEntrada> {
  const { data } = await api.post<Envelope<NotaEntrada>>(`/notas-entrada/${id}/${nome}`, corpo);
  return data.dados;
}

export const conferirNota = (id: number) => acao(id, 'conferir');
export const efetivarNota = (id: number) => acao(id, 'efetivar');
export const cancelarNota = (id: number) => acao(id, 'cancelar');
export const estornarNota = (id: number, motivo: string) => acao(id, 'estornar', { motivo });

/** Le o XML contra o PC (multipart: pedido_compra_id + arquivo). */
export async function importarXML(pedidoCompraId: number, arquivo: File): Promise<PreviaXML> {
  const formulario = new FormData();
  formulario.append('pedido_compra_id', String(pedidoCompraId));
  formulario.append('arquivo', arquivo, arquivo.name);
  const { data } = await api.post<Envelope<PreviaXML>>('/notas-entrada/importar-xml', formulario, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: TIMEOUT_UPLOAD_MS,
  });
  return data.dados;
}

export async function listarDePara(fornecedorId: number): Promise<DePara[]> {
  const { data } = await api.get<Envelope<DePara[] | null>>(`/fornecedores/${fornecedorId}/de-para`);
  return data.dados ?? [];
}

/** Cria ou atualiza (pelo codigo do fornecedor) um vinculo de-para. */
export async function salvarDePara(fornecedorId: number, corpo: CorpoDePara): Promise<DePara> {
  const { data } = await api.post<Envelope<DePara>>(`/fornecedores/${fornecedorId}/de-para`, corpo);
  return data.dados;
}

export async function removerDePara(id: number): Promise<void> {
  await api.delete(`/de-para/${id}`);
}

/** Pendencia vinda do 409 PENDENCIAS_NA_NOTA: o handler devolve
 * `{campo: "item N" | tipo, mensagem: "[NIVEL] texto"}` em erro.detalhes. */
export interface PendenciaExibida {
  /** "Item 2" ou o tipo (CHAVE, DATAS...) da pendencia do cabecalho. */
  onde: string | null;
  nivel: NivelPendencia;
  mensagem: string;
}

const NIVEIS: NivelPendencia[] = ['BLOQUEIO', 'APROVACAO', 'AVISO'];

export function pendenciasDoErro(erro: unknown): PendenciaExibida[] | null {
  if (!(erro instanceof ErroApi) || erro.codigo !== CODIGO_PENDENCIAS) return null;
  return (erro.detalhes ?? []).map((d) => {
    const casamento = /^\[([A-Z]+)\]\s*(.*)$/s.exec(d.mensagem);
    const nivel = casamento && NIVEIS.includes(casamento[1] as NivelPendencia) ? (casamento[1] as NivelPendencia) : 'BLOQUEIO';
    const item = /^item (\d+)$/.exec(d.campo);
    return { onde: item ? `Item ${item[1]}` : null, nivel, mensagem: casamento ? casamento[2] : d.mensagem };
  });
}

export function pendenciasExibidas(lista: Pendencia[]): PendenciaExibida[] {
  return lista.map((p) => ({ onde: p.item_ordem ? `Item ${p.item_ordem}` : null, nivel: p.nivel, mensagem: p.mensagem }));
}
