import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BarraDeFiltros } from './BarraDeFiltros';

function renderizar(sobrescritas: Partial<Parameters<typeof BarraDeFiltros>[0]> = {}) {
  const props = {
    busca: '',
    aoBuscar: vi.fn(),
    rotuloBusca: 'Buscar por razão social ou CNPJ',
    filtroAtivo: true as boolean | null,
    aoFiltrarSituacao: vi.fn(),
    ...sobrescritas,
  };
  render(<BarraDeFiltros {...props} />);
  return props;
}

describe('BarraDeFiltros', () => {
  it('o campo de busca tem rotulo proprio da tela', () => {
    renderizar();

    expect(screen.getByLabelText('Buscar por razão social ou CNPJ')).toBeInTheDocument();
  });

  it('digitar avisa a tela a cada tecla', async () => {
    const { aoBuscar } = renderizar();

    await userEvent.type(screen.getByLabelText('Buscar por razão social ou CNPJ'), 'ra');

    expect(aoBuscar).toHaveBeenCalledTimes(2);
    expect(aoBuscar).toHaveBeenLastCalledWith('a');
  });

  it('a situacao comeca em ativos', () => {
    renderizar();

    expect(screen.getByLabelText('Situação')).toHaveValue('ativos');
  });

  it('escolher todos limpa o filtro', async () => {
    const { aoFiltrarSituacao } = renderizar();

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'todos');

    expect(aoFiltrarSituacao).toHaveBeenCalledWith(null);
  });

  it('escolher inativos filtra por falso', async () => {
    const { aoFiltrarSituacao } = renderizar();

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'inativos');

    expect(aoFiltrarSituacao).toHaveBeenCalledWith(false);
  });

  it('mostra a acao passada como filho', () => {
    renderizar({ children: <button type="button">Novo fornecedor</button> });

    expect(screen.getByRole('button', { name: 'Novo fornecedor' })).toBeInTheDocument();
  });
});
