import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAutenticacao } from '@/store/autenticacao';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { BancoDeDados } from './BancoDeDados';

const respostaLoginAdmin = {
  access_token: 'token-abc', token_type: 'Bearer', expires_in: 28800,
  usuario: {
    id: 1, username: 'admin', nome: 'Admin', perfil: 'ADMIN' as const,
    tema: 'automatico' as const, alto_contraste: false, densidade: 'compacta' as const, tamanho_fonte: 'padrao' as const,
  },
};

const statusFalso = {
  conectado: true,
  latencia_ms: 1.25,
  host: 'po*****es:5432',
  banco: 'pcp_db',
  versao: '16.4',
  tamanho_bytes: 12_884_901,
  maiores_tabelas: [
    { tabela: 'auditoria', tamanho_bytes: 2_097_152, linhas_estimadas: 1520 },
    { tabela: 'pecas', tamanho_bytes: 81_920, linhas_estimadas: null },
  ],
  pool: { em_uso: 1, ociosas: 3, total: 4, maximo: 20 },
  conexoes_ativas: 6,
  ultimo_backup: null,
};

describe('BancoDeDados', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    sessionStorage.clear();
    useAutenticacao.getState().sair();
  });

  it('quem nao e Administrador ve acesso restrito e nada e consultado', () => {
    useAutenticacao.getState().entrar({ ...respostaLoginAdmin, usuario: { ...respostaLoginAdmin.usuario, perfil: 'GESTOR' } });

    renderizarComProvedores(<BancoDeDados />);

    expect(screen.getByRole('alert')).toHaveTextContent(/acesso restrito/i);
    expect(servidor.requisicoes).toHaveLength(0);
  });

  it('mostra o diagnostico com host mascarado, pool, tamanhos e backup ausente', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/banco', status: 200, corpo: { dados: statusFalso } }]);

    renderizarComProvedores(<BancoDeDados />);

    expect(await screen.findByText('po*****es:5432')).toBeInTheDocument();
    expect(screen.getByText('Conectado')).toBeInTheDocument();
    expect(screen.getByText('12,3 MB')).toBeInTheDocument();
    expect(screen.getByText('4 de 20')).toBeInTheDocument();
    expect(screen.getByText('Nenhum backup registrado.')).toBeInTheDocument();

    const tabela = screen.getByRole('table', { name: 'Maiores tabelas' });
    expect(within(tabela).getByText('auditoria')).toBeInTheDocument();
    expect(within(tabela).getByText('2 MB')).toBeInTheDocument();
    expect(within(tabela).getByText('1.520')).toBeInTheDocument();
    expect(within(tabela).getByText('—')).toBeInTheDocument();
  });

  it('testar conexao mostra a latencia devolvida', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/banco', status: 200, corpo: { dados: statusFalso } },
      { metodo: 'post', url: '/configuracoes/banco/testar', status: 200, corpo: { dados: { ok: true, latencia_ms: 0.8 } } },
    ]);

    renderizarComProvedores(<BancoDeDados />);
    await userEvent.click(await screen.findByRole('button', { name: 'Testar conexão' }));

    expect(await screen.findByText('Conexão OK em 0,8 ms')).toBeInTheDocument();
  });

  it('testar conexao com o banco fora do ar mostra a falha sem detalhes tecnicos', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/banco', status: 200, corpo: { dados: statusFalso } },
      { metodo: 'post', url: '/configuracoes/banco/testar', status: 503, corpo: { sucesso: false, erro: { codigo: 'INDISPONIVEL', mensagem: 'banco de dados indisponivel' } } },
    ]);

    renderizarComProvedores(<BancoDeDados />);
    await userEvent.click(await screen.findByRole('button', { name: 'Testar conexão' }));

    expect(await screen.findByText('Falha ao conectar ao banco de dados.')).toBeInTheDocument();
  });

  it('se a atualizacao falhar, some o retrato anterior em vez de mostrar "Conectado"', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/banco', status: 200, corpo: { dados: statusFalso } }]);
    renderizarComProvedores(<BancoDeDados />);
    await screen.findByText('Conectado');

    servidor.responder([{ metodo: 'get', url: '/configuracoes/banco', status: 503, corpo: { sucesso: false } }]);
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível consultar/i);
    expect(screen.queryByText('Conectado')).not.toBeInTheDocument();
  });

  it('falha ao consultar mostra o aviso', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/banco', status: 503, corpo: { sucesso: false } }]);

    renderizarComProvedores(<BancoDeDados />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível consultar/i);
  });
});
