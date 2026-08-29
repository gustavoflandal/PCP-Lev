import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge, BadgeSituacao } from './Badge';

describe('Badge', () => {
  it('mostra o rotulo textual junto da cor', () => {
    render(<Badge tom="warning" icone="alert-triangle">Atrasado</Badge>);

    expect(screen.getByText('Atrasado')).toBeInTheDocument();
  });

  it('esconde o icone dos leitores de tela, porque o texto ja informa', () => {
    const { container } = render(<Badge tom="done" icone="check-circle-2">Concluido</Badge>);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('BadgeSituacao', () => {
  it('ativo aparece com rotulo Ativo', () => {
    render(<BadgeSituacao ativo />);

    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('inativo aparece com rotulo Inativo e tom neutro, nao de erro', () => {
    render(<BadgeSituacao ativo={false} />);

    const badge = screen.getByText('Inativo');
    expect(badge).toBeInTheDocument();
    // Inativo e um estado normal do cadastro, nao uma falha.
    expect(badge.className).toContain('estado-neutral');
  });
});
