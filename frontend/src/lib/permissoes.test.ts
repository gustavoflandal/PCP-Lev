import { describe, expect, it } from 'vitest';
import { podeGerenciarCadastros } from './permissoes';

describe('podeGerenciarCadastros', () => {
  it('admin gerencia', () => {
    expect(podeGerenciarCadastros('ADMIN')).toBe(true);
  });

  it('gestor gerencia', () => {
    expect(podeGerenciarCadastros('GESTOR')).toBe(true);
  });

  it('operador so consulta', () => {
    expect(podeGerenciarCadastros('OPERADOR')).toBe(false);
  });

  it('sem sessao, nao gerencia', () => {
    expect(podeGerenciarCadastros(null)).toBe(false);
    expect(podeGerenciarCadastros(undefined)).toBe(false);
  });
});
