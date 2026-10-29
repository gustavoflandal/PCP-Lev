import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAutenticacao } from '@/store/autenticacao';
import { useModoTV } from '@/store/modoTV';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores } from '@/testes/utilitarios';
import { Shell } from './Shell';

function renderizar() {
  return renderizarComProvedores(
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<p>conteudo da tela</p>} />
      </Route>
    </Routes>,
  );
}

describe('Shell', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    entrarComoPerfil('GESTOR');
    // Configuracao regional, logo e /auth/eu: a falha cai nos padroes, o que basta aqui.
    instalarServidorFalso().responder([]);
  });
  afterEach(() => useModoTV.setState({ ativo: false }));

  it('mostra cabecalho, navegacao e conteudo', async () => {
    renderizar();

    expect(await screen.findByText('conteudo da tela')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Módulos do sistema' })).toBeInTheDocument();
  });

  it('a janela fica fixa: o menu lateral e o conteudo rolam cada um por conta propria', async () => {
    const { container } = renderizar();
    await screen.findByText('conteudo da tela');

    expect(container.firstElementChild).toHaveClass('h-screen', 'overflow-hidden');
    expect(screen.getByRole('navigation', { name: 'Módulos do sistema' })).toHaveClass('overflow-y-auto');
    expect(screen.getByRole('main')).toHaveClass('overflow-y-auto');
  });

  it('no modo TV, so o conteudo fica na tela', async () => {
    useModoTV.setState({ ativo: true });
    renderizar();

    expect(await screen.findByText('conteudo da tela')).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Módulos do sistema' })).not.toBeInTheDocument();
  });
});
