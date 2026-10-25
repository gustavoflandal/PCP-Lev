import { describe, expect, it } from 'vitest';
import type { PartePeca } from '@/tipos/cadastros';
import type { ItemXML } from '@/tipos/notasEntrada';
import {
  formularioVazio,
  itemDoPedido,
  itemParaCorpo,
  paraNumero,
  quantidadeEsperada,
  validarParaSalvar,
  vincularItemXML,
} from './modeloNota';

const peca = {
  id: 3, codigo: 'PARAFUSO', descricao: 'Parafuso M3', unidade_medida: 'UN', ativo: true,
  controla_lote: true, controla_validade: false, controla_numero_serie: false, item_critico: false, exige_certificado: false,
} as PartePeca;

describe('modeloNota', () => {
  it('paraNumero aceita virgula decimal e milhar com ponto', () => {
    expect(paraNumero('1.234,5')).toBe(1234.5);
    expect(paraNumero('0.10')).toBe(0.1);
    expect(paraNumero('')).toBe(0);
    expect(paraNumero('abc')).toBe(0);
  });

  it('item do pedido sugere o saldo pendente e o preco do PC', () => {
    const item = itemDoPedido(
      { id: 13, parte_peca_id: 3, quantidade_solicitada: 1000, quantidade_recebida: 900, preco_unitario: 0.1, total: 100 },
      'PC-1',
      peca,
    );
    expect(item.quantidade_nf).toBe('100');
    expect(item.valor_total).toBe('10');
    expect(item.controle.controla_lote).toBe(true);
    expect(quantidadeEsperada({ ...item, quantidade_nf: '9', fator_conversao: '100' })).toBe(900);
  });

  it('item sem controle de lote nao envia lotes; validade so com controle de validade', () => {
    const item = itemDoPedido({ id: 13, parte_peca_id: 3, quantidade_solicitada: 10, quantidade_recebida: 0, preco_unitario: 1, total: 10 }, 'PC-1', peca);
    const comLote = itemParaCorpo({
      ...item,
      lotes: [{ chave: 'l', numero_lote: ' L1 ', quantidade: '10', data_fabricacao: '', validade: '2027-01-01', certificado_arquivo_id: null }],
    });
    expect(comLote.lotes).toEqual([{ numero_lote: 'L1', quantidade: 10, data_fabricacao: null, validade: null, certificado_arquivo_id: null }]);
    const semLote = itemParaCorpo({ ...item, controle: { ...item.controle, controla_lote: false }, lotes: comLote.lotes as never });
    expect(semLote.lotes).toEqual([]);
  });

  it('validarParaSalvar exige pedido, serie/numero em digitos e chave de 44 digitos quando informada', () => {
    const erros = validarParaSalvar({ ...formularioVazio(), serie: 'A', numero: '', chave_acesso: '123' });
    expect(Object.keys(erros).sort()).toEqual(['chave_acesso', 'numero', 'pedido_compra_id', 'serie']);
    expect(validarParaSalvar({ ...formularioVazio('1'), numero: '10' })).toEqual({});
  });

  it('vincular item do XML aplica o fator na quantidade e nos lotes e acha o item do PC com saldo', () => {
    const item: ItemXML = {
      numero_item: 1, codigo_fornecedor: 'CX-M3', descricao: 'Caixa parafuso', unidade: 'CX', cfop: '5102',
      quantidade: 9, valor_unitario: 10, valor_total: 90, fator_conversao: 1, quantidade_recebida: 0,
      lotes: [{ numero_lote: 'L1', quantidade: 9 }],
    };
    const pc = [
      { id: 20, parte_peca_id: 3, quantidade_solicitada: 100, quantidade_recebida: 100, preco_unitario: 0.1, total: 10 },
      { id: 21, parte_peca_id: 3, quantidade_solicitada: 1000, quantidade_recebida: 0, preco_unitario: 0.1, total: 100 },
    ];
    const vinculado = vincularItemXML(item, peca, 100, pc, new Map());
    expect(vinculado).toMatchObject({
      parte_peca_id: 3, peca_codigo: 'PARAFUSO', fator_conversao: 100, quantidade_recebida: 900, item_pedido_compra_id: 21,
      lotes: [{ numero_lote: 'L1', quantidade: 900 }],
    });
  });
});
