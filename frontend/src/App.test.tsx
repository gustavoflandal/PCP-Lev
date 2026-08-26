import { render, screen } from '@testing-library/react';
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
    api.defaults.adapter = async (config) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ status: 200, data: { sucesso: true, dados: { status: 'ok', ambiente: 'test' } }, headers: {}, config }) as any;
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
    expect(screen.getByRole('heading', { name: 'Início' })).toBeInTheDocument();
  });

  it('rota desconhecida volta para a raiz em vez de mostrar tela em branco', () => {
    renderizarEm('/rota-que-nao-existe');

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });
});
