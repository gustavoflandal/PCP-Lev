import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useModoTV } from '@/store/modoTV';
import { GradeGraficos } from './PaginaPainel';

const graficos = (n: number) => Array.from({ length: n }, (_, i) => <section key={i}>g{i}</section>);

describe('GradeGraficos', () => {
  afterEach(() => useModoTV.setState({ ativo: false }));

  it('fora do modo TV: duas colunas a partir de telas medias, altura livre', () => {
    const { container } = render(<GradeGraficos>{graficos(4)}</GradeGraficos>);
    expect(container.firstElementChild).toHaveClass('lg:grid-cols-2');
    expect(container.firstElementChild).not.toHaveClass('flex-1');
  });

  it.each([
    [2, 'grid-cols-2'],
    [3, 'grid-cols-3'],
    [4, 'grid-cols-2'],
    [6, 'grid-cols-3'],
  ])('modo TV com %i graficos: ocupa a altura que sobra e usa %s', (quantidade, colunas) => {
    useModoTV.setState({ ativo: true });
    const { container } = render(<GradeGraficos>{graficos(quantidade)}</GradeGraficos>);
    expect(container.firstElementChild).toHaveClass('flex-1', 'min-h-0', colunas);
  });
});
