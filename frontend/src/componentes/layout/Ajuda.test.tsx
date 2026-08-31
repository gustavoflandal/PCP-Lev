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

  it('o conteudo muda conforme a tela: cotacoes', async () => {
    renderizar('/cotacoes');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Cotações/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: pedidos de compra', async () => {
    renderizar('/pedidos-compra');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Pedidos de compra/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: estoque', async () => {
    renderizar('/estoque');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Estoque/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: preferencias', async () => {
    renderizar('/preferencias');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Preferências/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: necessidade de compra', async () => {
    renderizar('/necessidade-compra');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Necessidade de compra/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: dados da empresa', async () => {
    renderizar('/configuracoes/empresa');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Dados da empresa/ })).toBeInTheDocument();
  });

  it('o conteudo muda conforme a tela: estrutura de produtos', async () => {
    renderizar('/estrutura-produtos');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Estrutura de produtos/ })).toBeInTheDocument();
  });

  it('uma sub-rota de cotacoes cai no conteudo da lista (prefixo)', async () => {
    renderizar('/cotacoes/nova');

    await userEvent.click(screen.getByRole('button', { name: 'Ajuda' }));

    expect(screen.getByRole('dialog', { name: /Cotações/ })).toBeInTheDocument();
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
