import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api } from '@/servicos/api';
import { useAutenticacao } from '@/store/autenticacao';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { Login } from './Login';

const respostaLogin = {
  access_token: 'token-abc',
  token_type: 'Bearer',
  expires_in: 28800,
  usuario: { id: 1, username: 'admin', nome: 'Administrador do Sistema', perfil: 'ADMIN', tema: 'automatico', alto_contraste: false, densidade: 'confortavel', tamanho_fonte: 'padrao' },
};

async function preencherEEnviar(usuario = 'admin', senha = 'Admin@123') {
  await userEvent.type(screen.getByLabelText('Usuário'), usuario);
  await userEvent.type(screen.getByLabelText('Senha'), senha);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('Login', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    servidor = instalarServidorFalso();
  });

  afterEach(() => {
    api.defaults.adapter = undefined;
  });

  it('apresenta os campos com rotulo visivel, nao apenas placeholder', () => {
    renderizarComProvedores(<Login />);

    expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });

  it('autentica e abre a sessao', async () => {
    servidor.responder([{ metodo: 'post', url: '/auth/login', status: 200, corpo: respostaLogin }]);
    renderizarComProvedores(<Login />);

    await preencherEEnviar();

    await waitFor(() => expect(useAutenticacao.getState().autenticado).toBe(true));
    expect(useAutenticacao.getState().usuario?.username).toBe('admin');
  });

  it('cobra o usuario sem chamar a API', async () => {
    renderizarComProvedores(<Login />);

    await userEvent.type(screen.getByLabelText('Senha'), 'Admin@123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe o usuário')).toBeInTheDocument();
    expect(useAutenticacao.getState().autenticado).toBe(false);
  });

  it('cobra a senha sem chamar a API', async () => {
    renderizarComProvedores(<Login />);

    await userEvent.type(screen.getByLabelText('Usuário'), 'admin');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe a senha')).toBeInTheDocument();
  });

  it('mostra a mensagem da API quando as credenciais estao erradas', async () => {
    servidor.responder([
      {
        metodo: 'post',
        url: '/auth/login',
        status: 401,
        corpo: { sucesso: false, erro: { codigo: 'NAO_AUTORIZADO', mensagem: 'Usuario ou senha invalidos' } },
      },
    ]);
    renderizarComProvedores(<Login />);

    await preencherEEnviar('admin', 'senha_errada');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Usuario ou senha invalidos');
    expect(useAutenticacao.getState().autenticado).toBe(false);
  });

  it('explica a queda de rede em vez de mostrar erro tecnico', async () => {
    api.defaults.adapter = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const erro: any = new Error('Network Error');
      erro.isAxiosError = true;
      throw erro;
    };
    renderizarComProvedores(<Login />);

    await preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent(/conectar ao servidor/i);
  });

  it('avisa quando a sessao anterior caiu por inatividade', () => {
    useAutenticacao.getState().sair('inatividade');

    renderizarComProvedores(<Login />);

    expect(screen.getByRole('status')).toHaveTextContent(/inatividade/i);
  });

  it('avisa quando a sessao anterior expirou', () => {
    useAutenticacao.getState().sair('expirada');

    renderizarComProvedores(<Login />);

    expect(screen.getByRole('status')).toHaveTextContent(/expirou/i);
  });

  it('permite revelar a senha digitada', async () => {
    renderizarComProvedores(<Login />);

    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');
  });

  it('a senha nunca e preenchida automaticamente com o usuario', () => {
    renderizarComProvedores(<Login />);

    expect(screen.getByLabelText('Senha')).toHaveValue('');
  });
});
