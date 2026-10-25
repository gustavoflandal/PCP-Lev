import { afterEach, describe, expect, it } from 'vitest';
import { nomeDoArquivo, prepararGraficos, restaurarGraficos, tituloDaTela } from './impressao';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('impressao', () => {
  it('nome do arquivo leva a tela, a data e a hora', () => {
    expect(nomeDoArquivo('Pedidos de compra', new Date(2026, 9, 24, 21, 5))).toBe('Pedidos de compra - 2026-10-24 21h05');
  });

  it('titulo: dialogo aberto vence o h1 da tela', () => {
    document.body.innerHTML = '<main><h1>Estoque</h1></main>';
    expect(tituloDaTela()).toBe('Estoque');
    document.body.innerHTML += '<div role="dialog"><h2>Kardex — PLACA</h2></div>';
    expect(tituloDaTela()).toBe('Kardex — PLACA');
  });

  it('graficos ganham viewBox para caber na folha e voltam ao normal depois', () => {
    document.body.innerHTML = '<svg class="recharts-surface" width="800" height="256"></svg>';
    const svg = document.querySelector('svg')!;
    prepararGraficos();
    expect(svg.getAttribute('viewBox')).toBe('0 0 800 256');
    expect(svg.getAttribute('width')).toBe('100%');
    expect(svg.getAttribute('height')).toBe('256');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    prepararGraficos(); // idempotente
    restaurarGraficos();
    expect(svg.getAttribute('width')).toBe('800');
    expect(svg.getAttribute('height')).toBe('256');
    expect(svg.hasAttribute('viewBox')).toBe(false);
    expect(svg.hasAttribute('preserveAspectRatio')).toBe(false);
  });
});
