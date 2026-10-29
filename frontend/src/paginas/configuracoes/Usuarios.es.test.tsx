import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao } from '@/store/autenticacao';
import { PREFERENCIAS_PADRAO, usePreferencias } from '@/store/preferencias';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores } from '@/testes/utilitarios';
import { Usuarios } from './Usuarios';

const perfis = [
  { codigo: 'ADMIN', nome: 'Administrador', descricao: 'Acesso total, incluindo configurações e auditoria', sistema: true, permissoes: [], usuarios: 1 },
  { codigo: 'CONSULTA', nome: 'Consulta', descricao: '', sistema: true, permissoes: [], usuarios: 1 },
];
const maria = {
  id: 7, username: 'maria.souza', nome: 'Maria Souza', email: 'maria@exemplo.com', perfil: 'CONSULTA',
  situacao: 'ATIVO', telefone: '', setor: 'Compras', matricula: 'M-42', deve_trocar_senha: true, created_at: '2026-10-01T10:00:00Z',
};

describe('Usuarios (espanhol)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    useToasts.setState({ itens: [] });
    entrarComoPerfil('ADMIN');
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'es' });
  });
  afterEach(() => usePreferencias.getState().aplicar(PREFERENCIAS_PADRAO));

  it('mostra titulo, colunas, situacao e acoes em espanhol', async () => {
    instalarServidorFalso().responder([
      { metodo: 'get', url: '/usuarios/opcoes', status: 200, corpo: { dados: { perfis, permissoes: [] } } },
      { metodo: 'get', url: /^\/usuarios$/, status: 200, corpo: { dados: [maria], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
    ]);

    renderizarComProvedores(<Usuarios />);

    expect(screen.getByRole('heading', { name: 'Usuarios' })).toBeInTheDocument();
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('Contraseña temporal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restablecer contraseña de Maria Souza' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo usuario' })).toBeInTheDocument();
    expect(screen.queryByText('Novo usuário')).not.toBeInTheDocument();
  });
});
