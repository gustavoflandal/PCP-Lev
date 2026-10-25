import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutenticacao } from '@/store/autenticacao';
import { MINUTOS_INATIVIDADE } from '@/hooks/useInatividade';
import { useModoTV } from '@/store/modoTV';
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
          <Route path="/trocar-senha" element={<p>tela de troca de senha</p>} />
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

  it('com senha temporaria, leva a troca antes de qualquer tela', () => {
    useAutenticacao.getState().entrar({ ...respostaLogin, usuario: { ...respostaLogin.usuario, deve_trocar_senha: true } });

    renderizarEm('/estoque');

    expect(screen.getByText('tela de troca de senha')).toBeInTheDocument();
    expect(screen.queryByText('tela de estoque')).not.toBeInTheDocument();
  });

  it('encerra a sessao por inatividade conforme o RNF3', () => {
    vi.useFakeTimers();
    useAutenticacao.getState().entrar(respostaLogin);
    renderizarEm('/estoque');

    act(() => void vi.advanceTimersByTime(MINUTOS_INATIVIDADE * 60 * 1000));

    expect(useAutenticacao.getState().autenticado).toBe(false);
    expect(useAutenticacao.getState().motivoSaida).toBe('inatividade');
  });

  describe('modo TV dos paineis', () => {
    const LIMITE = MINUTOS_INATIVIDADE * 60 * 1000;

    afterEach(() => {
      useModoTV.setState({ ativo: false });
      delete (document as unknown as Record<string, unknown>).visibilityState;
    });

    it('com o modo TV ativo e a aba visivel, a sessao nao cai por inatividade', () => {
      vi.useFakeTimers();
      useAutenticacao.getState().entrar(respostaLogin);
      useModoTV.setState({ ativo: true });
      renderizarEm('/estoque');

      act(() => void vi.advanceTimersByTime(LIMITE * 3));

      expect(useAutenticacao.getState().autenticado).toBe(true);
    });

    it('com o modo TV ativo mas a aba em segundo plano, a sessao cai normalmente', () => {
      vi.useFakeTimers();
      useAutenticacao.getState().entrar(respostaLogin);
      useModoTV.setState({ ativo: true });
      renderizarEm('/estoque');

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => void document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
      act(() => void vi.advanceTimersByTime(LIMITE));

      expect(useAutenticacao.getState().autenticado).toBe(false);
      expect(useAutenticacao.getState().motivoSaida).toBe('inatividade');
    });

    it('ao sair do modo TV, a contagem volta a correr', () => {
      vi.useFakeTimers();
      useAutenticacao.getState().entrar(respostaLogin);
      useModoTV.setState({ ativo: true });
      renderizarEm('/estoque');
      act(() => void vi.advanceTimersByTime(LIMITE * 2));

      act(() => useModoTV.setState({ ativo: false }));
      act(() => void vi.advanceTimersByTime(LIMITE));

      expect(useAutenticacao.getState().autenticado).toBe(false);
    });
  });
});
