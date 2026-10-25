/**
 * Fixturas dos testes do recebimento fiscal (so testes). Espelham os corpos
 * reais de backend/internal/api/handlers/notas_entrada_test.go: placa com
 * lote + validade, conector com serie, parafuso em caixa de 100.
 */
import type { RotaFalsa } from '@/testes/utilitarios';

const SEM_FLAGS = {
  controla_numero_serie: false,
  controla_lote: false,
  controla_validade: false,
  item_critico: false,
  exige_certificado: false,
};

export const PECAS = [
  { id: 1, codigo: 'PLACA', descricao: 'Placa controladora', unidade_medida: 'UN', ativo: true, ...SEM_FLAGS, controla_lote: true, controla_validade: true },
  { id: 2, codigo: 'CONECTOR', descricao: 'Conector serial', unidade_medida: 'UN', ativo: true, ...SEM_FLAGS, controla_numero_serie: true },
  { id: 3, codigo: 'PARAFUSO', descricao: 'Parafuso M3', unidade_medida: 'UN', ativo: true, ...SEM_FLAGS },
];

export const FORNECEDOR = { id: 1, razao_social: 'Eletrônica Fornecedora', cnpj: '11222333000181', ativo: true };

export const PEDIDO = {
  id: 1,
  numero_pc: 'PC-NF-1',
  fornecedor_id: 1,
  data_pedido: '2026-10-10',
  data_entrega_prevista: '2026-10-30',
  valor_total: 1000,
  status: 'Aguardando Entrega',
  itens: [
    { id: 11, parte_peca_id: 1, quantidade_solicitada: 10, quantidade_recebida: 0, preco_unitario: 50, total: 500 },
    { id: 12, parte_peca_id: 2, quantidade_solicitada: 3, quantidade_recebida: 0, preco_unitario: 20, total: 60 },
    { id: 13, parte_peca_id: 3, quantidade_solicitada: 1000, quantidade_recebida: 0, preco_unitario: 0.1, total: 100 },
  ],
  created_at: '2026-10-10T12:00:00Z',
  updated_at: '2026-10-10T12:00:00Z',
};

export function pagina<T>(dados: T[]) {
  return { sucesso: true, dados, paginacao: { pagina: 1, limite: 200, total: dados.length, total_paginas: 1 } };
}

export function itemNota(ordem: number, parte: 1 | 2 | 3, extra: Record<string, unknown> = {}) {
  const peca = PECAS[parte - 1];
  return {
    id: 100 + ordem,
    ordem,
    item_pedido_compra_id: 10 + parte,
    numero_pc: 'PC-NF-1',
    parte_peca_id: parte,
    peca_codigo: peca.codigo,
    peca_descricao: peca.descricao,
    peca_unidade: 'UN',
    controle: {
      controla_numero_serie: peca.controla_numero_serie,
      controla_lote: peca.controla_lote,
      controla_validade: peca.controla_validade,
      item_critico: false,
      exige_certificado: false,
    },
    codigo_fornecedor: '',
    descricao_nf: '',
    unidade_nf: 'UN',
    quantidade_nf: 3,
    valor_unitario: 20,
    valor_total: 60,
    fator_conversao: 1,
    quantidade_recebida: 3,
    bonificacao: false,
    justificativa_bonificacao: '',
    lotes: [],
    series: [],
    pc_preco_unitario: 20,
    pc_quantidade_solicitada: 3,
    pc_quantidade_recebida: 0,
    ...extra,
  };
}

export function notaBase(status: string, itens: unknown[] = [], extra: Record<string, unknown> = {}) {
  return {
    id: 5,
    pedido_compra_id: 1,
    numero_pc: 'PC-NF-1',
    fornecedor_id: 1,
    fornecedor_nome: 'Eletrônica Fornecedora',
    cnpj_emitente: '11222333000181',
    modelo: '55',
    serie: '1',
    numero: '101',
    chave_acesso: '31261011222333000181550010000001011000001010',
    data_emissao: '2026-10-22',
    data_entrada: '2026-10-24',
    cfop: '1102',
    valor_produtos: 60,
    valor_frete: 0,
    valor_seguro: 0,
    valor_desconto: 0,
    valor_ipi: 0,
    valor_icms_st: 0,
    valor_total: 60,
    status,
    origem: 'MANUAL',
    observacoes: '',
    itens,
    created_at: '2026-10-24T10:00:00Z',
    ...extra,
  };
}

/** Rotas de apoio da tela da nota (cadastros, PCs que recebem, anexos). */
export function rotasDeApoio(): RotaFalsa[] {
  return [
    { metodo: 'get', url: '/fornecedores', status: 200, corpo: pagina([FORNECEDOR]) },
    { metodo: 'get', url: '/partes-pecas', status: 200, corpo: pagina(PECAS) },
    { metodo: 'get', url: '/pedidos-compra', status: 200, corpo: pagina([PEDIDO]) },
    { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: PEDIDO } },
    { metodo: 'get', url: '/anexos', status: 200, corpo: { sucesso: true, dados: [] } },
  ];
}
