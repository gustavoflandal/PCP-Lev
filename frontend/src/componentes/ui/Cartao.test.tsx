import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Cartao } from './Cartao';

describe('Cartao', () => {
  it('exibe o conteudo', () => {
    render(<Cartao>Saldo de insumos</Cartao>);

    expect(screen.getByText('Saldo de insumos')).toBeInTheDocument();
  });

  it('expoe o titulo como cabecalho de secao', () => {
    render(<Cartao titulo="Insumos criticos">3 itens</Cartao>);

    expect(screen.getByRole('heading', { name: 'Insumos criticos' })).toBeInTheDocument();
  });

  it('agrupa titulo e conteudo em uma regiao nomeada', () => {
    render(<Cartao titulo="OPs em atraso">2 ordens</Cartao>);

    expect(screen.getByRole('region', { name: 'OPs em atraso' })).toBeInTheDocument();
  });

  it('exibe acoes ao lado do titulo', () => {
    render(
      <Cartao titulo="Pedidos" acoes={<button type="button">Ver todos</button>}>
        conteudo
      </Cartao>,
    );

    expect(screen.getByRole('button', { name: 'Ver todos' })).toBeInTheDocument();
  });

  it('sem titulo nao cria cabecalho vazio', () => {
    render(<Cartao>apenas conteudo</Cartao>);

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
