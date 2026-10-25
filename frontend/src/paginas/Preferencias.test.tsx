import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao, type RespostaLogin } from '@/store/autenticacao';
import { usePreferencias, PREFERENCIAS_PADRAO } from '@/store/preferencias';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { PreferenciasPagina } from './Preferencias';

const respostaLogin: RespostaLogin = {
  access_token: 'token-abc',
  token_type: 'Bearer',
  expires_in: 28800,
  usuario: {
    id: 1, username: 'admin', nome: 'Admin', perfil: 'ADMIN',
    tema: 'claro', alto_contraste: false, densidade: 'compacta', tamanho_fonte: 'padrao',
  },
};

describe('PreferenciasPagina', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    useToasts.setState({ itens: [] });
    usePreferencias.setState({ preferencias: PREFERENCIAS_PADRAO });
    document.documentElement.removeAttribute('data-tema');
    sessionStorage.clear();
    useAutenticacao.getState().sair();
  });

  it('mudar o tema aplica na hora e envia o corpo certo para a API', async () => {
    servidor.responder([
      {
        metodo: 'put', url: '/auth/preferencias', status: 200,
        corpo: { sucesso: true, dados: { id: 1, username: 'admin', nome: 'Admin', perfil: 'ADMIN', tema: 'escuro', alto_contraste: false, densidade: 'confortavel', tamanho_fonte: 'padrao' } },
      },
    ]);
    renderizarComProvedores(<PreferenciasPagina />);

    await userEvent.selectOptions(screen.getByLabelText('Tema'), 'escuro');

    expect(document.documentElement.getAttribute('data-tema')).toBe('escuro');
    await waitFor(() =>
      expect(servidor.requisicoes.find((r) => r.url === '/auth/preferencias')?.corpo).toMatchObject({ tema: 'escuro' }),
    );
    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Preferências salvas'));
  });

  it('alto contraste marca o atributo no html', async () => {
    servidor.responder([
      {
        metodo: 'put', url: '/auth/preferencias', status: 200,
        corpo: { sucesso: true, dados: { id: 1, username: 'admin', nome: 'Admin', perfil: 'ADMIN', tema: 'automatico', alto_contraste: true, densidade: 'confortavel', tamanho_fonte: 'padrao' } },
      },
    ]);
    renderizarComProvedores(<PreferenciasPagina />);

    await userEvent.click(screen.getByLabelText('Alto contraste'));

    expect(document.documentElement.getAttribute('data-alto-contraste')).toBe('true');
  });

  it('erro da API reverte a preferencia e mostra toast', async () => {
    servidor.responder([
      {
        metodo: 'put', url: '/auth/preferencias', status: 500,
        corpo: { sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'falha ao salvar' } },
      },
    ]);
    renderizarComProvedores(<PreferenciasPagina />);

    await userEvent.selectOptions(screen.getByLabelText('Tema'), 'escuro');

    await waitFor(() => expect(document.documentElement.getAttribute('data-tema')).toBe('claro'));
    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('falha ao salvar'));
  });

  it('salvar atualiza tambem o usuario da sessao, para nao reverter num F5', async () => {
    useAutenticacao.getState().entrar(respostaLogin);
    servidor.responder([
      {
        metodo: 'put', url: '/auth/preferencias', status: 200,
        corpo: { sucesso: true, dados: { id: 1, username: 'admin', nome: 'Admin', perfil: 'ADMIN', tema: 'escuro', alto_contraste: false, densidade: 'compacta', tamanho_fonte: 'padrao' } },
      },
    ]);
    renderizarComProvedores(<PreferenciasPagina />);

    await userEvent.selectOptions(screen.getByLabelText('Tema'), 'escuro');

    await waitFor(() => expect(useAutenticacao.getState().usuario?.tema).toBe('escuro'));
  });
});
