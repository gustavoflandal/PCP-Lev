import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao } from '@/store/autenticacao';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { Integracoes } from './Integracoes';

const respostaLoginAdmin = {
  access_token: 'token-abc', token_type: 'Bearer', expires_in: 28800,
  usuario: {
    id: 1, username: 'admin', nome: 'Admin', perfil: 'ADMIN' as const,
    tema: 'automatico' as const, alto_contraste: false, densidade: 'compacta' as const, tamanho_fonte: 'padrao' as const,
  },
};

const configuracaoComSenha = {
  habilitado: true, host: 'smtp.empresa.com.br', porta: 587, criptografia: 'STARTTLS',
  usuario: 'pcp@empresa.com.br', senha_definida: true,
  remetente_email: 'pcp@empresa.com.br', remetente_nome: 'Sistema PCP', updated_at: '2026-10-24T10:00:00Z',
};

const vazia = {
  habilitado: false, host: '', porta: 587, criptografia: 'STARTTLS', usuario: '', senha_definida: false,
  remetente_email: '', remetente_nome: '', updated_at: '2026-10-24T10:00:00Z',
};

describe('Integracoes', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    useToasts.setState({ itens: [] });
  });

  it('quem nao e Administrador ve acesso restrito e nada e consultado', () => {
    useAutenticacao.getState().entrar({ ...respostaLoginAdmin, usuario: { ...respostaLoginAdmin.usuario, perfil: 'GESTOR' } });

    renderizarComProvedores(<Integracoes />);

    expect(screen.getByRole('alert')).toHaveTextContent(/acesso restrito/i);
    expect(servidor.requisicoes).toHaveLength(0);
  });

  it('com senha gravada, o campo fica vazio e explica que deixar em branco mantem', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/smtp', status: 200, corpo: { dados: configuracaoComSenha } }]);

    renderizarComProvedores(<Integracoes />);

    const senha = await screen.findByLabelText('Senha');
    expect(senha).toHaveValue('');
    expect(senha).toHaveAttribute('type', 'password');
    expect(screen.getByText(/Deixe em branco para mantê-la/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover senha gravada' })).toBeInTheDocument();
  });

  it('salvar sem digitar senha envia senha vazia (mantem a gravada)', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/smtp', status: 200, corpo: { dados: configuracaoComSenha } },
      { metodo: 'put', url: '/configuracoes/smtp', status: 200, corpo: { dados: configuracaoComSenha } },
    ]);

    renderizarComProvedores(<Integracoes />);
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(servidor.requisicoes.find((r) => r.metodo === 'put')?.corpo).toMatchObject({
        host: 'smtp.empresa.com.br', porta: 587, senha: '', remover_senha: false,
      });
    });
  });

  it('senha digitada e enviada uma vez e some do formulario depois de salvar', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/smtp', status: 200, corpo: { dados: configuracaoComSenha } },
      { metodo: 'put', url: '/configuracoes/smtp', status: 200, corpo: { dados: configuracaoComSenha } },
    ]);

    renderizarComProvedores(<Integracoes />);
    const senha = await screen.findByLabelText('Senha');
    await userEvent.type(senha, 'nova-senha');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Servidor de e-mail salvo'));
    expect(servidor.requisicoes.find((r) => r.metodo === 'put')?.corpo).toMatchObject({ senha: 'nova-senha' });
    expect(screen.getByLabelText('Senha')).toHaveValue('');
  });

  it('remover senha envia remover_senha', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/smtp', status: 200, corpo: { dados: configuracaoComSenha } },
      { metodo: 'put', url: '/configuracoes/smtp', status: 200, corpo: { dados: { ...configuracaoComSenha, senha_definida: false } } },
    ]);

    renderizarComProvedores(<Integracoes />);
    // Edicao pela metade no formulario (host apagado) nao bloqueia nem vai junto.
    await userEvent.clear(await screen.findByLabelText('Servidor (host)'));
    await userEvent.click(screen.getByRole('button', { name: 'Remover senha gravada' }));
    expect(servidor.requisicoes.filter((r) => r.metodo === 'put')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Remover senha' }));

    await waitFor(() => {
      expect(servidor.requisicoes.find((r) => r.metodo === 'put')?.corpo).toMatchObject({
        host: 'smtp.empresa.com.br', senha: '', remover_senha: true,
      });
    });
  });

  it('habilitar sem host nao envia e explica', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/smtp', status: 200, corpo: { dados: vazia } }]);

    renderizarComProvedores(<Integracoes />);
    await userEvent.selectOptions(await screen.findByLabelText('Envio de e-mail'), 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Informe o servidor para habilitar o envio')).toBeInTheDocument();
    expect(servidor.requisicoes.filter((r) => r.metodo === 'put')).toHaveLength(0);
  });

  it('teste de envio com falha do servidor mostra a mensagem dele', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/smtp', status: 200, corpo: { dados: configuracaoComSenha } },
      {
        metodo: 'post', url: '/configuracoes/smtp/testar', status: 502,
        corpo: { sucesso: false, erro: { codigo: 'FALHA_SERVICO_EXTERNO', mensagem: 'o servidor de e-mail recusou: 535 auth' } },
      },
    ]);

    renderizarComProvedores(<Integracoes />);
    await userEvent.type(await screen.findByLabelText('Enviar para'), 'alguem@empresa.com.br');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar e-mail de teste' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toMatch(/535 auth/));
    expect(servidor.requisicoes.find((r) => r.metodo === 'post')?.corpo).toEqual({ destinatario: 'alguem@empresa.com.br' });
  });

  it('destinatario invalido nem chama a API', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/smtp', status: 200, corpo: { dados: configuracaoComSenha } }]);

    renderizarComProvedores(<Integracoes />);
    await userEvent.type(await screen.findByLabelText('Enviar para'), 'nao-e-email');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar e-mail de teste' }));

    expect(await screen.findByText('Informe um e-mail válido')).toBeInTheDocument();
    expect(servidor.requisicoes.filter((r) => r.metodo === 'post')).toHaveLength(0);
  });
});
