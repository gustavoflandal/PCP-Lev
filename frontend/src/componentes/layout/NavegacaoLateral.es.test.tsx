import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PREFERENCIAS_PADRAO, usePreferencias } from '@/store/preferencias';
import { useAutenticacao } from '@/store/autenticacao';
import { entrarComoPerfil } from '@/testes/utilitarios';
import { NavegacaoLateral } from './NavegacaoLateral';

describe('NavegacaoLateral em espanhol', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    entrarComoPerfil('ADMIN');
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'es' });
  });

  afterEach(() => {
    usePreferencias.getState().aplicar(PREFERENCIAS_PADRAO);
  });

  it('mostra secoes e itens do menu em espanhol', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <NavegacaoLateral />
      </MemoryRouter>,
    );

    expect(screen.getByRole('navigation', { name: 'Módulos del sistema' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Panel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Proveedores' })).toHaveAttribute('href', '/fornecedores');
    expect(screen.getByRole('link', { name: 'Productos terminados' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Órdenes de producción' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Fornecedores' })).not.toBeInTheDocument();
  });
});
