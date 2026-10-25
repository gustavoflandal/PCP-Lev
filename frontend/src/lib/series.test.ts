import { describe, expect, it } from 'vitest';
import { gerarFaixa, LIMITE_FAIXA, separarLista } from './series';

describe('gerarFaixa', () => {
  it('gera do inicio ao fim com o prefixo', () => {
    expect(gerarFaixa('SN-', '1001', '1003')).toEqual(['SN-1001', 'SN-1002', 'SN-1003']);
  });

  it('mantem os zeros a esquerda do inicio', () => {
    expect(gerarFaixa('SN-', '0008', '0010')).toEqual(['SN-0008', 'SN-0009', 'SN-0010']);
  });

  it('recusa fim menor que o inicio, nao numerico ou grande demais', () => {
    expect(gerarFaixa('', '10', '9')).toBeNull();
    expect(gerarFaixa('', 'A1', '9')).toBeNull();
    expect(gerarFaixa('', '1', String(LIMITE_FAIXA + 1))).toBeNull();
  });
});

describe('separarLista', () => {
  it('aceita linhas, virgulas, ponto e virgula e tabs, sem vazios', () => {
    expect(separarLista('A1\r\nA2,A3; A4\t\n\nA5 ')).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
  });
});
