import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api } from '@/servicos/api';
import { useAutenticacao } from '@/store/autenticacao';
import { renderizarComProvedores } from '@/testes/utilitarios';
import { Inicio } from './Inicio';

function responderApi(status: number, data: unknown) {
  api.defaults.adapter = async (config) => {
    if (status >= 400) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const erro: any = new Error('erro http');
      erro.isAxiosError = true;
      erro.config = config;
      erro.response = { status, data, headers: {}, config };
      throw erro;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status, data, headers: {}, config } as any;
  };
}

describe('Inicio', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().entrar({
      access_token: 'token-abc',
      token_type: 'Bearer',
      expires_in: 28800,
      usuario: { id: 1, username: 'admin', nome: 'Gustavo Landal', perfil: 'GESTOR' },
    });
  });
  afterEach(() => {
    api.defaults.adapter = undefined;
  });

  it('identifica de quem e a sessao aberta', () => {
    responderApi(200, { sucesso: true, dados: { status: 'ok', ambiente: 'development' } });

    renderizarComProvedores(<Inicio />);

    expect(screen.getByText(/Gustavo Landal/)).toBeInTheDocument();
  });

  it('mostra o estado de carregamento antes da resposta', () => {
    responderApi(200, { sucesso: true, dados: { status: 'ok', ambiente: 'development' } });

    renderizarComProvedores(<Inicio />);

    expect(screen.getByText('Verificando…')).toBeInTheDocument();
  });

  it('confirma o servidor operacional e informa o ambiente', async () => {
    responderApi(200, { sucesso: true, dados: { status: 'ok', ambiente: 'development' } });

    renderizarComProvedores(<Inicio />);

    expect(await screen.findByText(/Operacional · ambiente development/)).toBeInTheDocument();
  });

  it('diz o que deixa de funcionar quando o servidor cai', async () => {
    responderApi(503, {
      sucesso: false,
      erro: { codigo: 'INDISPONIVEL', mensagem: 'Banco de dados indisponivel' },
    });

    renderizarComProvedores(<Inicio />);

    expect(await screen.findByText(/Servidor indisponível/)).toBeInTheDocument();
  });
});
