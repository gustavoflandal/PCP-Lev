import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIGURACAO_REGIONAL_PADRAO, useConfiguracaoRegional } from '@/store/configuracaoRegional';
import {
  formatarBytes, formatarCNPJ, formatarData, formatarDataComFormato, formatarDataHora,
  formatarDias, formatarHoraComFormato, formatarMilissegundos, formatarMoeda,
} from './formato';

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

describe('formatarData', () => {
  it('converte AAAA-MM-DD (contrato da API) para DD/MM/AAAA', () => {
    expect(formatarData('2026-09-25')).toBe('25/09/2026');
  });

  it('ignora a hora quando a API manda um timestamp completo', () => {
    expect(formatarData('2026-09-25T00:00:00Z')).toBe('25/09/2026');
  });

  it('data ausente vira travessao, nao uma string vazia sem sentido', () => {
    expect(formatarData(undefined)).toBe('—');
  });
});

describe('formatarDataComFormato', () => {
  it('DD/MM/AAAA', () => {
    expect(formatarDataComFormato('2026-08-31', 'DD/MM/AAAA')).toBe('31/08/2026');
  });

  it('DD-MM-AAAA', () => {
    expect(formatarDataComFormato('2026-08-31', 'DD-MM-AAAA')).toBe('31-08-2026');
  });

  it('AAAA-MM-DD', () => {
    expect(formatarDataComFormato('2026-08-31', 'AAAA-MM-DD')).toBe('2026-08-31');
  });
});

describe('formatarHoraComFormato', () => {
  it('24H mantém duas casas', () => {
    expect(formatarHoraComFormato(9, 5, '24H')).toBe('09:05');
    expect(formatarHoraComFormato(23, 59, '24H')).toBe('23:59');
  });

  it('12H com AM/PM', () => {
    expect(formatarHoraComFormato(0, 0, '12H')).toBe('12:00 AM');
    expect(formatarHoraComFormato(13, 30, '12H')).toBe('01:30 PM');
    expect(formatarHoraComFormato(12, 0, '12H')).toBe('12:00 PM');
  });
});

describe('formatarData respeitando a configuração', () => {
  beforeEach(() => {
    useConfiguracaoRegional.setState({ configuracao: CONFIGURACAO_REGIONAL_PADRAO });
  });

  it('usa AAAA-MM-DD quando configurado', () => {
    useConfiguracaoRegional.getState().aplicar({ formato_data: 'AAAA-MM-DD', formato_hora: '24H' });
    expect(formatarData('2026-08-31')).toBe('2026-08-31');
  });
});

describe('formatarDataHora', () => {
  beforeEach(() => {
    useConfiguracaoRegional.setState({ configuracao: CONFIGURACAO_REGIONAL_PADRAO });
  });

  it('combina data e hora no formato padrão', () => {
    // O ambiente de teste roda em UTC (vitest/jsdom) -- o mesmo valor que o
    // getHours()/getDate() locais devolvem.
    expect(formatarDataHora('2026-08-31T14:05:00-00:00')).toBe('31/08/2026 14:05');
  });

  it('respeita o formato de hora 12H configurado', () => {
    useConfiguracaoRegional.getState().aplicar({ formato_data: 'DD/MM/AAAA', formato_hora: '12H' });
    expect(formatarDataHora('2026-08-31T14:05:00-00:00')).toBe('31/08/2026 02:05 PM');
  });
});

describe('formatarBytes', () => {
  it('escolhe a maior unidade binaria e usa virgula decimal', () => {
    expect(formatarBytes(512)).toBe('512 B');
    expect(formatarBytes(1536)).toBe('1,5 KB');
    expect(formatarBytes(12_884_901)).toBe('12,3 MB');
    expect(formatarBytes(5 * 1024 ** 3)).toBe('5 GB');
  });
});

describe('formatarMilissegundos', () => {
  it('uma casa decimal', () => {
    expect(formatarMilissegundos(0.84)).toBe('0,8 ms');
    expect(formatarMilissegundos(12)).toBe('12 ms');
  });
});
