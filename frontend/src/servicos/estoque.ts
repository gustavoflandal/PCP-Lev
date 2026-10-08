import { api } from './api';
import type { DadosPaginacao, Pagina } from '@/tipos/cadastros';
import type { Movimentacao, ParametrosListagemEstoque, SaldoEstoque } from '@/tipos/estoque';

interface EnvelopeLista<T> {
  dados: T[];
  paginacao: DadosPaginacao;
}

interface EnvelopeItem<T> {
  dados: T;
}

function paramsDeConsultaEstoque(params: ParametrosListagemEstoque): Record<string, string | number> {
  const query: Record<string, string | number> = {
    pagina: params.pagina,
    limite: params.limite,
    ordenar_por: params.ordenar_por,
    ordem: params.ordem,
  };
  if (params.status !== null) {
    query.status = params.status;
  }
  return query;
}

export async function listarEstoque(params: ParametrosListagemEstoque): Promise<Pagina<SaldoEstoque>> {
  const { data } = await api.get<EnvelopeLista<SaldoEstoque>>('/estoque', { params: paramsDeConsultaEstoque(params) });
  return { itens: data.dados, paginacao: data.paginacao };
}

export async function obterEstoque(partePecaId: number): Promise<SaldoEstoque> {
  const { data } = await api.get<EnvelopeItem<SaldoEstoque>>(`/estoque/${partePecaId}`);
  return data.dados;
}

export async function listarEstoqueCriticos(): Promise<SaldoEstoque[]> {
  const { data } = await api.get<{ dados: SaldoEstoque[] }>('/estoque/criticos');
  return data.dados;
}

export interface CorpoAjusteEstoque {
  parte_peca_id: number;
  quantidade: number;
  motivo: string;
  observacoes?: string;
}

export async function ajustarEstoque(corpo: CorpoAjusteEstoque): Promise<SaldoEstoque> {
  const { data } = await api.post<EnvelopeItem<SaldoEstoque>>('/estoque/ajuste', corpo);
  return data.dados;
}

export async function listarMovimentacoes(pagina: number, limite: number): Promise<Pagina<Movimentacao>> {
  const { data } = await api.get<EnvelopeLista<Movimentacao>>('/movimentacoes', { params: { pagina, limite } });
  return { itens: data.dados, paginacao: data.paginacao };
}
