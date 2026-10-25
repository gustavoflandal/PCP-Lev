import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CartaoIndicador } from './CartaoIndicador';

function valor() {
  return document.querySelector('[data-valor-indicador]');
}

describe('CartaoIndicador', () => {
  it('rotulo nomeia o cartao e o numero vem em tabular-nums', () => {
    render(<CartaoIndicador rotulo="OPs abertas" valor={1234} />);

    const cartao = screen.getByRole('group', { name: 'OPs abertas' });
    expect(within(cartao).getByText('1.234')).toBeInTheDocument();
    expect(valor()).toHaveClass('tabular');
  });

  it('formata moeda, percentual, dias e horas', () => {
    const { rerender } = render(<CartaoIndicador rotulo="Carteira" valor={1500.5} formato="moeda" />);
    expect(valor()?.textContent).toMatch(/^R\$\s1\.500,50$/);

    rerender(<CartaoIndicador rotulo="OTD" valor={87.5} formato="percentual" />);
    expect(valor()).toHaveTextContent('87,5%');

    rerender(<CartaoIndicador rotulo="Lead time" valor={12.25} formato="dias" />);
    expect(valor()).toHaveTextContent('12,3 dias');

    rerender(<CartaoIndicador rotulo="Lead time" valor={1} formato="dias" />);
    expect(valor()).toHaveTextContent('1 dia');

    rerender(<CartaoIndicador rotulo="Horas" valor={7.5} formato="horas" />);
    expect(valor()).toHaveTextContent('7,5 h');
  });

  it('sem dado (null) mostra travessao e a frase do que falta', () => {
    render(<CartaoIndicador rotulo="Recebido no prazo" valor={null} formato="percentual" semDado="Nenhum pedido recebido no período." />);

    expect(valor()).toHaveTextContent('—');
    expect(screen.getByText('Nenhum pedido recebido no período.')).toBeInTheDocument();
  });

  it('tom de atraso so com numero maior que zero, sempre com icone', () => {
    const { rerender } = render(<CartaoIndicador rotulo="PCs em atraso" valor={2} tom="warning" />);
    expect(valor()).toHaveClass('text-estado-warning');
    expect(valor()?.querySelector('svg')).not.toBeNull();

    rerender(<CartaoIndicador rotulo="PCs em atraso" valor={0} tom="warning" />);
    expect(valor()).toHaveClass('text-texto-primary');
    expect(valor()?.querySelector('svg')).toBeNull();
  });

  it('com destino, o cartao e um link para a tela', () => {
    render(
      <MemoryRouter>
        <CartaoIndicador rotulo="PCs em atraso" valor={2} para="/pedidos-compra" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /PCs em atraso/ })).toHaveAttribute('href', '/pedidos-compra');
  });

  it('sem destino, nao ha link', () => {
    render(<CartaoIndicador rotulo="Horas apontadas" valor={2} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('carregando mostra o esqueleto com nome acessivel', () => {
    render(<CartaoIndicador rotulo="OPs abertas" valor={undefined} carregando />);

    expect(screen.getByTestId('esqueleto-indicador')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('OPs abertas: carregando')).toBeInTheDocument();
  });
});
