/**
 * Contrato do recebimento fiscal (v1.2, R2/R3) — espelho dos JSON tags de
 * backend/internal/domain/notaentrada (notaentrada.go, servico.go, xmlnfe.go)
 * e das rotas de handlers/notas_entrada.go.
 *
 * Dinheiro chega como numero (dinheiro.Dinheiro serializa "650.00" sem aspas);
 * datas como AAAA-MM-DD; datas zero sao omitidas (omitzero) ou null.
 */
import type { FlagsControle } from './arquivos';
import { marcar } from '@/i18n';

export type StatusNota = 'Rascunho' | 'Conferida' | 'Efetivada' | 'Cancelada' | 'Estornada';

export const STATUS_NOTA: StatusNota[] = ['Rascunho', 'Conferida', 'Efetivada', 'Cancelada', 'Estornada'];

export type ModeloNota = '55' | '01';

export type NivelPendencia = 'BLOQUEIO' | 'APROVACAO' | 'AVISO';

/** Pendencia da conferencia (GET /notas-entrada/:id/pendencias). */
export interface Pendencia {
  item_ordem?: number;
  tipo: string;
  nivel: NivelPendencia;
  mensagem: string;
}

/** Subdivisao da linha da nota por lote (4.3.5). */
export interface LoteItem {
  numero_lote: string;
  data_fabricacao?: string | null;
  validade?: string | null;
  quantidade: number;
  certificado_arquivo_id?: string | null;
  lote_id?: number;
}

/** Numero de serie informado (com o lote, se a peca tem lote). */
export interface SerieItem {
  numero: string;
  numero_lote?: string;
}

export interface ItemNota {
  id: number;
  ordem: number;
  item_pedido_compra_id?: number | null;
  numero_pc?: string;
  parte_peca_id: number;
  peca_codigo: string;
  peca_descricao: string;
  peca_unidade: string;
  controle: FlagsControle;
  codigo_fornecedor: string;
  descricao_nf: string;
  unidade_nf: string;
  quantidade_nf: number;
  valor_unitario: number;
  valor_total: number;
  fator_conversao: number;
  quantidade_recebida: number;
  bonificacao: boolean;
  justificativa_bonificacao: string;
  certificado_arquivo_id?: string | null;
  /** Null sem a permissao producao.custos. */
  custo_unitario_entrada?: number | null;
  lotes: LoteItem[] | null;
  series: SerieItem[] | null;
  pc_preco_unitario?: number;
  pc_quantidade_solicitada?: number;
  pc_quantidade_recebida?: number;
  /** Miniatura assinada da foto da peca (5 min). */
  foto_url?: string;
}

export interface NotaEntrada {
  id: number;
  pedido_compra_id: number;
  numero_pc: string;
  fornecedor_id: number;
  fornecedor_nome: string;
  cnpj_emitente: string;
  modelo: ModeloNota;
  serie: string;
  numero: string;
  chave_acesso?: string;
  data_emissao: string | null;
  data_entrada: string | null;
  cfop: string;
  valor_produtos: number;
  valor_frete: number;
  valor_seguro: number;
  valor_desconto: number;
  valor_ipi: number;
  valor_icms_st: number;
  valor_total: number;
  status: StatusNota;
  /** Controle de concorrencia (v1.2): sobe a cada gravacao. */
  versao?: number;
  origem: string;
  observacoes: string;
  divergencia_aprovada_por?: string;
  efetivada_em?: string;
  efetivada_por?: string;
  estornada_em?: string;
  motivo_estorno?: string;
  /** Ausente na listagem (omitempty). */
  itens?: ItemNota[];
  created_at: string;
}

/** Item do corpo de POST/PUT (notaentrada.Item; campos de leitura ficam de fora). */
export interface CorpoItemNota {
  item_pedido_compra_id: number | null;
  parte_peca_id: number;
  codigo_fornecedor: string;
  descricao_nf: string;
  unidade_nf: string;
  quantidade_nf: number;
  valor_unitario: number;
  valor_total: number;
  fator_conversao: number;
  quantidade_recebida: number;
  bonificacao: boolean;
  justificativa_bonificacao: string;
  certificado_arquivo_id: string | null;
  lotes: LoteItem[];
  series: SerieItem[];
}

/** Corpo de POST /notas-entrada e PUT /notas-entrada/:id (notaRequest). */
export interface CorpoNota {
  /** XML quando a nota nasceu da importacao (vale tambem nas edicoes). */
  origem?: 'MANUAL' | 'XML';
  pedido_compra_id: number;
  cnpj_emitente: string;
  modelo: ModeloNota;
  serie: string;
  numero: string;
  chave_acesso: string;
  data_emissao: string | null;
  data_entrada: string | null;
  cfop: string;
  valor_produtos: number;
  valor_frete: number;
  valor_seguro: number;
  valor_desconto: number;
  valor_ipi: number;
  valor_icms_st: number;
  valor_total: number;
  observacoes: string;
  itens: CorpoItemNota[];
}

/** Item lido do XML (notaentrada.ItemXML). */
export interface ItemXML {
  numero_item: number;
  codigo_fornecedor: string;
  descricao: string;
  unidade: string;
  cfop: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  lotes: LoteItem[] | null;
  /** Nulo = item nao reconhecido pelo de-para: vincular a mao. */
  parte_peca_id?: number | null;
  peca_codigo?: string;
  peca_descricao?: string;
  fator_conversao: number;
  item_pedido_compra_id?: number | null;
  quantidade_recebida: number;
}

/** Previa do XML (POST /notas-entrada/importar-xml). Nada e gravado alem do arquivo. */
export interface PreviaXML {
  /** Arquivo XML ja guardado: anexar a nota depois de criada. */
  arquivo_id: string;
  pedido_compra_id: number;
  cnpj_emitente: string;
  nome_emitente: string;
  modelo: string;
  serie: string;
  numero: string;
  chave_acesso: string;
  data_emissao: string | null;
  cfop: string;
  valor_produtos: number;
  valor_frete: number;
  valor_seguro: number;
  valor_desconto: number;
  valor_ipi: number;
  valor_icms_st: number;
  valor_total: number;
  itens: ItemXML[];
  nao_reconhecidos: number;
}

/** Vinculo item x fornecedor (notaentrada.DePara). */
export interface DePara {
  id: number;
  fornecedor_id: number;
  parte_peca_id: number;
  peca_codigo: string;
  peca_descricao: string;
  codigo_fornecedor: string;
  descricao_fornecedor: string;
  unidade_fornecedor: string;
  fator_conversao: number;
}

export type CorpoDePara = Omit<DePara, 'id' | 'fornecedor_id' | 'peca_codigo' | 'peca_descricao'>;

/** Categorias de anexo da nota (arquivo.CategoriasNotaEntrada). */
export const CATEGORIAS_ANEXO_NOTA = [
  marcar('XML da NF-e'),
  marcar('DANFE'),
  marcar('Certificado de Conformidade'),
  marcar('Foto da mercadoria'),
  marcar('Foto do lacre'),
  marcar('Foto de avaria'),
  marcar('Outro'),
] as const;

/** Codigo do 409 com a lista de pendencias (handlers.CodigoPendencias). */
export const CODIGO_PENDENCIAS = 'PENDENCIAS_NA_NOTA';
