/**
 * Modelo do formulario da nota fiscal de entrada: o que a tela edita (texto,
 * para digitar a vontade) e as conversoes de/para o contrato da API. Funcoes
 * puras -- testaveis sem renderizar a tela.
 */
import type { FlagsControle } from '@/tipos/arquivos';
import type { PartePeca } from '@/tipos/cadastros';
import type { ItemPedidoCompra } from '@/tipos/compras';
import type {
  CorpoItemNota,
  CorpoNota,
  ItemNota,
  ItemXML,
  LoteItem,
  ModeloNota,
  NotaEntrada,
  PreviaXML,
  SerieItem,
} from '@/tipos/notasEntrada';
import { hojeAAAAMMDD } from '@/tipos/producao';

let sequencia = 0;
/** Chave local de linha (React key): itens e lotes novos ainda nao tem id. */
export function novaChave(prefixo: string): string {
  sequencia += 1;
  return `${prefixo}-${sequencia}`;
}

export interface FormLote {
  chave: string;
  numero_lote: string;
  quantidade: string;
  data_fabricacao: string;
  validade: string;
  certificado_arquivo_id: string | null;
}

export interface FormItem {
  chave: string;
  item_pedido_compra_id: number | null;
  numero_pc?: string;
  parte_peca_id: number;
  peca_codigo: string;
  peca_descricao: string;
  peca_unidade: string;
  controle: FlagsControle;
  foto_url?: string;
  codigo_fornecedor: string;
  descricao_nf: string;
  unidade_nf: string;
  quantidade_nf: string;
  fator_conversao: string;
  quantidade_recebida: string;
  valor_unitario: string;
  valor_total: string;
  bonificacao: boolean;
  justificativa_bonificacao: string;
  certificado_arquivo_id: string | null;
  lotes: FormLote[];
  series: SerieItem[];
  pc_preco_unitario?: number;
  pc_quantidade_solicitada?: number;
  pc_quantidade_recebida?: number;
}

export interface FormNota {
  pedido_compra_id: string;
  cnpj_emitente: string;
  modelo: ModeloNota;
  serie: string;
  numero: string;
  chave_acesso: string;
  data_emissao: string;
  data_entrada: string;
  cfop: string;
  valor_produtos: string;
  valor_frete: string;
  valor_seguro: string;
  valor_desconto: string;
  valor_ipi: string;
  valor_icms_st: string;
  valor_total: string;
  observacoes: string;
  itens: FormItem[];
}

export const CAMPOS_VALOR = [
  ['valor_produtos', 'Valor dos produtos (R$)'],
  ['valor_frete', 'Frete (R$)'],
  ['valor_seguro', 'Seguro (R$)'],
  ['valor_desconto', 'Desconto (R$)'],
  ['valor_ipi', 'IPI (R$)'],
  ['valor_icms_st', 'ICMS-ST (R$)'],
  ['valor_total', 'Valor total da nota (R$)'],
] as const;

export const FLAGS_VAZIAS: FlagsControle = {
  controla_numero_serie: false,
  controla_lote: false,
  controla_validade: false,
  item_critico: false,
  exige_certificado: false,
};

/** "1.234,5" ou "1234.5" -> 1234.5; vazio ou invalido -> 0. */
export function paraNumero(texto: string): number {
  const limpo = texto.trim();
  if (limpo === '') return 0;
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

const texto = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

export function arredondar2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function flagsDaPeca(p: Partial<FlagsControle> | undefined): FlagsControle {
  return {
    controla_numero_serie: !!p?.controla_numero_serie,
    controla_lote: !!p?.controla_lote,
    controla_validade: !!p?.controla_validade,
    item_critico: !!p?.item_critico,
    exige_certificado: !!p?.exige_certificado,
  };
}

export function formularioVazio(pedidoCompraId = '', cnpj = ''): FormNota {
  return {
    pedido_compra_id: pedidoCompraId,
    cnpj_emitente: cnpj,
    modelo: '55',
    serie: '1',
    numero: '',
    chave_acesso: '',
    data_emissao: '',
    data_entrada: hojeAAAAMMDD(),
    cfop: '',
    valor_produtos: '',
    valor_frete: '',
    valor_seguro: '',
    valor_desconto: '',
    valor_ipi: '',
    valor_icms_st: '',
    valor_total: '',
    observacoes: '',
    itens: [],
  };
}

export function loteVazio(): FormLote {
  return { chave: novaChave('lote'), numero_lote: '', quantidade: '', data_fabricacao: '', validade: '', certificado_arquivo_id: null };
}

function loteParaFormulario(l: LoteItem): FormLote {
  return {
    chave: novaChave('lote'),
    numero_lote: l.numero_lote,
    quantidade: texto(l.quantidade),
    data_fabricacao: l.data_fabricacao ?? '',
    validade: l.validade ?? '',
    certificado_arquivo_id: l.certificado_arquivo_id ?? null,
  };
}

export function itemParaFormulario(i: ItemNota): FormItem {
  return {
    chave: novaChave('item'),
    item_pedido_compra_id: i.item_pedido_compra_id ?? null,
    numero_pc: i.numero_pc,
    parte_peca_id: i.parte_peca_id,
    peca_codigo: i.peca_codigo,
    peca_descricao: i.peca_descricao,
    peca_unidade: i.peca_unidade,
    controle: flagsDaPeca(i.controle),
    foto_url: i.foto_url,
    codigo_fornecedor: i.codigo_fornecedor ?? '',
    descricao_nf: i.descricao_nf ?? '',
    unidade_nf: i.unidade_nf ?? '',
    quantidade_nf: texto(i.quantidade_nf),
    fator_conversao: texto(i.fator_conversao || 1),
    quantidade_recebida: texto(i.quantidade_recebida),
    valor_unitario: texto(i.valor_unitario),
    valor_total: texto(i.valor_total),
    bonificacao: i.bonificacao,
    justificativa_bonificacao: i.justificativa_bonificacao ?? '',
    certificado_arquivo_id: i.certificado_arquivo_id ?? null,
    lotes: (i.lotes ?? []).map(loteParaFormulario),
    series: i.series ?? [],
    pc_preco_unitario: i.pc_preco_unitario,
    pc_quantidade_solicitada: i.pc_quantidade_solicitada,
    pc_quantidade_recebida: i.pc_quantidade_recebida,
  };
}

export function notaParaFormulario(n: NotaEntrada): FormNota {
  return {
    pedido_compra_id: String(n.pedido_compra_id),
    cnpj_emitente: n.cnpj_emitente,
    modelo: n.modelo,
    serie: n.serie,
    numero: n.numero,
    chave_acesso: n.chave_acesso ?? '',
    data_emissao: n.data_emissao ?? '',
    data_entrada: n.data_entrada ?? '',
    cfop: n.cfop,
    valor_produtos: texto(n.valor_produtos),
    valor_frete: texto(n.valor_frete),
    valor_seguro: texto(n.valor_seguro),
    valor_desconto: texto(n.valor_desconto),
    valor_ipi: texto(n.valor_ipi),
    valor_icms_st: texto(n.valor_icms_st),
    valor_total: texto(n.valor_total),
    observacoes: n.observacoes ?? '',
    itens: (n.itens ?? []).map(itemParaFormulario),
  };
}

/** Linha nova a partir de um item do PC: ja vem com o saldo pendente como sugestao. */
export function itemDoPedido(pc: ItemPedidoCompra, numeroPC: string, peca: PartePeca | undefined): FormItem {
  const pendente = Math.max(0, pc.quantidade_solicitada - pc.quantidade_recebida);
  return {
    chave: novaChave('item'),
    item_pedido_compra_id: pc.id,
    numero_pc: numeroPC,
    parte_peca_id: pc.parte_peca_id,
    peca_codigo: peca?.codigo ?? String(pc.parte_peca_id),
    peca_descricao: peca?.descricao ?? '',
    peca_unidade: peca?.unidade_medida ?? '',
    controle: flagsDaPeca(peca),
    foto_url: peca?.foto_url,
    codigo_fornecedor: '',
    descricao_nf: '',
    unidade_nf: peca?.unidade_medida ?? '',
    quantidade_nf: texto(pendente),
    fator_conversao: '1',
    quantidade_recebida: texto(pendente),
    valor_unitario: texto(pc.preco_unitario),
    valor_total: texto(arredondar2(pendente * pc.preco_unitario)),
    bonificacao: false,
    justificativa_bonificacao: '',
    certificado_arquivo_id: null,
    lotes: [],
    series: [],
    pc_preco_unitario: pc.preco_unitario,
    pc_quantidade_solicitada: pc.quantidade_solicitada,
    pc_quantidade_recebida: pc.quantidade_recebida,
  };
}

/** Linha de bonificacao: sem PC e com justificativa; valores como na nota, custo de entrada zero. */
export function itemBonificacao(peca: PartePeca): FormItem {
  return {
    chave: novaChave('item'),
    item_pedido_compra_id: null,
    parte_peca_id: peca.id,
    peca_codigo: peca.codigo,
    peca_descricao: peca.descricao,
    peca_unidade: peca.unidade_medida,
    controle: flagsDaPeca(peca),
    foto_url: peca.foto_url,
    codigo_fornecedor: '',
    descricao_nf: '',
    unidade_nf: peca.unidade_medida,
    quantidade_nf: '',
    fator_conversao: '1',
    quantidade_recebida: '',
    valor_unitario: '0',
    valor_total: '0',
    bonificacao: true,
    justificativa_bonificacao: '',
    certificado_arquivo_id: null,
    lotes: [],
    series: [],
  };
}

const ouNulo = (s: string) => (s.trim() === '' ? null : s.trim());

export function itemParaCorpo(i: FormItem): CorpoItemNota {
  return {
    item_pedido_compra_id: i.bonificacao ? null : i.item_pedido_compra_id,
    parte_peca_id: i.parte_peca_id,
    codigo_fornecedor: i.codigo_fornecedor.trim(),
    descricao_nf: i.descricao_nf.trim(),
    unidade_nf: i.unidade_nf.trim(),
    quantidade_nf: paraNumero(i.quantidade_nf),
    // Bonificacao guarda os valores da nota; o custo de entrada e que e zero (backend).
    valor_unitario: paraNumero(i.valor_unitario),
    valor_total: paraNumero(i.valor_total),
    fator_conversao: paraNumero(i.fator_conversao) || 1,
    quantidade_recebida: Math.trunc(paraNumero(i.quantidade_recebida)),
    bonificacao: i.bonificacao,
    justificativa_bonificacao: i.bonificacao ? i.justificativa_bonificacao.trim() : '',
    certificado_arquivo_id: i.controle.controla_lote ? null : i.certificado_arquivo_id,
    lotes: i.controle.controla_lote
      ? i.lotes.map((l) => ({
          numero_lote: l.numero_lote.trim(),
          quantidade: Math.trunc(paraNumero(l.quantidade)),
          data_fabricacao: ouNulo(l.data_fabricacao),
          validade: i.controle.controla_validade ? ouNulo(l.validade) : null,
          certificado_arquivo_id: l.certificado_arquivo_id,
        }))
      : [],
    series: i.controle.controla_numero_serie
      ? i.series.map((s) => (i.controle.controla_lote && s.numero_lote ? s : { numero: s.numero }))
      : [],
  };
}

export function formularioParaCorpo(f: FormNota): CorpoNota {
  return {
    pedido_compra_id: Number(f.pedido_compra_id) || 0,
    cnpj_emitente: f.cnpj_emitente,
    modelo: f.modelo,
    serie: f.serie.trim(),
    numero: f.numero.trim(),
    chave_acesso: f.chave_acesso.replace(/\D/g, ''),
    data_emissao: ouNulo(f.data_emissao),
    data_entrada: ouNulo(f.data_entrada),
    cfop: f.cfop.replace(/\D/g, ''),
    valor_produtos: paraNumero(f.valor_produtos),
    valor_frete: paraNumero(f.valor_frete),
    valor_seguro: paraNumero(f.valor_seguro),
    valor_desconto: paraNumero(f.valor_desconto),
    valor_ipi: paraNumero(f.valor_ipi),
    valor_icms_st: paraNumero(f.valor_icms_st),
    valor_total: paraNumero(f.valor_total),
    observacoes: f.observacoes.trim(),
    itens: f.itens.map(itemParaCorpo),
  };
}

/**
 * Minimo para salvar o rascunho (espelho de Dados.ValidarForma): o rascunho
 * pode estar incompleto, mas nao invalido. O resto vira pendencia na
 * conferencia -- a API e a autoridade.
 */
export function validarParaSalvar(f: FormNota): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!f.pedido_compra_id) erros.pedido_compra_id = 'Escolha o pedido de compra que a nota atende';
  if (!/^\d{1,3}$/.test(f.serie.trim())) erros.serie = 'Série com até 3 dígitos';
  if (!/^\d{1,9}$/.test(f.numero.trim())) erros.numero = 'Número com até 9 dígitos';
  const chave = f.chave_acesso.replace(/\D/g, '');
  if (chave !== '' && chave.length !== 44) erros.chave_acesso = `A chave tem 44 dígitos (informados: ${chave.length})`;
  if (f.observacoes.trim().length > 1000) erros.observacoes = 'Observações até 1000 caracteres';
  const itemRuim = f.itens.findIndex(
    (i) =>
      paraNumero(i.quantidade_nf) <= 0 ||
      paraNumero(i.fator_conversao || '1') <= 0 ||
      paraNumero(i.quantidade_recebida) < 0 ||
      !Number.isInteger(paraNumero(i.quantidade_recebida)),
  );
  if (itemRuim >= 0) {
    erros.itens = `Item ${itemRuim + 1}: informe a quantidade da nota (maior que zero), o fator (maior que zero) e a quantidade recebida (inteira).`;
  }
  return erros;
}

/** Quantidade esperada em unidade de consumo: quantidade da NF x fator. */
export function quantidadeEsperada(i: FormItem): number {
  return paraNumero(i.quantidade_nf) * (paraNumero(i.fator_conversao) || 1);
}

export function somaLotes(i: FormItem): number {
  return i.lotes.reduce((soma, l) => soma + Math.trunc(paraNumero(l.quantidade)), 0);
}

/** Item do XML -> linha do corpo da nota (lotes so se a peca controla lote). */
export function itemXMLParaCorpo(i: ItemXML, peca: PartePeca | undefined): CorpoItemNota {
  const lote = !!peca?.controla_lote;
  return {
    item_pedido_compra_id: i.item_pedido_compra_id ?? null,
    parte_peca_id: i.parte_peca_id ?? 0,
    codigo_fornecedor: i.codigo_fornecedor,
    descricao_nf: i.descricao,
    unidade_nf: i.unidade,
    quantidade_nf: i.quantidade,
    valor_unitario: i.valor_unitario,
    valor_total: i.valor_total,
    fator_conversao: i.fator_conversao || 1,
    quantidade_recebida: i.quantidade_recebida,
    bonificacao: false,
    justificativa_bonificacao: '',
    certificado_arquivo_id: null,
    lotes: lote
      ? (i.lotes ?? []).map((l) => ({
          numero_lote: l.numero_lote,
          quantidade: l.quantidade,
          data_fabricacao: l.data_fabricacao ?? null,
          validade: peca?.controla_validade ? (l.validade ?? null) : null,
        }))
      : [],
    series: [],
  };
}

/** Previa do XML -> corpo do rascunho (data de entrada = hoje; o resto vem do XML). */
export function previaParaCorpo(p: PreviaXML, pecaPorId: Map<number, PartePeca>): CorpoNota {
  return {
    origem: 'XML',
    pedido_compra_id: p.pedido_compra_id,
    cnpj_emitente: p.cnpj_emitente,
    modelo: p.modelo === '01' ? '01' : '55',
    serie: p.serie,
    numero: p.numero,
    chave_acesso: p.chave_acesso,
    data_emissao: p.data_emissao,
    data_entrada: hojeAAAAMMDD(),
    cfop: p.cfop,
    valor_produtos: p.valor_produtos,
    valor_frete: p.valor_frete,
    valor_seguro: p.valor_seguro,
    valor_desconto: p.valor_desconto,
    valor_ipi: p.valor_ipi,
    valor_icms_st: p.valor_icms_st,
    valor_total: p.valor_total,
    observacoes: '',
    itens: p.itens.map((i) => itemXMLParaCorpo(i, pecaPorId.get(i.parte_peca_id ?? 0))),
  };
}

/**
 * Aplica o vinculo de-para a um item do XML nao reconhecido: peca, fator na
 * quantidade e nos lotes (os lotes do XML vem na unidade do fornecedor) e o
 * item do PC com saldo para a peca.
 */
export function vincularItemXML(
  item: ItemXML,
  peca: PartePeca,
  fator: number,
  itensPC: ItemPedidoCompra[],
  jaUsadoPorItemPC: Map<number, number>,
): ItemXML {
  const recebida = Math.round(item.quantidade * fator);
  const candidatos = itensPC.filter((pc) => pc.parte_peca_id === peca.id);
  const comSaldo = candidatos.find(
    (pc) => pc.quantidade_solicitada - pc.quantidade_recebida - (jaUsadoPorItemPC.get(pc.id) ?? 0) > 0,
  );
  const escolhido = comSaldo ?? candidatos[0];
  return {
    ...item,
    parte_peca_id: peca.id,
    peca_codigo: peca.codigo,
    peca_descricao: peca.descricao,
    fator_conversao: fator,
    quantidade_recebida: recebida,
    item_pedido_compra_id: escolhido?.id ?? null,
    lotes: (item.lotes ?? []).map((l) => ({ ...l, quantidade: Math.round(l.quantidade * fator) })),
  };
}
