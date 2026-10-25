import { api } from './api';
import type {
  CorpoPedidoVenda,
  DetalheOP,
  FichaAsBuilt,
  Metrologia,
  OrdemProducao,
  PedidoVenda,
  VencimentoMetrologia,
} from '@/tipos/producao';

interface Envelope<T> {
  dados: T;
}

// --- Pedidos de venda (listagem via servicos/compras.listar, recurso 'pedidos-venda') ---

export async function obterPedidoVenda(id: number): Promise<PedidoVenda> {
  const { data } = await api.get<Envelope<PedidoVenda>>(`/pedidos-venda/${id}`);
  return data.dados;
}

export async function criarPedidoVenda(corpo: CorpoPedidoVenda): Promise<PedidoVenda> {
  const { data } = await api.post<Envelope<PedidoVenda>>('/pedidos-venda', corpo);
  return data.dados;
}

export async function atualizarPedidoVenda(id: number, corpo: CorpoPedidoVenda): Promise<PedidoVenda> {
  const { data } = await api.put<Envelope<PedidoVenda>>(`/pedidos-venda/${id}`, corpo);
  return data.dados;
}

export async function cancelarPedidoVenda(id: number): Promise<PedidoVenda> {
  const { data } = await api.post<Envelope<PedidoVenda>>(`/pedidos-venda/${id}/cancelar`);
  return data.dados;
}

export async function registrarEntregaPedidoVenda(id: number): Promise<PedidoVenda> {
  const { data } = await api.post<Envelope<PedidoVenda>>(`/pedidos-venda/${id}/entregar`);
  return data.dados;
}

// --- Ordens de producao (listagem via servicos/compras.listar, recurso 'ops') ---

export async function gerarOP(itemPedidoVendaId: number): Promise<DetalheOP> {
  const { data } = await api.post<Envelope<DetalheOP>>('/ops', { item_pedido_venda_id: itemPedidoVendaId });
  return data.dados;
}

export async function obterOP(id: number): Promise<DetalheOP> {
  const { data } = await api.get<Envelope<DetalheOP>>(`/ops/${id}`);
  return data.dados;
}

export async function liberarOP(id: number): Promise<DetalheOP> {
  const { data } = await api.post<Envelope<DetalheOP>>(`/ops/${id}/liberar`);
  return data.dados;
}

export async function cancelarOP(id: number): Promise<DetalheOP> {
  const { data } = await api.post<Envelope<DetalheOP>>(`/ops/${id}/cancelar`);
  return data.dados;
}

export async function iniciarApontamento(id: number, centroTrabalhoId: number, observacoes = ''): Promise<DetalheOP> {
  const { data } = await api.post<Envelope<DetalheOP>>(`/ops/${id}/apontamentos`, {
    centro_trabalho_id: centroTrabalhoId,
    observacoes,
  });
  return data.dados;
}

export async function encerrarApontamento(id: number, observacoes = ''): Promise<DetalheOP> {
  const { data } = await api.post<Envelope<DetalheOP>>(`/ops/${id}/apontamentos/encerrar`, { observacoes });
  return data.dados;
}

export async function avancarOP(id: number): Promise<DetalheOP> {
  const { data } = await api.post<Envelope<DetalheOP>>(`/ops/${id}/avancar`);
  return data.dados;
}

export async function listarKanban(): Promise<OrdemProducao[]> {
  const { data } = await api.get<Envelope<OrdemProducao[] | null>>('/kanban');
  return data.dados ?? [];
}

// --- Unidades (numeros de serie) ---

export async function registrarTeste(serieId: number, aprovado: boolean, resultado: string): Promise<void> {
  await api.put(`/series/${serieId}/teste`, { aprovado, resultado });
}

export async function registrarMetrologia(serieId: number, corpo: Metrologia): Promise<void> {
  await api.put(`/series/${serieId}/metrologia`, corpo);
}

export async function obterFichaAsBuilt(numero: string): Promise<FichaAsBuilt> {
  const { data } = await api.get<Envelope<FichaAsBuilt>>(`/rastreabilidade/${encodeURIComponent(numero)}`);
  return data.dados;
}

export async function listarVencimentosMetrologia(dias: number): Promise<VencimentoMetrologia[]> {
  const { data } = await api.get<Envelope<VencimentoMetrologia[] | null>>('/metrologia/vencimentos', {
    params: { dias },
  });
  return data.dados ?? [];
}
