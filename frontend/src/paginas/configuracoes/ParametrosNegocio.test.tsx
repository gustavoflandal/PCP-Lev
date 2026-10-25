import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao } from '@/store/autenticacao';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { ParametrosNegocio } from './ParametrosNegocio';

const respostaLoginAdmin = {
  access_token: 'token-abc', token_type: 'Bearer', expires_in: 28800,
  usuario: {
    id: 1, username: 'admin', nome: 'Admin', perfil: 'ADMIN' as const,
    tema: 'automatico' as const, alto_contraste: false, densidade: 'compacta' as const, tamanho_fonte: 'padrao' as const,
  },
};

const configuracaoPadrao = {
  metodo_custeio: 'CMP',
  tolerancia_excesso_recebimento_pct: 0,
  lead_time_padrao_dias: 7,
  limite_emissao_gestor: null,
  cotacoes_minimas: 0,
  valor_exige_cotacoes: 0,
  updated_at: '2026-10-24T10:00:00-03:00',
};

describe('ParametrosNegocio', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    useToasts.setState({ itens: [] });
  });

  it('quem nao e Administrador ve acesso restrito', () => {
    useAutenticacao.getState().entrar({ ...respostaLoginAdmin, usuario: { ...respostaLoginAdmin.usuario, perfil: 'GESTOR' } });

    renderizarComProvedores(<ParametrosNegocio />);

    expect(screen.getByRole('alert')).toHaveTextContent(/acesso restrito/i);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('falha ao carregar nao oferece o formulario', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/negocio', status: 500, corpo: { sucesso: false } }]);

    renderizarComProvedores(<ParametrosNegocio />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i);
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
  });

  it('com cache antigo, edita sobre a configuracao atual do servidor', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Cache de quando um formulario de cadastro foi aberto, antes de outro
    // administrador definir a alcada.
    queryClient.setQueryData(['configuracoes', 'negocio'], configuracaoPadrao);
    servidor.responder([{
      metodo: 'get', url: '/configuracoes/negocio', status: 200,
      corpo: { dados: { ...configuracaoPadrao, limite_emissao_gestor: 10000 } },
    }]);

    renderizarComProvedores(<ParametrosNegocio />, { queryClient });

    expect(await screen.findByLabelText(/Valor máximo que o Gestor emite/)).toHaveValue(10000);
  });

  it('o campo de limite so aparece ao escolher limitar a alcada', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/negocio', status: 200, corpo: { dados: configuracaoPadrao } }]);

    renderizarComProvedores(<ParametrosNegocio />);
    await screen.findByRole('form', { name: 'Parâmetros de negócio' });
    expect(screen.queryByLabelText(/Valor máximo que o Gestor emite/)).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Alçada do Gestor para emitir pedido de compra'), 'limitado');

    expect(screen.getByLabelText(/Valor máximo que o Gestor emite/)).toBeInTheDocument();
  });

  it('salvar envia a configuracao inteira, com limite nulo quando sem limite', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/negocio', status: 200, corpo: { dados: configuracaoPadrao } },
      { metodo: 'put', url: '/configuracoes/negocio', status: 200, corpo: { dados: configuracaoPadrao } },
    ]);

    renderizarComProvedores(<ParametrosNegocio />);
    const tolerancia = await screen.findByLabelText(/Tolerância de excesso/);
    await userEvent.clear(tolerancia);
    await userEvent.type(tolerancia, '5.5');
    await userEvent.selectOptions(screen.getByLabelText('Método de custeio'), 'PEPS');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(servidor.requisicoes.at(-1)?.corpo).toEqual({
        metodo_custeio: 'PEPS',
        tolerancia_excesso_recebimento_pct: 5.5,
        lead_time_padrao_dias: 7,
        limite_emissao_gestor: null,
        cotacoes_minimas: 0,
        valor_exige_cotacoes: 0,
        tolerancia_preco_pct: 0,
        divergencia_preco_acao: 'BLOQUEAR',
      });
    });
    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Parâmetros de negócio salvos'));
  });

  it('limite escolhido sem valor nao envia e explica o que falta', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/negocio', status: 200, corpo: { dados: configuracaoPadrao } }]);

    renderizarComProvedores(<ParametrosNegocio />);
    await userEvent.selectOptions(await screen.findByLabelText('Alçada do Gestor para emitir pedido de compra'), 'limitado');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText(/Informe o valor máximo/)).toBeInTheDocument();
    expect(servidor.requisicoes.filter((r) => r.metodo === 'put')).toHaveLength(0);
  });

  it('tolerancia acima de 100 e recusada no proprio formulario', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/negocio', status: 200, corpo: { dados: configuracaoPadrao } }]);

    renderizarComProvedores(<ParametrosNegocio />);
    const tolerancia = await screen.findByLabelText(/Tolerância de excesso/);
    await userEvent.clear(tolerancia);
    await userEvent.type(tolerancia, '150');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('A tolerância vai de 0% a 100%')).toBeInTheDocument();
  });

  it('divergencia de preco: tolerancia e "exigir aprovacao" vao no corpo', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/negocio', status: 200, corpo: { dados: configuracaoPadrao } },
      { metodo: 'put', url: '/configuracoes/negocio', status: 200, corpo: { dados: configuracaoPadrao } },
    ]);

    renderizarComProvedores(<ParametrosNegocio />);
    const tolerancia = await screen.findByLabelText(/Tolerância de divergência de preço/);
    await userEvent.clear(tolerancia);
    await userEvent.type(tolerancia, '2.5');
    await userEvent.selectOptions(screen.getByLabelText('Acima da tolerância'), 'APROVAR');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(servidor.requisicoes.at(-1)?.corpo).toMatchObject({ tolerancia_preco_pct: 2.5, divergencia_preco_acao: 'APROVAR' }),
    );
  });

  it('tolerancia de preco acima de 100% nao envia', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/negocio', status: 200, corpo: { dados: { ...configuracaoPadrao, tolerancia_preco_pct: 3, divergencia_preco_acao: 'APROVAR' } } }]);

    renderizarComProvedores(<ParametrosNegocio />);
    const tolerancia = await screen.findByLabelText(/Tolerância de divergência de preço/);
    expect(tolerancia).toHaveValue(3);
    expect(screen.getByLabelText('Acima da tolerância')).toHaveValue('APROVAR');
    await userEvent.clear(tolerancia);
    await userEvent.type(tolerancia, '150');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('A tolerância vai de 0% a 100%')).toBeInTheDocument();
    expect(servidor.requisicoes.some((r) => r.metodo === 'put')).toBe(false);
  });
});
