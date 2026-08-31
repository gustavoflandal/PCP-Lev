import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api } from '@/servicos/api';
import { useAutenticacao } from '@/store/autenticacao';
import { App } from './App';

function renderizarEm(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    api.defaults.adapter = async (config) => {
      const corpo = config.url?.includes('/auth/login')
        ? {
            access_token: 'token-abc',
            token_type: 'Bearer',
            expires_in: 28800,
            usuario: { id: 1, username: 'admin', nome: 'Gustavo Landal', perfil: 'GESTOR' },
          }
        : { sucesso: true, dados: { status: 'ok', ambiente: 'test' } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { status: 200, data: corpo, headers: {}, config } as any;
    };
  });
  afterEach(() => {
    api.defaults.adapter = undefined;
  });

  it('sem sessao, a raiz leva a tela de login', () => {
    renderizarEm('/');

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('com sessao, a raiz abre a tela inicial dentro do shell', () => {
    useAutenticacao.getState().entrar({
      access_token: 'token-abc',
      token_type: 'Bearer',
      expires_in: 28800,
      usuario: { id: 1, username: 'admin', nome: 'Gustavo Landal', perfil: 'GESTOR' },
    });

    renderizarEm('/');

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Painel' })).toBeInTheDocument();
  });

  it('rota desconhecida volta para a raiz em vez de mostrar tela em branco', () => {
    renderizarEm('/rota-que-nao-existe');

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('apos entrar, leva o usuario para a tela inicial', async () => {
    renderizarEm('/login');

    await userEvent.type(screen.getByLabelText('Usuário'), 'admin');
    await userEvent.type(screen.getByLabelText('Senha'), 'Admin@123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Painel' })).toBeInTheDocument();
  });

  it('com sessao aberta, a tela de login redireciona para a inicial', () => {
    useAutenticacao.getState().entrar({
      access_token: 'token-abc',
      token_type: 'Bearer',
      expires_in: 28800,
      usuario: { id: 1, username: 'admin', nome: 'Gustavo Landal', perfil: 'GESTOR' },
    });

    renderizarEm('/login');

    expect(screen.getByRole('heading', { name: 'Painel' })).toBeInTheDocument();
  });

  it('leva o usuario de volta a rota que ele tentou abrir antes do login', async () => {
    renderizarEm('/');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Usuário'), 'admin');
    await userEvent.type(screen.getByLabelText('Senha'), 'Admin@123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Painel' })).toBeInTheDocument();
  });
});
