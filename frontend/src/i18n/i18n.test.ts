import { beforeEach, describe, expect, it } from 'vitest';
import { PREFERENCIAS_PADRAO, usePreferencias } from '@/store/preferencias';
import { marcar, t, td } from './index';

describe('t()', () => {
  beforeEach(() => usePreferencias.getState().aplicar(PREFERENCIAS_PADRAO));

  it('em portugues devolve o proprio texto e interpola', () => {
    expect(t('Texto sem traducao')).toBe('Texto sem traducao');
    expect(t('Versão {n} criada', { n: 3 })).toBe('Versão 3 criada');
  });

  it('em espanhol traduz; sem traducao cai no portugues', () => {
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'es' });
    expect(t('Preferências')).toBe('Preferencias');
    expect(t('Texto sem traducao')).toBe('Texto sem traducao');
    expect(td('Escuro')).toBe('Oscuro');
    expect(td(null)).toBe('');
    expect(marcar('Preferências')).toBe('Preferências');
  });

  it('troca o atributo lang do documento', () => {
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'es' });
    expect(document.documentElement.getAttribute('lang')).toBe('es');
    usePreferencias.getState().aplicar(PREFERENCIAS_PADRAO);
    expect(document.documentElement.getAttribute('lang')).toBe('pt-BR');
  });
});
