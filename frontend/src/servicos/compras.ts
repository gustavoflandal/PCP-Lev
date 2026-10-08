import { api } from './api';
import type { DadosPaginacao, Pagina } from '@/tipos/cadastros';
import type { Cotacao, ParametrosListagemCompras, PedidoCompra, RecursoCompras } from '@/tipos/compras';

interface EnvelopeLista<T> {
  dados: T[];
  paginacao: DadosPaginacao;
}

interface EnvelopeItem<T> {
  dados: T;
}

/**
 * Monta a query string. Busca vazia e status nulo sao omitidos — igual ao
 * `paramsDeConsulta` dos cadastros, so que o filtro e `status`, nao
 * `filtro_ativo`.
 */
export function paramsDeConsultaCompras(
  params: ParametrosListagemCompras,
): Record<string, string | number> {
  const query: Record<string, string | number> = {
    pagina: params.pagina,
    limite: params.limite,
    ordenar_por: params.ordenar_por,
    ordem: params.ordem,
  };

  if (params.busca.trim() !== '') {
    query.busca = params.busca.trim();
  }
  if (params.status !== null) {
    query.status = params.status;
  }
  return query;
}

export async function listar<T>(
  recurso: RecursoCompras,
  params: ParametrosListagemCompras,
): Promise<Pagina<T>> {
  const { data } = await api.get<EnvelopeLista<T>>(`/${recurso}`, {
    params: paramsDeConsultaCompras(params),
  });
  return { itens: data.dados, paginacao: data.paginacao };
}

export async function obterCompra<T>(recurso: RecursoCompras, id: number): Promise<T> {
  const { data } = await api.get<EnvelopeItem<T>>(`/${recurso}/${id}`);
  return data.dados;
}

export async function criarCompra<T>(recurso: RecursoCompras, corpo: unknown): Promise<T> {
  const { data } = await api.post<EnvelopeItem<T>>(`/${recurso}`, corpo);
  return data.dados;
}

export async function atualizarCompra<T>(
  recurso: RecursoCompras,
  id: number,
  corpo: unknown,
): Promise<T> {
  const { data } = await api.put<EnvelopeItem<T>>(`/${recurso}/${id}`, corpo);
  return data.dados;
}

// --- Acoes de cotacao ---

export async function enviarCotacao(id: number): Promise<Cotacao> {
  const { data } = await api.post<EnvelopeItem<Cotacao>>(`/cotacoes/${id}/enviar`);
  return data.dados;
}

export interface CorpoRegistrarResposta {
  data_resposta: string;
  itens: { parte_peca_id: number; preco_unitario: number }[];
}

export async function registrarRespostaCotacao(
  id: number,
  corpo: CorpoRegistrarResposta,
): Promise<Cotacao> {
  const { data } = await api.post<EnvelopeItem<Cotacao>>(`/cotacoes/${id}/registrar-resposta`, corpo);
  return data.dados;
}

export async function cancelarCotacao(id: number): Promise<Cotacao> {
  const { data } = await api.post<EnvelopeItem<Cotacao>>(`/cotacoes/${id}/cancelar`);
  return data.dados;
}

export interface CorpoConverterEmPedido {
  numero_pc: string;
  data_entrega_prevista: string;
  condicao_pagamento?: string;
}

export async function converterCotacaoEmPedido(
  id: number,
  corpo: CorpoConverterEmPedido,
): Promise<PedidoCompra> {
  const { data } = await api.post<EnvelopeItem<PedidoCompra>>(`/cotacoes/${id}/converter-pc`, corpo);
  return data.dados;
}

// --- Acoes de pedido de compra ---

export async function emitirPedidoCompra(id: number): Promise<PedidoCompra> {
  const { data } = await api.post<EnvelopeItem<PedidoCompra>>(`/pedidos-compra/${id}/emitir`);
  return data.dados;
}

export async function cancelarPedidoCompra(id: number): Promise<PedidoCompra> {
  const { data } = await api.post<EnvelopeItem<PedidoCompra>>(`/pedidos-compra/${id}/cancelar`);
  return data.dados;
}

export async function listarPedidosEmAtraso(): Promise<PedidoCompra[]> {
  const { data } = await api.get<{ dados: PedidoCompra[] }>('/pedidos-compra/em-atraso');
  return data.dados;
}

export interface CorpoRegistrarRecebimento {
  itens: { parte_peca_id: number; quantidade_recebida: number }[];
}

export async function registrarRecebimentoPedidoCompra(
  id: number,
  corpo: CorpoRegistrarRecebimento,
): Promise<PedidoCompra> {
  const { data } = await api.post<EnvelopeItem<PedidoCompra>>(`/pedidos-compra/${id}/registrar-recebimento`, corpo);
  return data.dados;
}
