import { describe, expect, it } from 'vitest';
import {
  formatarHorario,
  formatarMes,
  formatarSemana,
  formatarValor,
  formatarValorEixo,
  rotuloEtapa,
  rotuloSituacaoPedidoCompra,
  rotuloSituacaoPedidoVenda,
} from './paineis';

describe('formatacao dos paineis', () => {
  it('mes "AAAA-MM" vira "out/26"', () => {
    expect(formatarMes('2026-10')).toBe('out/26');
    expect(formatarMes('2027-01')).toBe('jan/27');
    expect(formatarMes('qualquer')).toBe('qualquer');
  });

  it('semana (segunda-feira AAAA-MM-DD) vira "20/10"', () => {
    expect(formatarSemana('2026-10-20')).toBe('20/10');
    expect(formatarSemana('Vencidos')).toBe('Vencidos');
  });

  it('situacoes e etapas usam os rotulos do sistema', () => {
    expect(rotuloSituacaoPedidoCompra('Aguardando Entrega')).toBe('Aguardando entrega');
    expect(rotuloSituacaoPedidoCompra('Concluido')).toBe('Concluído');
    expect(rotuloSituacaoPedidoVenda('Em Producao')).toBe('Em produção');
    expect(rotuloSituacaoPedidoVenda('Pronto para Envio')).toBe('Pronto para envio');
    expect(rotuloEtapa('Separacao')).toBe('Separação');
    expect(rotuloEtapa('Expedicao')).toBe('Expedição');
    expect(rotuloEtapa('Aberta')).toBe('Aberta');
  });

  it('valores completos', () => {
    expect(formatarValor(null, 'percentual')).toBe('—');
    expect(formatarValor(1234, 'numero')).toBe('1.234');
    expect(formatarValor(2.5, 'numero')).toBe('2,5');
    expect(formatarValor(1234.5, 'moeda')).toMatch(/^R\$\s1\.234,50$/);
    expect(formatarValor(92.35, 'percentual')).toBe('92,4%');
    expect(formatarValor(3, 'dias')).toBe('3 dias');
    expect(formatarValor(12, 'horas')).toBe('12 h');
  });

  it('valores curtos no eixo', () => {
    expect(formatarValorEixo(12500, 'moeda')).toMatch(/^R\$\s12,5\smil$/);
    expect(formatarValorEixo(80, 'percentual')).toBe('80%');
  });

  it('horario com segundos', () => {
    expect(formatarHorario(new Date(2026, 9, 24, 9, 5, 7).getTime())).toBe('09:05:07');
  });
});
