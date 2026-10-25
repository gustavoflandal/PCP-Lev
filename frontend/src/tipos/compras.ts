import type { Ordem } from './cadastros';

/** Recursos de compras. Tambem serve de chave de cache no TanStack Query. */
export type RecursoCompras = 'cotacoes' | 'pedidos-compra';

/**
 * Recursos listados com filtro de `status` (consulta.AnalisarComStatus no
 * backend): os de compras e, desde a Fase 3, pedidos de venda e OPs; na v1.2,
 * as notas fiscais de entrada.
 */
export type RecursoComStatus = RecursoCompras | 'pedidos-venda' | 'ops' | 'notas-entrada';

export type StatusCotacao = 'Rascunho' | 'Enviada' | 'Respondida' | 'Cancelada';

export type StatusPedidoCompra =
  | 'Rascunho'
  | 'Emitido'
  | 'Aceito'
  | 'Aguardando Entrega'
  | 'Recebido Parcial'
  | 'Concluido'
  | 'Cancelado';

/** Rotulo de exibicao do status do pedido de compra (acento, sentence case). */
export const ROTULO_STATUS_PEDIDO_COMPRA: Record<StatusPedidoCompra, string> = {
  Rascunho: 'Rascunho',
  Emitido: 'Emitido',
  Aceito: 'Aceito',
  'Aguardando Entrega': 'Aguardando entrega',
  'Recebido Parcial': 'Recebido parcial',
  Concluido: 'Concluído',
  Cancelado: 'Cancelado',
};

/**
 * Espelha o que `consulta.AnalisarComStatus` aceita no backend — igual a
 * `ParametrosListagem` (doc dos cadastros), mas com `status` no lugar de
 * `filtro_ativo`: cotacao/pedido de compra nao tem coluna `ativo`, o
 * "inativar" deles e uma transicao de status.
 */
export interface ParametrosListagemCompras {
  pagina: number;
  limite: number;
  ordenar_por: string;
  ordem: Ordem;
  busca: string;
  /** null significa "sem filtro": traz todos os status. */
  status: string | null;
  /** Filtros proprios do recurso (ex.: `etapa` nas OPs); vazio e omitido. */
  filtros?: Record<string, string>;
}

export interface ItemCotacao {
  id: number;
  parte_peca_id: number;
  quantidade: number;
  preco_unitario: number;
  total: number;
}

export interface Cotacao {
  id: number;
  numero_cotacao: string;
  fornecedor_id: number;
  data_emissao: string;
  data_validade: string;
  /** Ausente no JSON antes da resposta do fornecedor (omitzero no backend). */
  data_resposta?: string;
  valor_total: number;
  status: StatusCotacao;
  observacoes?: string;
  itens: ItemCotacao[];
  created_at: string;
  updated_at: string;
}

export interface ItemPedidoCompra {
  id: number;
  parte_peca_id: number;
  quantidade_solicitada: number;
  quantidade_recebida: number;
  preco_unitario: number;
  total: number;
}

export interface ItemNecessidadeCompra {
  parte_peca_id: number;
  codigo: string;
  descricao: string;
  saldo_atual: number;
  estoque_minimo: number;
  necessidade: number;
  /** Ausentes quando a peca nao tem fornecedor padrao cadastrado. */
  fornecedor_padrao_id?: number;
  fornecedor_padrao_nome?: string;
}

export interface PedidoCompra {
  id: number;
  numero_pc: string;
  /** Ausente quando o PC foi criado manualmente, sem cotacao de origem. */
  cotacao_id?: number;
  fornecedor_id: number;
  data_pedido: string;
  data_entrega_prevista: string;
  data_entrega_real?: string;
  valor_total: number;
  condicao_pagamento?: string;
  status: StatusPedidoCompra;
  observacoes?: string;
  /** Encerrado com saldo pendente (v1.2): motivo e autor, quando a API os expuser. */
  motivo_encerramento?: string;
  encerrado_por?: string;
  itens: ItemPedidoCompra[];
  created_at: string;
  updated_at: string;
}
