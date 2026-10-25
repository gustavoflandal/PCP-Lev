import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutenticacao } from '@/store/autenticacao';
import { PERMISSOES, podeNaSessao, usePode } from './permissoes';

function entrarCom(permissoes: string[]) {
  useAutenticacao.getState().entrar({
    access_token: 't', token_type: 'Bearer', expires_in: 60,
    usuario: { id: 1, username: 'u', nome: 'U', perfil: 'GESTOR', tema: 'automatico', alto_contraste: false, densidade: 'compacta', tamanho_fonte: 'padrao' },
    permissoes,
    perfil_nome: 'Gestor',
  });
}

describe('permissoes', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
  });

  it('sem sessao, nada e permitido', () => {
    expect(podeNaSessao(PERMISSOES.fornecedoresIncluir)).toBe(false);
  });

  it('libera so o que veio no login', () => {
    entrarCom([PERMISSOES.fornecedoresIncluir]);

    expect(podeNaSessao(PERMISSOES.fornecedoresIncluir)).toBe(true);
    expect(podeNaSessao(PERMISSOES.fornecedoresInativar)).toBe(false);
  });

  it('usePode acompanha a atualizacao da sessao (/auth/eu)', () => {
    entrarCom([]);
    const { result, rerender } = renderHook(() => usePode(PERMISSOES.estoqueAjustar));
    expect(result.current).toBe(false);

    useAutenticacao.getState().atualizarAcessoSessao({ permissoes: [PERMISSOES.estoqueAjustar], perfil_nome: 'Almoxarife' });
    rerender();

    expect(result.current).toBe(true);
  });
});
