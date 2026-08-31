import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutenticacao } from '@/store/autenticacao';
import { MINUTOS_INATIVIDADE } from '@/hooks/useInatividade';
import { RotaProtegida } from './RotaProtegida';

const respostaLogin = {
  access_token: 'token-abc',
  token_type: 'Bearer',
  expires_in: 28800,
  usuario: {
    id: 1, username: 'admin', nome: 'Administrador do Sistema', perfil: 'ADMIN' as const,
    tema: 'automatico' as const, alto_contraste: false, densidade: 'confortavel' as const, tamanho_fonte: 'padrao' as const,
  },
};

function renderizarEm(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/login" element={<p>tela de login</p>} />
        <Route element={<RotaProtegida />}>
          <Route path="/estoque" element={<p>tela de estoque</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RotaProtegida', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
  });
  afterEach(() => vi.useRealTimers());

  it('leva ao login quando nao ha sessao', () => {
    renderizarEm('/estoque');

    expect(screen.getByText('tela de login')).toBeInTheDocument();
    expect(screen.queryByText('tela de estoque')).not.toBeInTheDocument();
  });

  it('libera a tela quando ha sessao', () => {
    useAutenticacao.getState().entrar(respostaLogin);

    renderizarEm('/estoque');

    expect(screen.getByText('tela de estoque')).toBeInTheDocument();
  });

  it('encerra a sessao por inatividade conforme o RNF3', () => {
    vi.useFakeTimers();
    useAutenticacao.getState().entrar(respostaLogin);
    renderizarEm('/estoque');

    act(() => void vi.advanceTimersByTime(MINUTOS_INATIVIDADE * 60 * 1000));

    expect(useAutenticacao.getState().autenticado).toBe(false);
    expect(useAutenticacao.getState().motivoSaida).toBe('inatividade');
  });
});
