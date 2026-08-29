import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('devolve o valor inicial de imediato', () => {
    const { result } = renderHook(() => useDebounce('inicial', 300));

    expect(result.current).toBe('inicial');
  });

  it('so entrega o novo valor depois do atraso', () => {
    const { result, rerender } = renderHook(({ valor }) => useDebounce(valor, 300), {
      initialProps: { valor: 'a' },
    });

    rerender({ valor: 'ab' });
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe('ab');
  });

  it('digitacao continua reinicia a contagem', () => {
    const { result, rerender } = renderHook(({ valor }) => useDebounce(valor, 300), {
      initialProps: { valor: 'a' },
    });

    rerender({ valor: 'ab' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ valor: 'abc' });
    act(() => vi.advanceTimersByTime(200));

    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('abc');
  });
});
