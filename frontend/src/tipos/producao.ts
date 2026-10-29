import { marcar } from '@/i18n';
/**
 * Contrato da Fase 3 (Producao) — espelho dos JSON tags de
 * backend/internal/domain/pedidovenda e backend/internal/domain/producao.
 * Datas de calendario chegam como "AAAA-MM-DD"; instantes, como ISO 8601.
 * Dinheiro (dinheiro.Dinheiro) chega como numero decimal.
 */

// --- Pedido de venda ---

export type StatusPedidoVenda = 'Aberto' | 'Em Producao' | 'Pronto para Envio' | 'Entregue' | 'Cancelado';

export const ROTULO_STATUS_PEDIDO_VENDA: Record<StatusPedidoVenda, string> = {
  Aberto: marcar('Aberto'),
  'Em Producao': marcar('Em produção'),
  'Pronto para Envio': marcar('Pronto para envio'),
  Entregue: marcar('Entregue'),
  Cancelado: marcar('Cancelado'),
};

export interface ItemPedidoVenda {
  id: number;
  produto_acabado_id: number;
  produto_codigo: string;
  produto_descricao: string;
  quantidade: number;
  preco_unitario: number;
  total: number;
  /** Ausentes enquanto o item nao gerou OP. */
  ordem_producao_id?: number;
  numero_op?: string;
  status_op?: StatusOP;
  etapa_op?: EtapaOP;
}

export interface PedidoVenda {
  id: number;
  numero_pedido: string;
  cliente_id: number;
  cliente_nome: string;
  data_pedido: string;
  data_entrega_prometida: string;
  /** Ausente ate a entrega (omitzero). */
  data_entrega_real?: string;
  valor_total: number;
  status: StatusPedidoVenda;
  observacoes: string;
  /** Ausente na listagem (omitempty). */
  itens?: ItemPedidoVenda[];
  created_at: string;
  updated_at: string;
}

export interface CorpoPedidoVenda {
  numero_pedido: string;
  cliente_id: number;
  data_pedido: string;
  data_entrega_prometida: string;
  observacoes: string;
  /** preco_unitario vai como texto ("15000.00"): o backend aceita numero ou texto e texto evita erro de ponto flutuante. */
  itens: { produto_acabado_id: number; quantidade: number; preco_unitario: string }[];
}

// --- Ordem de producao ---

export type StatusOP = 'Aberta' | 'Liberada' | 'Concluida' | 'Cancelada';

export const ROTULO_STATUS_OP: Record<StatusOP, string> = {
  Aberta: marcar('Aberta'),
  Liberada: marcar('Liberada'),
  Concluida: marcar('Concluída'),
  Cancelada: marcar('Cancelada'),
};

/** Etapas da OP (RN3), na ordem do fluxo. Os centros de trabalho usam a forma maiuscula sem acento. */
export type EtapaOP = 'Separacao' | 'Montagem' | 'Testes' | 'Expedicao';

export const ETAPAS_OP: EtapaOP[] = ['Separacao', 'Montagem', 'Testes', 'Expedicao'];

export const ROTULO_ETAPA_OP: Record<EtapaOP, string> = {
  Separacao: marcar('Separação'),
  Montagem: marcar('Montagem'),
  Testes: marcar('Testes'),
  Expedicao: marcar('Expedição'),
};

export type StatusSerie = 'Em Producao' | 'Aprovado' | 'Reprovado' | 'Em Estoque' | 'Expedido' | 'Cancelado';

export const ROTULO_STATUS_SERIE: Record<StatusSerie, string> = {
  'Em Producao': marcar('Em produção'),
  Aprovado: marcar('Aprovado'),
  Reprovado: marcar('Reprovado'),
  'Em Estoque': marcar('Em estoque'),
  Expedido: marcar('Expedido'),
  Cancelado: marcar('Cancelado'),
};

export interface Apontamento {
  id: number;
  etapa: EtapaOP;
  centro_trabalho_id?: number;
  centro_codigo: string;
  centro_nome: string;
  operador_id?: number;
  operador_nome: string;
  inicio: string;
  /** Ausentes enquanto o apontamento esta em andamento. */
  fim?: string;
  duracao_minutos?: number;
  observacoes: string;
}

export interface OrdemProducao {
  id: number;
  numero_op: string;
  pedido_venda_id: number;
  numero_pedido: string;
  cliente_nome: string;
  item_pedido_venda_id: number;
  produto_acabado_id: number;
  produto_codigo: string;
  produto_descricao: string;
  exige_metrologia: boolean;
  /** Miniatura assinada da foto principal do produto (5 min). */
  produto_foto_url?: string;
  quantidade: number;
  estrutura_produto_id: number;
  estrutura_versao: number;
  data_conclusao_prevista: string;
  data_conclusao_real?: string;
  data_liberacao?: string;
  etapa_atual: EtapaOP;
  status: StatusOP;
  observacoes: string;
  /** Quem esta trabalhando nela agora (Kanban). */
  apontamento_aberto?: Apontamento;
  created_at: string;
}

export interface Reserva {
  parte_peca_id: number;
  codigo: string;
  descricao: string;
  quantidade_reservada: number;
  quantidade_consumida: number;
  status: string;
  /** Ausentes sem a permissao producao.custos. */
  custo_unitario_orcado?: number;
  custo_unitario_consumo?: number;
  /** Miniatura assinada da foto da peca na lista de separacao (5 min). */
  foto_url?: string;
}

export interface Metrologia {
  numero_aprovacao_modelo: string;
  data_verificacao: string;
  numero_lacre: string;
  validade: string;
  observacoes: string;
}

export interface Serie {
  id: number;
  numero: string;
  status: StatusSerie;
  resultado_teste: string;
  testado_por?: string;
  testado_em?: string;
  expedido_em?: string;
  metrologia?: Metrologia;
}

export interface Transicao {
  /** Ausente na primeira entrada (liberacao). */
  etapa_anterior?: EtapaOP;
  etapa_nova: EtapaOP;
  data_hora: string;
  usuario: string;
}

export interface Custo {
  material_orcado: number;
  material_realizado: number;
  mao_de_obra: number;
  horas_apontadas: number;
  total_realizado: number;
  custo_unitario: number;
  incompleto: boolean;
  avisos: string[] | null;
}

export interface DetalheOP extends OrdemProducao {
  reservas: Reserva[] | null;
  apontamentos: Apontamento[] | null;
  series: Serie[] | null;
  historico: Transicao[] | null;
  /** So vem para quem tem producao.custos. */
  custo?: Custo;
}

export interface ComponenteBOM {
  codigo: string;
  descricao: string;
  quantidade_por_unidade: number;
}

/** Serie de componente instalada na unidade (v1.2, 4.3.7). */
export interface SerieComponente {
  peca_codigo: string;
  peca_descricao: string;
  numero: string;
  numero_lote?: string;
  nota?: string;
  nota_id?: number;
  fornecedor_nome?: string;
  data_entrada?: string | null;
}

/** Lote de componente consumido pela OP da unidade (v1.2, 4.3.7). */
export interface LoteConsumido {
  lote_id: number;
  peca_codigo: string;
  numero_lote: string;
  validade?: string | null;
  quantidade: number;
  fornecedor_nome: string;
  /** Notas de entrada do lote, ja formatadas pelo backend. */
  notas: string;
}

export interface FichaAsBuilt {
  serie: Serie;
  ordem_producao: OrdemProducao;
  data_pedido: string;
  componentes: ComponenteBOM[] | null;
  apontamentos: Apontamento[] | null;
  historico: Transicao[] | null;
  /** Ausentes em fichas de antes da v1.2. */
  series_componentes?: SerieComponente[] | null;
  lotes_consumidos?: LoteConsumido[] | null;
  /** Laudos e relatorios de inspecao anexados a OP (Fase 3.1); ausente antes dela. */
  documentos?: DocumentoOP[] | null;
}

/**
 * Laudo de teste ou relatorio de inspecao da OP da unidade (producao.DocumentoOP).
 * Sem URL: a assinada vem de GET /arquivos/:id/url, que confere a permissao.
 */
export interface DocumentoOP {
  anexo_id: number;
  categoria: string;
  titulo: string;
  arquivo_id: string;
  nome_arquivo: string;
  /** AAAA-MM-DD; ausente quando nao informada (omitzero). */
  data_emissao?: string | null;
  created_at: string;
}

export interface VencimentoMetrologia {
  serie_id: number;
  numero: string;
  produto_codigo: string;
  produto_descricao: string;
  cliente_nome: string;
  numero_lacre: string;
  validade: string;
  vencida: boolean;
}

/** "Separacao" -> "SEPARACAO": etapa do centro de trabalho correspondente. */
export function etapaDoCentro(etapa: EtapaOP): string {
  return etapa.toUpperCase();
}

/** Data AAAA-MM-DD de hoje no fuso do navegador. */
export function hojeAAAAMMDD(agora: Date = new Date()): string {
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** Pedido que passou da entrega prometida e ainda nao foi entregue (nem cancelado). */
export function pedidoAtrasado(
  p: Pick<PedidoVenda, 'status' | 'data_entrega_prometida'>,
  hoje: string = hojeAAAAMMDD(),
): boolean {
  return p.status !== 'Entregue' && p.status !== 'Cancelado' && p.data_entrega_prometida < hoje;
}

/** OP que passou da conclusao prevista e ainda esta em andamento. */
export function opAtrasada(
  op: Pick<OrdemProducao, 'status' | 'data_conclusao_prevista'>,
  hoje: string = hojeAAAAMMDD(),
): boolean {
  return (op.status === 'Aberta' || op.status === 'Liberada') && op.data_conclusao_prevista < hoje;
}

/** Pode editar: Aberto e sem OP ativa (a regra e do backend; aqui so evita o 409 obvio). */
export function pedidoEditavel(p: PedidoVenda): boolean {
  return p.status === 'Aberto' && !(p.itens ?? []).some((i) => i.ordem_producao_id && i.status_op !== 'Cancelada');
}
