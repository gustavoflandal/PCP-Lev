import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toasts, useToasts } from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToasts.setState({ itens: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sem toast, nada aparece', () => {
    render(<Toasts />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('mostra a mensagem no verbo passado', () => {
    render(<Toasts />);

    act(() => {
      useToasts.getState().mostrar('Fornecedor cadastrado');
    });

    expect(screen.getByText('Fornecedor cadastrado')).toBeInTheDocument();
  });

  it('a regiao e anunciada como status, sem roubar o foco', () => {
    render(<Toasts />);

    act(() => {
      useToasts.getState().mostrar('Fornecedor cadastrado');
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('some sozinho depois de 4 segundos', () => {
    render(<Toasts />);

    act(() => {
      useToasts.getState().mostrar('Fornecedor cadastrado');
    });
    expect(screen.getByText('Fornecedor cadastrado')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('Fornecedor cadastrado')).not.toBeInTheDocument();
  });

  it('empilha mais de um aviso', () => {
    render(<Toasts />);

    act(() => {
      useToasts.getState().mostrar('Fornecedor cadastrado');
      useToasts.getState().mostrar('Peça atualizada');
    });

    expect(screen.getByText('Fornecedor cadastrado')).toBeInTheDocument();
    expect(screen.getByText('Peça atualizada')).toBeInTheDocument();
  });

  it('tom de falha usa o estado pendente', () => {
    render(<Toasts />);

    act(() => {
      useToasts.getState().mostrar('Não foi possível inativar', 'pending');
    });

    expect(screen.getByText('Não foi possível inativar').closest('li')?.className).toContain(
      'estado-pending',
    );
  });
});
