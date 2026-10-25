import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Selecao } from './Selecao';

const opcoes = [
  { valor: 'und', rotulo: 'Unidade' },
  { valor: 'kg', rotulo: 'Quilograma' },
];

describe('Selecao', () => {
  it('associa o rotulo ao controle', () => {
    render(<Selecao rotulo="Unidade de medida" opcoes={opcoes} />);

    expect(screen.getByLabelText('Unidade de medida')).toBeInTheDocument();
  });

  it('lista as opcoes recebidas', () => {
    render(<Selecao rotulo="Unidade de medida" opcoes={opcoes} />);

    expect(screen.getByRole('option', { name: 'Unidade' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Quilograma' })).toBeInTheDocument();
  });

  it('seleciona o valor escolhido', async () => {
    const aoMudar = vi.fn();
    render(<Selecao rotulo="Unidade de medida" opcoes={opcoes} onChange={aoMudar} />);

    await userEvent.selectOptions(screen.getByLabelText('Unidade de medida'), 'kg');

    expect(aoMudar).toHaveBeenCalled();
  });

  it('erro marca o campo como invalido e diz o que fazer', () => {
    render(
      <Selecao rotulo="Unidade de medida" opcoes={opcoes} erro="Escolha a unidade de medida" />,
    );

    const controle = screen.getByLabelText('Unidade de medida');
    expect(controle).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha a unidade de medida');
  });

  it('obrigatorio marca o rotulo', () => {
    render(<Selecao rotulo="Unidade de medida" opcoes={opcoes} obrigatorio />);

    expect(screen.getByLabelText(/Unidade de medida/)).toBeRequired();
  });
});
