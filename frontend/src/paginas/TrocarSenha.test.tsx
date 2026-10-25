import { screen, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAutenticacao } from '@/store/autenticacao';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { TrocarSenha } from './TrocarSenha';

function entrar(deveTrocarSenha: boolean) {
  useAutenticacao.getState().entrar({
    access_token: 't',
    token_type: 'Bearer',
    expires_in: 28800,
    usuario: {
      id: 7, username: 'maria', nome: 'Maria Souza', perfil: 'COMPRADOR', deve_trocar_senha: deveTrocarSenha,
      tema: 'automatico', alto_contraste: false, densidade: 'compacta', tamanho_fonte: 'padrao',
    },
  });
}

function renderizar(queryClient?: QueryClient) {
  return renderizarComProvedores(
    <Routes>
      <Route path="/trocar-senha" element={<TrocarSenha />} />
      <Route path="/" element={<p>painel</p>} />
    </Routes>,
    { rota: '/trocar-senha', queryClient },
  );
}

async function preencher(atual: string, nova: string, confirmacao = nova) {
  await userEvent.type(screen.getByLabelText(/Senha (temporária|atual)/), atual);
  await userEvent.type(screen.getByLabelText(/^Nova senha/), nova);
  await userEvent.type(screen.getByLabelText(/Repita a nova senha/), confirmacao);
  await userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
}

describe('TrocarSenha', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    servidor = instalarServidorFalso();
  });

  it('troca obrigatoria: envia, libera a sessao e vai ao painel', async () => {
    entrar(true);
    servidor.responder([{ metodo: 'post', url: '/auth/trocar-senha', status: 200, corpo: { sucesso: true, dados: { access_token: 'token-novo' } } }]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['auth', 'eu', 7], { id: 7, permissoes: [], deve_trocar_senha: true });
    renderizar(queryClient);
    expect(screen.getByRole('heading', { name: 'Crie a sua senha' })).toBeInTheDocument();

    await preencher('temporaria1', 'minhaSenha9');

    expect(await screen.findByText('painel')).toBeInTheDocument();
    expect(servidor.requisicoes[0].corpo).toEqual({ senha_atual: 'temporaria1', nova_senha: 'minhaSenha9' });
    expect(useAutenticacao.getState().usuario?.deve_trocar_senha).toBe(false);
    expect(queryClient.getQueryData(['auth', 'eu', 7])).toBeUndefined();
    expect(useAutenticacao.getState().token).toBe('token-novo');
  });

  it('confirmacao diferente nao envia', async () => {
    entrar(false);
    renderizar();

    await preencher('atual1234', 'novaSenha1', 'outraSenha1');

    expect(await screen.findByText('Repita exatamente a nova senha')).toBeInTheDocument();
    expect(servidor.requisicoes).toHaveLength(0);
  });

  it('senha atual errada mostra a mensagem da API', async () => {
    entrar(false);
    servidor.responder([
      { metodo: 'post', url: '/auth/trocar-senha', status: 401, corpo: { erro: { codigo: 'NAO_AUTORIZADO', mensagem: 'Senha atual incorreta' } } },
    ]);
    renderizar();

    await preencher('errada123', 'novaSenha1');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Senha atual incorreta'));
  });
});
