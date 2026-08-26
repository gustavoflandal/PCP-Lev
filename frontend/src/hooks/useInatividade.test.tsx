import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MINUTOS_INATIVIDADE, useInatividade } from './useInatividade';

function Tela({ aoExpirar, ativo = true }: { aoExpirar: () => void; ativo?: boolean }) {
  useInatividade(aoExpirar, ativo);
  return <div>conteudo</div>;
}

const TRINTA_MINUTOS = MINUTOS_INATIVIDADE * 60 * 1000;

describe('useInatividade', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('o RNF3 define 30 minutos de inatividade', () => {
    expect(MINUTOS_INATIVIDADE).toBe(30);
  });

  it('encerra a sessao apos o periodo sem interacao', () => {
    const aoExpirar = vi.fn();
    render(<Tela aoExpirar={aoExpirar} />);

    act(() => void vi.advanceTimersByTime(TRINTA_MINUTOS));

    expect(aoExpirar).toHaveBeenCalledOnce();
  });

  it('nao encerra antes do periodo', () => {
    const aoExpirar = vi.fn();
    render(<Tela aoExpirar={aoExpirar} />);

    act(() => void vi.advanceTimersByTime(TRINTA_MINUTOS - 1000));

    expect(aoExpirar).not.toHaveBeenCalled();
  });

  it('qualquer interacao reinicia a contagem', () => {
    const aoExpirar = vi.fn();
    render(<Tela aoExpirar={aoExpirar} />);

    act(() => void vi.advanceTimersByTime(TRINTA_MINUTOS - 1000));
    act(() => void window.dispatchEvent(new Event('keydown')));
    act(() => void vi.advanceTimersByTime(TRINTA_MINUTOS - 1000));

    expect(aoExpirar).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(1000));
    expect(aoExpirar).toHaveBeenCalledOnce();
  });

  it('nao conta o tempo enquanto nao ha sessao', () => {
    const aoExpirar = vi.fn();
    render(<Tela aoExpirar={aoExpirar} ativo={false} />);

    act(() => void vi.advanceTimersByTime(TRINTA_MINUTOS * 2));

    expect(aoExpirar).not.toHaveBeenCalled();
  });

  it('para de contar ao desmontar a tela', () => {
    const aoExpirar = vi.fn();
    const { unmount } = render(<Tela aoExpirar={aoExpirar} />);

    unmount();
    act(() => void vi.advanceTimersByTime(TRINTA_MINUTOS * 2));

    expect(aoExpirar).not.toHaveBeenCalled();
  });
});
