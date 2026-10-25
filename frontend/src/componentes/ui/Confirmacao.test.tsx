import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Confirmacao } from './Confirmacao';

function renderizar(sobrescritas: Partial<Parameters<typeof Confirmacao>[0]> = {}) {
  const props = {
    aberto: true,
    titulo: 'Inativar fornecedor',
    mensagem:
      'Inativar o fornecedor Componentes Eletrônicos LTDA? Ele deixa de aparecer nas listas de seleção. O histórico é preservado.',
    rotuloConfirmar: 'Inativar',
    rotuloOcupado: 'Inativando…',
    aoConfirmar: vi.fn(),
    aoCancelar: vi.fn(),
    ...sobrescritas,
  };
  render(<Confirmacao {...props} />);
  return props;
}

describe('Confirmacao', () => {
  it('explica a consequencia da acao', () => {
    renderizar();

    expect(screen.getByText(/deixa de aparecer nas listas de seleção/)).toBeInTheDocument();
  });

  it('confirmar dispara a acao', async () => {
    const { aoConfirmar } = renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Inativar' }));

    expect(aoConfirmar).toHaveBeenCalled();
  });

  it('cancelar nao dispara a acao', async () => {
    const { aoConfirmar, aoCancelar } = renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(aoCancelar).toHaveBeenCalled();
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it('ocupado bloqueia um segundo clique', () => {
    renderizar({ ocupado: true });

    expect(screen.getByRole('button', { name: 'Inativando…' })).toBeDisabled();
  });
});
