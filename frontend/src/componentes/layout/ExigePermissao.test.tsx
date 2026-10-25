import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PERMISSOES } from '@/lib/permissoes';
import { useAutenticacao } from '@/store/autenticacao';
import { entrarComoPerfil } from '@/testes/utilitarios';
import { ExigePermissao } from './ExigePermissao';

describe('ExigePermissao', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
  });

  it('com a permissao, mostra a tela', () => {
    entrarComoPerfil('COMPRADOR');

    render(<ExigePermissao permissao={PERMISSOES.cotacoesVisualizar}><p>Tela de cotações</p></ExigePermissao>);

    expect(screen.getByText('Tela de cotações')).toBeInTheDocument();
  });

  it('sem a permissao (URL direta), explica em vez de mostrar a tela', () => {
    entrarComoPerfil('ALMOXARIFE');

    render(<ExigePermissao permissao={PERMISSOES.cotacoesVisualizar}><p>Tela de cotações</p></ExigePermissao>);

    expect(screen.queryByText('Tela de cotações')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/acesso restrito/i);
  });
});
