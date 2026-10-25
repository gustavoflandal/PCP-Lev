import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { PERMISSOES } from '@/lib/permissoes';
import { useAutenticacao } from '@/store/autenticacao';
import { entrarComoPerfil } from '@/testes/utilitarios';
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
    entrarComoPerfil('ADMIN');
  });

  it('lista os cadastros disponiveis', () => {
    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Painel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Produtos acabados' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Partes e peças' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fornecedores' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes');
    expect(screen.getByRole('link', { name: 'Centros de trabalho' })).toHaveAttribute('href', '/centros-trabalho');
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

  it('producao e vendas ja sao links reais (sem item "Proxima sprint")', () => {
    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Pedidos de venda' })).toHaveAttribute('href', '/pedidos-venda');
    expect(screen.getByRole('link', { name: 'Kanban' })).toHaveAttribute('href', '/producao/kanban');
    expect(screen.getByRole('link', { name: 'Ordens de produção' })).toHaveAttribute('href', '/producao/ops');
    expect(screen.getByRole('link', { name: 'Rastreabilidade' })).toHaveAttribute('href', '/rastreabilidade');
    expect(screen.getByRole('link', { name: 'Metrologia' })).toHaveAttribute('href', '/producao/metrologia');
    expect(screen.queryByText('Próxima sprint')).not.toBeInTheDocument();
  });

  it('Operador ve producao, nao pedidos de venda', () => {
    useAutenticacao.getState().entrar(respostaLogin('OPERADOR'));
    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Kanban' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pedidos de venda' })).not.toBeInTheDocument();
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

  it('quem nao tem configuracoes.auditoria nao ve o link de Auditoria', () => {
    useAutenticacao.getState().entrar(respostaLogin('OPERADOR'));

    renderizarEm('/');

    expect(screen.queryByRole('link', { name: 'Auditoria' })).not.toBeInTheDocument();
  });

  it('Administrador ve o link de Parametros regionais', () => {
    useAutenticacao.getState().entrar(respostaLogin('ADMIN'));

    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Parâmetros regionais' })).toHaveAttribute(
      'href',
      '/configuracoes/regional',
    );
  });

  it('quem nao e Administrador nao ve o link de Parametros regionais', () => {
    useAutenticacao.getState().entrar(respostaLogin('GESTOR'));

    renderizarEm('/');

    expect(screen.queryByRole('link', { name: 'Parâmetros regionais' })).not.toBeInTheDocument();
  });

  it('so o Administrador ve o link de Parametros de negocio', () => {
    useAutenticacao.getState().entrar(respostaLogin('ADMIN'));
    const { unmount } = renderizarEm('/');
    expect(screen.getByRole('link', { name: 'Parâmetros de negócio' })).toHaveAttribute('href', '/configuracoes/negocio');
    unmount();

    useAutenticacao.getState().entrar(respostaLogin('GESTOR'));
    renderizarEm('/');
    expect(screen.queryByRole('link', { name: 'Parâmetros de negócio' })).not.toBeInTheDocument();
  });

  it('so o Administrador ve o link de Integracoes', () => {
    useAutenticacao.getState().entrar(respostaLogin('ADMIN'));
    const { unmount } = renderizarEm('/');
    expect(screen.getByRole('link', { name: 'Integrações' })).toHaveAttribute('href', '/configuracoes/integracoes');
    unmount();

    useAutenticacao.getState().entrar(respostaLogin('GESTOR'));
    renderizarEm('/');
    expect(screen.queryByRole('link', { name: 'Integrações' })).not.toBeInTheDocument();
  });

  it('so o Administrador ve o link de Banco de dados', () => {
    useAutenticacao.getState().entrar(respostaLogin('ADMIN'));
    const { unmount } = renderizarEm('/');
    expect(screen.getByRole('link', { name: 'Banco de dados' })).toHaveAttribute('href', '/configuracoes/banco');
    unmount();

    useAutenticacao.getState().entrar(respostaLogin('GESTOR'));
    renderizarEm('/');
    expect(screen.queryByRole('link', { name: 'Banco de dados' })).not.toBeInTheDocument();
  });
});

describe('NavegacaoLateral por permissao', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
  });

  it('Almoxarife ve estoque e pedidos, nao cotacoes nem configuracoes', () => {
    entrarComoPerfil('ALMOXARIFE');

    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Estoque' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedidos de compra' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cotações' })).not.toBeInTheDocument();
    expect(screen.queryByText('Configurações')).not.toBeInTheDocument();
  });

  it('Perfis e permissoes so com configuracoes.perfis (Gestor nao tem)', () => {
    entrarComoPerfil('ADMIN');
    const { unmount } = renderizarEm('/');
    expect(screen.getByRole('link', { name: 'Perfis e permissões' })).toHaveAttribute('href', '/configuracoes/perfis');
    unmount();

    entrarComoPerfil('GESTOR');
    renderizarEm('/');
    expect(screen.queryByRole('link', { name: 'Perfis e permissões' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Auditoria' })).toBeInTheDocument();
  });

  it('Operador ve centros de trabalho, mas nao clientes', () => {
    entrarComoPerfil('OPERADOR');

    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Centros de trabalho' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clientes' })).not.toBeInTheDocument();
  });

  it('Comprador nao ve clientes nem centros de trabalho', () => {
    entrarComoPerfil('COMPRADOR');

    renderizarEm('/');

    expect(screen.queryByRole('link', { name: 'Clientes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Centros de trabalho' })).not.toBeInTheDocument();
  });

  it('secao sem nenhum item permitido some inteira', () => {
    entrarComoPerfil('OPERADOR');

    renderizarEm('/');

    expect(screen.queryByText('Compras')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Estrutura de produtos' })).toBeInTheDocument();
  });

  it('recebimento (notas fiscais de entrada) e lotes aparecem conforme a permissao', () => {
    entrarComoPerfil('ALMOXARIFE');

    renderizarEm('/');

    expect(screen.getByRole('link', { name: 'Notas fiscais de entrada' })).toHaveAttribute('href', '/notas-entrada');
    expect(screen.getByRole('link', { name: 'Lotes' })).toHaveAttribute('href', '/lotes');
  });

  it('sem notas_entrada.visualizar, a secao Recebimento some', () => {
    entrarComoPerfil('OPERADOR');

    renderizarEm('/');

    expect(screen.queryByText('Recebimento')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Notas fiscais de entrada' })).not.toBeInTheDocument();
  });
});

describe('NavegacaoLateral: grupo Painéis', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
  });

  const NOMES = ['Compras', 'Recebimento e estoque', 'Produção', 'Vendas e expedição', 'Qualidade'];
  const paineisVisiveis = () => NOMES.filter((nome) => screen.queryByRole('link', { name: nome }));

  it('Gestor ve os cinco paineis, cada um na sua rota', () => {
    entrarComoPerfil('GESTOR');
    renderizarEm('/');

    expect(screen.getByText('Painéis')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compras' })).toHaveAttribute('href', '/paineis/compras');
    expect(screen.getByRole('link', { name: 'Recebimento e estoque' })).toHaveAttribute('href', '/paineis/estoque');
    expect(screen.getByRole('link', { name: 'Produção' })).toHaveAttribute('href', '/paineis/producao');
    expect(screen.getByRole('link', { name: 'Vendas e expedição' })).toHaveAttribute('href', '/paineis/vendas');
    expect(screen.getByRole('link', { name: 'Qualidade' })).toHaveAttribute('href', '/paineis/qualidade');
  });

  it('Comprador ve Compras e Recebimento e estoque, nao Produção', () => {
    entrarComoPerfil('COMPRADOR');
    renderizarEm('/');

    expect(paineisVisiveis()).toEqual(['Compras', 'Recebimento e estoque']);
  });

  it('cada perfil ve os paineis da matriz (migration 022)', () => {
    const esperado: Record<string, string[]> = {
      ALMOXARIFE: ['Recebimento e estoque'],
      OPERADOR: ['Produção'],
      QUALIDADE: ['Produção', 'Qualidade'],
      VENDAS: ['Vendas e expedição'],
      CONSULTA: NOMES,
    };
    for (const [perfil, nomes] of Object.entries(esperado)) {
      entrarComoPerfil(perfil);
      const { unmount } = renderizarEm('/');
      expect(paineisVisiveis(), perfil).toEqual(nomes);
      unmount();
    }
  });

  it('a permissao individual de um painel basta para o item aparecer', () => {
    useAutenticacao.getState().entrar({ ...respostaLogin('OPERADOR'), permissoes: [PERMISSOES.paineisVendas] });
    renderizarEm('/');

    expect(paineisVisiveis()).toEqual(['Vendas e expedição']);
  });

  it('sem nenhum painel, o grupo nao aparece', () => {
    useAutenticacao.getState().entrar({ ...respostaLogin('OPERADOR'), permissoes: [PERMISSOES.producaoVisualizar] });
    renderizarEm('/');

    expect(screen.queryByText('Painéis')).not.toBeInTheDocument();
  });

  it('marca o painel aberto', () => {
    entrarComoPerfil('GESTOR');
    renderizarEm('/paineis/producao');

    expect(screen.getByRole('link', { name: 'Produção' })).toHaveAttribute('aria-current', 'page');
  });
});
