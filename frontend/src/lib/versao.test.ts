import { describe, expect, it } from 'vitest';
import { descreverVersao, formatarPublicacao } from './versao';

describe('versao', () => {
  it('formata a publicacao no fuso de Sao Paulo', () => {
    expect(formatarPublicacao('2026-10-29T02:19:00Z')).toMatch(/28\/10\/2026.*23:19/);
  });

  it('devolve o texto original quando a data e invalida', () => {
    expect(formatarPublicacao('nao-e-data')).toBe('nao-e-data');
  });

  it('descreve versao, commit e data', () => {
    const texto = descreverVersao({ versao: '1.1.0', commit: 'a125f59', publicadoEm: '2026-10-29T02:19:00Z' });
    expect(texto).toMatch(/^Versão 1\.1\.0 \(a125f59\) · publicada em 28\/10\/2026/);
  });

  it('omite o commit quando nao foi informado', () => {
    const texto = descreverVersao({ versao: '1.1.0', commit: '', publicadoEm: '2026-10-29T02:19:00Z' });
    expect(texto).toMatch(/^Versão 1\.1\.0 · publicada/);
  });
});
