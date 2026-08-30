import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Ajuda } from './Ajuda';

function renderizar(rota = '/') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Ajuda />
    </MemoryRouter>,
  );
}

describe('Ajuda', () => {
  it('mostra um botao de ajuda com rotulo textual', () => {
    renderizar();

    expect(screen.getByRole('button', { name: 'Ajuda' })).toBeInTheDocument();
  });

  it('fechado nao mostra o conteudo de ajuda', () => {
    renderizar();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre um dialogo com o conteudo da tela atual', async () => {
    renderizar('/fornecedores');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Fornecedores/ })).toBeInTheDocument();
    expect(screen.getByText(/Novo fornecedor/)).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: partes e pecas', async () => {
    renderizar('/partes-pecas');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Partes e peças/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: produtos acabados', async () => {
    renderizar('/produtos-acabados');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Produtos acabados/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: painel', async () => {
    renderizar('/');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Painel/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: login', async () => {
    renderizar('/login');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Entrar/ })).toBeInTheDocument();
  });

  it('uma rota desconhecida mostra o conteudo generico', async () => {
    renderizar('/rota-que-nao-existe');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('fecha ao clicar em Fechar', async () => {
    renderizar('/fornecedores');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
