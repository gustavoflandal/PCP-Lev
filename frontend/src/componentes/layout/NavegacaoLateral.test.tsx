import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { NavegacaoLateral } from './NavegacaoLateral';

function renderizarEm(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <NavegacaoLateral />
    </MemoryRouter>,
  );
}

describe('NavegacaoLateral', () => {
  it('lista os cadastros disponiveis', () => {
    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Painel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Produtos acabados' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Partes e peças' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fornecedores' })).toBeInTheDocument();
  });

  it('marca a rota atual para leitor de tela', () => {
    renderizarEm('/fornecedores');

    expect(screen.getByRole('link', { name: 'Fornecedores' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current');
  });

  it('compras ja sao links reais', () => {
    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Cotações' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedidos de compra' })).toBeInTheDocument();
  });

  it('modulos de sprint futura aparecem, mas nao sao links', () => {
    renderizarEm('/');

    expect(screen.queryByRole('link', { name: /Produção/ })).not.toBeInTheDocument();
    expect(screen.getByText('Produção')).toBeInTheDocument();
    expect(screen.getAllByText('Próxima sprint').length).toBeGreaterThan(0);
  });

  it('a navegacao tem nome acessivel', () => {
    renderizarEm('/');

    expect(screen.getByRole('navigation', { name: 'Módulos do sistema' })).toBeInTheDocument();
  });

  it('estoque ja e um link real', () => {
    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Estoque' })).toHaveAttribute('href', '/estoque');
  });
});
