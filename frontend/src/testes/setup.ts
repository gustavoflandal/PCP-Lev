import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { useAutenticacao } from '@/store/autenticacao';
import { permissoesDoPerfil } from './permissoesPorPerfil';

afterEach(() => {
  cleanup();
});

// jsdom nao implementa matchMedia -- usado pela resolucao de tema
// "automatico" (store/preferencias.ts). Um mock global aqui evita repetir
// isso em todo teste que passa (direta ou indiretamente, via login) por
// usePreferencias.aplicar.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom nao implementa ResizeObserver nem layout -- usados pelo
// ResponsiveContainer dos graficos (recharts). O falso informa uma medida
// fixa ao observar, para o grafico desenhar (e nao avisar "width(0)").
// Os testes conferem a tabela equivalente ("Ver dados"), nao o desenho.
if (!('ResizeObserver' in window)) {
  class ResizeObserverFalso {
    constructor(private readonly aoMudar: ResizeObserverCallback) {}
    observe(alvo: Element) {
      const contentRect = { width: 800, height: 256, top: 0, left: 0, bottom: 256, right: 800, x: 0, y: 0 } as DOMRectReadOnly;
      this.aoMudar([{ target: alvo, contentRect } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverFalso;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverFalso;
}

// Fixtures de login dos testes foram escritas antes do RBAC e nao trazem
// `permissoes`. O backend real devolve as do perfil no login; aqui o mesmo
// acontece por um espelho da matriz semeada (testes/permissoesPorPerfil.ts).
// Fixtures que informam `permissoes` explicitamente (ex.: para testar a
// ausencia de uma) continuam valendo como estao.
const entrarOriginal = useAutenticacao.getState().entrar;
useAutenticacao.setState({
  entrar: (resposta) =>
    entrarOriginal({
      ...resposta,
      permissoes: resposta.permissoes ?? permissoesDoPerfil(resposta.usuario.perfil),
      perfil_nome: resposta.perfil_nome ?? resposta.usuario.perfil,
    }),
});
