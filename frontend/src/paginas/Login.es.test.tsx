import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PREFERENCIAS_PADRAO, usePreferencias } from '@/store/preferencias';
import { useAutenticacao } from '@/store/autenticacao';
import { instalarServidorFalso, renderizarComProvedores } from '@/testes/utilitarios';
import { Login } from './Login';

describe('Login em espanhol', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    instalarServidorFalso();
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'es' });
  });

  afterEach(() => {
    usePreferencias.getState().aplicar(PREFERENCIAS_PADRAO);
  });

  it('mostra rotulos, botao e versao em espanhol', () => {
    renderizarComProvedores(<Login />);

    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByTestId('versao-sistema')).toHaveTextContent(/^Versión .* · publicada el /);
  });

  it('valida os campos vazios com mensagens em espanhol', async () => {
    renderizarComProvedores(<Login />);

    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Ingrese el usuario')).toBeInTheDocument();
    expect(screen.getByText('Ingrese la contraseña')).toBeInTheDocument();
  });
});
