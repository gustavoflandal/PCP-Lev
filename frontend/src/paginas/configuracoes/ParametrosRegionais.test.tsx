import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao } from '@/store/autenticacao';
import { CONFIGURACAO_REGIONAL_PADRAO, configuracaoRegionalAtual, useConfiguracaoRegional } from '@/store/configuracaoRegional';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { ParametrosRegionais } from './ParametrosRegionais';

const respostaLoginAdmin = {
  access_token: 'token-abc', token_type: 'Bearer', expires_in: 28800,
  usuario: {
    id: 1, username: 'admin', nome: 'Admin', perfil: 'ADMIN' as const,
    tema: 'automatico' as const, alto_contraste: false, densidade: 'compacta' as const, tamanho_fonte: 'padrao' as const,
  },
};

const configuracaoPadrao = { formato_data: 'DD/MM/AAAA', formato_hora: '24H', updated_at: '2026-08-31T10:00:00-03:00' };

describe('ParametrosRegionais', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    useToasts.setState({ itens: [] });
    useConfiguracaoRegional.setState({ configuracao: CONFIGURACAO_REGIONAL_PADRAO });
  });

  it('acesso restrito a administradores mostra a mensagem em vez do formulario', () => {
    useAutenticacao.getState().entrar({ ...respostaLoginAdmin, usuario: { ...respostaLoginAdmin.usuario, perfil: 'GESTOR' } });
    servidor.responder([{ metodo: 'get', url: '/configuracoes/regional', status: 200, corpo: { dados: configuracaoPadrao } }]);

    renderizarComProvedores(<ParametrosRegionais />);

    expect(screen.getByRole('alert')).toHaveTextContent(/acesso restrito/i);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('nao oferece o formulario enquanto a configuracao atual nao chegou', () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/regional', status: 200, corpo: { dados: configuracaoPadrao } }]);

    renderizarComProvedores(<ParametrosRegionais />);

    expect(screen.getByText('Carregando parâmetros regionais…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
  });

  it('falha ao carregar mostra o aviso e nao deixa salvar os defaults por cima', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/regional', status: 500, corpo: { sucesso: false } }]);

    renderizarComProvedores(<ParametrosRegionais />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i);
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
  });

  it('o formulario nasce com a configuracao salva, nao com os defaults', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{
      metodo: 'get', url: '/configuracoes/regional', status: 200,
      corpo: { dados: { ...configuracaoPadrao, formato_data: 'AAAA-MM-DD', formato_hora: '12H' } },
    }]);

    renderizarComProvedores(<ParametrosRegionais />);

    expect(await screen.findByText('Assim: 2026-08-31 02:30 PM')).toBeInTheDocument();
    expect(screen.getByLabelText('Formato de data')).toHaveValue('AAAA-MM-DD');
  });

  it('a previa muda ao trocar a selecao, antes de salvar', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/regional', status: 200, corpo: { dados: configuracaoPadrao } }]);

    renderizarComProvedores(<ParametrosRegionais />);
    await screen.findByText('Assim: 31/08/2026 14:30');

    await userEvent.selectOptions(screen.getByLabelText('Formato de data'), 'AAAA-MM-DD');

    expect(screen.getByText('Assim: 2026-08-31 14:30')).toBeInTheDocument();
  });

  it('salvar envia o corpo certo e aplica a store imediatamente', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/regional', status: 200, corpo: { dados: configuracaoPadrao } },
      { metodo: 'put', url: '/configuracoes/regional', status: 200, corpo: { dados: { ...configuracaoPadrao, formato_data: 'AAAA-MM-DD' } } },
    ]);

    renderizarComProvedores(<ParametrosRegionais />);
    await screen.findByText('Assim: 31/08/2026 14:30');
    await userEvent.selectOptions(screen.getByLabelText('Formato de data'), 'AAAA-MM-DD');

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(servidor.requisicoes.at(-1)?.corpo).toEqual({ formato_data: 'AAAA-MM-DD', formato_hora: '24H' });
    });
    await waitFor(() => {
      expect(useToasts.getState().itens[0]?.mensagem).toBe('Parâmetros regionais salvos');
    });
    expect(configuracaoRegionalAtual().formato_data).toBe('AAAA-MM-DD');
  });
});
