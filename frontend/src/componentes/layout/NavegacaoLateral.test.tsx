import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAutenticacao } from '@/store/autenticacao';
import { NavegacaoLateral } from './NavegacaoLateral';

const respostaLogin = (perfil: 'ADMIN' | 'GESTOR' | 'OPERADOR') => ({
  access_token: 'token-abc', token_type: 'Bearer', expires_in: 28800,
  usuario: {
    id: 1, username: 'usuario', nome: 'Usuario', perfil,
    tema: 'automatico' as const, alto_contraste: false, densidade: 'compacta' as const, tamanho_fonte: 'padrao' as const,
  },
});

function renderizarEm(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <NavegacaoLateral />
    </MemoryRouter>,
  );
}

describe('NavegacaoLateral', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
  });

  it('lista os cadastros disponiveis', () => {
    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Painel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Produtos acabados' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Partes e peças' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fornecedores' })).toBeInTheDocument();
  });

  it('marca a rota atual para leitor de tela', () => {
    renderizarEm('/fornecedores');

    expect(screen.getByRole('link', { name: 'Fornecedores' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current');
  });

  it('compras ja sao links reais', () => {
    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Cotações' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedidos de compra' })).toBeInTheDocument();
  });

  it('modulos de sprint futura aparecem, mas nao sao links', () => {
    renderizarEm('/');

    expect(screen.queryByRole('link', { name: /Produção/ })).not.toBeInTheDocument();
    expect(screen.getByText('Produção')).toBeInTheDocument();
    expect(screen.getAllByText('Próxima sprint').length).toBeGreaterThan(0);
  });

  it('a navegacao tem nome acessivel', () => {
    renderizarEm('/');

    expect(screen.getByRole('navigation', { name: 'Módulos do sistema' })).toBeInTheDocument();
  });

  it('estoque ja e um link real', () => {
    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Estoque' })).toHaveAttribute('href', '/estoque');
  });

  it('necessidade de compra ja e um link real', () => {
    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Necessidade de compra' })).toHaveAttribute(
      'href',
      '/necessidade-compra',
    );
  });

  it('estrutura de produtos ja e um link real', () => {
    renderizarEm('/');

    expect(screen.getByRole('link', { name: /Estrutura de produtos/ })).toHaveAttribute(
      'href',
      '/estrutura-produtos',
    );
  });

  it('Administrador ve o link de Dados da empresa', () => {
    useAutenticacao.getState().entrar(respostaLogin('ADMIN'));

    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Dados da empresa' })).toHaveAttribute(
      'href',
      '/configuracoes/empresa',
    );
  });

  it('quem nao e Administrador nao ve o link de Dados da empresa', () => {
    useAutenticacao.getState().entrar(respostaLogin('GESTOR'));

    renderizarEm('/');

    expect(screen.queryByRole('link', { name: 'Dados da empresa' })).not.toBeInTheDocument();
  });

  it('Administrador ve o link de Auditoria', () => {
    useAutenticacao.getState().entrar(respostaLogin('ADMIN'));

    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Auditoria' })).toHaveAttribute(
      'href',
      '/configuracoes/auditoria',
    );
  });

  it('quem nao e Administrador nao ve o link de Auditoria', () => {
    useAutenticacao.getState().entrar(respostaLogin('GESTOR'));

    renderizarEm('/');

    expect(screen.queryByRole('link', { name: 'Auditoria' })).not.toBeInTheDocument();
  });
});
