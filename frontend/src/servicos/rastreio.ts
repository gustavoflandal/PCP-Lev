import { api } from './api';
import type { FiltroLotes, Lote, MovimentoKardex, OrigensSaldo, RastreioLote } from '@/tipos/rastreio';

interface Envelope<T> {
  dados: T;
}

/** GET /lotes — busca por numero do lote ou peca; vencendo em N dias; so com saldo. */
export async function listarLotes(filtro: FiltroLotes): Promise<Lote[]> {
  const params: Record<string, string | number> = {};
  if (filtro.busca.trim() !== '') params.busca = filtro.busca.trim();
  if (filtro.vencendo_dias > 0) params.vencendo_dias = filtro.vencendo_dias;
  if (filtro.com_saldo) params.com_saldo = 'true';
  if (filtro.parte_peca_id) params.parte_peca_id = filtro.parte_peca_id;
  const { data } = await api.get<Envelope<Lote[] | null>>('/lotes', { params });
  return data.dados ?? [];
}

/** Do lote ao campo: notas de entrada, OPs que consumiram e unidades produzidas. */
export async function rastrearLote(id: number): Promise<RastreioLote> {
  const { data } = await api.get<Envelope<RastreioLote>>(`/lotes/${id}/rastreabilidade`);
  return data.dados;
}

export async function obterKardex(partePecaId: number, limite = 200): Promise<MovimentoKardex[]> {
  const { data } = await api.get<Envelope<MovimentoKardex[] | null>>(`/estoque/${partePecaId}/kardex`, {
    params: { limite },
  });
  return data.dados ?? [];
}

export async function obterOrigensSaldo(partePecaId: number): Promise<OrigensSaldo> {
  const { data } = await api.get<Envelope<OrigensSaldo>>(`/estoque/${partePecaId}/origens`);
  return data.dados;
}
