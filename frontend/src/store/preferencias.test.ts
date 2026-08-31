import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFERENCIAS_PADRAO, resolverTema, usePreferencias } from './preferencias';

describe('resolverTema', () => {
  it('devolve claro/escuro diretamente, ignorando a preferencia do SO', () => {
    expect(resolverTema('claro', true)).toBe('claro');
    expect(resolverTema('escuro', false)).toBe('escuro');
  });

  it('automatico segue a preferencia do SO', () => {
    expect(resolverTema('automatico', true)).toBe('escuro');
    expect(resolverTema('automatico', false)).toBe('claro');
  });
});

describe('usePreferencias', () => {
  beforeEach(() => {
    usePreferencias.setState({ preferencias: PREFERENCIAS_PADRAO });
    document.documentElement.removeAttribute('data-tema');
    document.documentElement.removeAttribute('data-alto-contraste');
    document.documentElement.removeAttribute('data-densidade');
    document.documentElement.removeAttribute('data-fonte');
    localStorage.clear();
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
  });

  it('aplicar seta os atributos no <html>', () => {
    usePreferencias.getState().aplicar({
      tema: 'escuro', alto_contraste: true, densidade: 'compacta', tamanho_fonte: 'grande',
    });

    const el = document.documentElement;
    expect(el.getAttribute('data-tema')).toBe('escuro');
    expect(el.getAttribute('data-alto-contraste')).toBe('true');
    expect(el.getAttribute('data-densidade')).toBe('compacta');
    expect(el.getAttribute('data-fonte')).toBe('grande');
  });

  it('aplicar sem alto contraste remove o atributo', () => {
    document.documentElement.setAttribute('data-alto-contraste', 'true');

    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, alto_contraste: false });

    expect(document.documentElement.hasAttribute('data-alto-contraste')).toBe(false);
  });

  it('aplicar grava o cache local para o script de index.html reaplicar sem flash', () => {
    usePreferencias.getState().aplicar({
      tema: 'escuro', alto_contraste: false, densidade: 'compacta', tamanho_fonte: 'padrao',
    });

    const salvo = JSON.parse(localStorage.getItem('pcp.preferencias') ?? '{}');
    expect(salvo.tema).toBe('escuro');
    expect(salvo.densidade).toBe('compacta');
  });

  it('aplicar atualiza o estado da store', () => {
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, tamanho_fonte: 'extra-grande' });

    expect(usePreferencias.getState().preferencias.tamanho_fonte).toBe('extra-grande');
  });
});
