import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutenticacao } from '@/store/autenticacao';
import { Cabecalho } from './Cabecalho';

const navegar = vi.fn();
vi.mock('react-router-dom', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('react-router-dom')>();
  return { ...original, useNavigate: () => navegar };
});

const respostaLogin = {
  access_token: 'token-abc',
  token_type: 'Bearer',
  expires_in: 28800,
  usuario: {
    id: 1, username: 'admin', nome: 'Gustavo Landal', perfil: 'GESTOR' as const,
    tema: 'automatico' as const, alto_contraste: false, densidade: 'confortavel' as const, tamanho_fonte: 'padrao' as const,
  },
};

function renderizar() {
  return render(
    <MemoryRouter>
      <Cabecalho />
    </MemoryRouter>,
  );
}

describe('Cabecalho', () => {
  beforeEach(() => {
    navegar.mockClear();
    sessionStorage.clear();
    useAutenticacao.getState().entrar(respostaLogin);
  });

  it('identifica quem esta operando o sistema', () => {
    renderizar();

    expect(screen.getByText('Gustavo Landal')).toBeInTheDocument();
  });

  it('mostra o perfil com rotulo textual, nao apenas por cor', () => {
    renderizar();

    expect(screen.getByText('Gestor')).toBeInTheDocument();
  });

  it('encerra a sessao ao sair', async () => {
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(useAutenticacao.getState().autenticado).toBe(false);
  });

  it('sair manualmente nao registra motivo de expiracao', async () => {
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(useAutenticacao.getState().motivoSaida).toBeNull();
  });

  it('e um cabecalho de pagina para a navegacao por leitor de tela', () => {
    renderizar();

    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('Preferencias navega para a tela de preferencias', async () => {
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Preferências' }));

    expect(navegar).toHaveBeenCalledWith('/preferencias');
  });
});
