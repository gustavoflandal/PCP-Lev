/**
 * Contrato de lotes, kardex e origem do saldo (v1.2, R4) — espelho de
 * backend/internal/domain/rastreio/rastreio.go e handlers/rastreio.go.
 */

export interface Lote {
  id: number;
  parte_peca_id: number;
  peca_codigo: string;
  peca_descricao: string;
  numero_lote: string;
  fornecedor_id?: number;
  fornecedor_nome: string;
  data_fabricacao?: string | null;
  validade?: string | null;
  quantidade_atual: number;
  quantidade_reservada: number;
  vencido: boolean;
}

/** Entrada por nota fiscal (rastreio.EntradaNF). */
export interface EntradaNF {
  nota_id: number;
  numero: string;
  serie: string;
  data_entrada: string;
  fornecedor_nome: string;
  quantidade: number;
  /** So com a permissao producao.custos. */
  custo_unitario?: number | null;
  numero_lote?: string;
}

export interface ConsumoOP {
  ordem_producao_id: number;
  numero_op: string;
  quantidade: number;
  produto_codigo: string;
}

/** Unidade produzida com material do lote. */
export interface UnidadeAfetada {
  serie_id: number;
  numero: string;
  status: string;
  produto_codigo: string;
  numero_op: string;
  pedido_venda_id: number;
  numero_pedido: string;
  cliente_nome: string;
  /** A serie do componente do lote esta instalada nesta unidade. */
  direta: boolean;
}

export interface RastreioLote {
  lote: Lote;
  entradas: EntradaNF[] | null;
  consumos: ConsumoOP[] | null;
  unidades: UnidadeAfetada[] | null;
}

export type TipoDocumentoKardex = 'NOTA_ENTRADA' | 'ORDEM_PRODUCAO' | 'PEDIDO_VENDA' | 'AJUSTE';

/** Movimento do kardex (rastreio.Movimento). */
export interface MovimentoKardex {
  id: number;
  data_hora: string;
  tipo: string;
  motivo: string;
  quantidade: number;
  /** Saldo depois do movimento. */
  saldo: number;
  documento_tipo?: TipoDocumentoKardex;
  documento_id?: number;
  referencia?: string;
  numero_lote?: string;
  usuario?: string;
  /** So com a permissao producao.custos. */
  custo_unitario?: number | null;
  observacoes: string;
}

/** De onde vem o saldo de uma peca (rastreio.Origens). */
export interface OrigensSaldo {
  parte_peca_id: number;
  saldo: number;
  lotes: Lote[] | null;
  entradas: EntradaNF[] | null;
  /** Unidades do saldo sem documento de origem (ex.: saldo anterior a v1.2). */
  sem_origem: number;
}

export interface FiltroLotes {
  busca: string;
  /** 0 = sem filtro de vencimento. */
  vencendo_dias: number;
  com_saldo: boolean;
  parte_peca_id?: number;
}
