import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Paginacao } from './Paginacao';

describe('Paginacao', () => {
  it('informa a posicao e o total de registros', () => {
    render(<Paginacao pagina={2} totalPaginas={5} total={97} aoMudar={vi.fn()} />);

    expect(screen.getByText('Página 2 de 5 · 97 registros')).toBeInTheDocument();
  });

  it('usa o singular quando ha um unico registro', () => {
    render(<Paginacao pagina={1} totalPaginas={1} total={1} aoMudar={vi.fn()} />);

    expect(screen.getByText('Página 1 de 1 · 1 registro')).toBeInTheDocument();
  });

  it('na primeira pagina o botao anterior fica desabilitado', () => {
    render(<Paginacao pagina={1} totalPaginas={3} total={50} aoMudar={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeEnabled();
  });

  it('na ultima pagina o botao proxima fica desabilitado', () => {
    render(<Paginacao pagina={3} totalPaginas={3} total={50} aoMudar={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
  });

  it('avancar pede a pagina seguinte', async () => {
    const aoMudar = vi.fn();
    render(<Paginacao pagina={2} totalPaginas={5} total={97} aoMudar={aoMudar} />);

    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));

    expect(aoMudar).toHaveBeenCalledWith(3);
  });

  it('voltar pede a pagina anterior', async () => {
    const aoMudar = vi.fn();
    render(<Paginacao pagina={2} totalPaginas={5} total={97} aoMudar={aoMudar} />);

    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));

    expect(aoMudar).toHaveBeenCalledWith(1);
  });

  it('some da tela quando nao ha registro nenhum', () => {
    const { container } = render(<Paginacao pagina={1} totalPaginas={0} total={0} aoMudar={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
