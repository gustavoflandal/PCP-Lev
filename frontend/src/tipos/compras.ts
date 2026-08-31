import type { Ordem } from './cadastros';

/** Recursos de compras. Tambem serve de chave de cache no TanStack Query. */
export type RecursoCompras = 'cotacoes' | 'pedidos-compra';

export type StatusCotacao = 'Rascunho' | 'Enviada' | 'Respondida' | 'Cancelada';

export type StatusPedidoCompra =
  | 'Rascunho'
  | 'Emitido'
  | 'Aceito'
  | 'Aguardando Entrega'
  | 'Recebido Parcial'
  | 'Concluido'
  | 'Cancelado';

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
  itens: ItemPedidoCompra[];
  created_at: string;
  updated_at: string;
}
