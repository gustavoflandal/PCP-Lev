import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LogoFabrica } from './LogoFabrica';

describe('LogoFabrica', () => {
  it('sem titulo e decorativa (fora da arvore de acessibilidade)', () => {
    const { container } = render(<LogoFabrica />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('com titulo e anunciada pelo nome', () => {
    render(<LogoFabrica titulo="Sistema PCP" tamanho={48} />);
    const logo = screen.getByRole('img', { name: 'Sistema PCP' });
    expect(logo).toHaveAttribute('width', '48');
  });
});
