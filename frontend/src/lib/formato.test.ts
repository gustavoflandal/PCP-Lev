import { describe, expect, it } from 'vitest';
import { formatarCNPJ, formatarDias, formatarMoeda } from './formato';

describe('formatarCNPJ', () => {
  it('pontua os 14 digitos vindos da API', () => {
    expect(formatarCNPJ('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('devolve como veio quando nao tem 14 digitos', () => {
    expect(formatarCNPJ('112223')).toBe('112223');
  });

  it('vazio continua vazio', () => {
    expect(formatarCNPJ('')).toBe('');
  });
});

describe('formatarMoeda', () => {
  it('formata em reais com duas casas', () => {
    // O espaco entre "R$" e o numero e o U+00A0 do Intl, nao um espaco comum.
    expect(formatarMoeda(5000)).toBe('R$ 5.000,00');
  });

  it('mantem os centavos', () => {
    expect(formatarMoeda(1234.5)).toBe('R$ 1.234,50');
  });
});

describe('formatarDias', () => {
  it('usa o singular para um dia', () => {
    expect(formatarDias(1)).toBe('1 dia');
  });

  it('usa o plural para os demais', () => {
    expect(formatarDias(7)).toBe('7 dias');
  });
});
