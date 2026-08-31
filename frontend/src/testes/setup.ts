import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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
