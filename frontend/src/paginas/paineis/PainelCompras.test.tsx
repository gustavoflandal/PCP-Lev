import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutenticacao } from '@/store/autenticacao';
import { useModoTV } from '@/store/modoTV';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import type { PainelCompras as DadosCompras } from '@/tipos/paineis';
import { PainelCompras } from './PainelCompras';

const dados: DadosCompras = {
  em_aberto: 7,
  valor_em_aberto: 45200,
  em_atraso: 2,
  lead_time_medio_dias: 12.5,
  recebido_no_prazo_pct: null,
  por_situacao: [
    { rotulo: 'Emitido', valor: 3 },
    { rotulo: 'Aguardando Entrega', valor: 4 },
  ],
  comprado_por_mes: [
    { rotulo: '2026-09', valor: 1000 },
    { rotulo: '2026-10', valor: 2500 },
  ],
  atrasos_por_fornecedor: [{ rotulo: 'Eletro Sul', valor: 2 }],
  lead_time_por_fornecedor: [],
};

/** Mostra o endereco atual para conferir o que foi parar na URL. */
function Endereco() {
  const local = useLocation();
  return <output data-testid="endereco">{local.search}</output>;
}

function renderizar(rota = '/paineis/compras') {
  return renderizarComProvedores(
    <>
      <PainelCompras />
      <Endereco />
    </>,
    { rota },
  );
}

const endereco = () => new URLSearchParams(screen.getByTestId('endereco').textContent ?? '');
const pedidosAoPainel = (servidor: ServidorFalso) => servidor.requisicoes.filter((r) => r.url === '/paineis/compras');

describe('PainelCompras', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    useModoTV.setState({ ativo: false });
    servidor = instalarServidorFalso();
    entrarComoPerfil('GESTOR');
    servidor.responder([{ metodo: 'get', url: '/paineis/compras', status: 200, corpo: { sucesso: true, dados } }]);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete document.documentElement.dataset.modoTv;
  });

  it('mostra os indicadores e os graficos do painel', async () => {
    renderizar();

    expect(screen.getByRole('heading', { name: 'Painel de compras', level: 1 })).toBeInTheDocument();
    const emAberto = await screen.findByRole('group', { name: 'PCs em aberto' });
    expect(emAberto).toHaveTextContent('7');
    expect(emAberto).toHaveTextContent(/R\$\s45\.200,00 a receber/);
    expect(screen.getByRole('group', { name: 'Lead time real médio' })).toHaveTextContent('12,5 dias');
    // Percentual null: travessao e o motivo.
    expect(screen.getByRole('group', { name: 'Recebido no prazo' })).toHaveTextContent('Nenhum pedido recebido no período.');

    expect(screen.getByRole('region', { name: 'PCs por situação' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Comprado por mês' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Atrasos por fornecedor' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Lead time por fornecedor' })).getByText(/Nenhum pedido recebido no período/)).toBeInTheDocument();
  });

  it('situacoes aparecem com o rotulo do sistema na tabela equivalente', async () => {
    renderizar();

    const grafico = await screen.findByRole('region', { name: 'PCs por situação' });
    await userEvent.click(await within(grafico).findByRole('button', { name: 'Ver dados' }));

    expect(within(grafico).getByRole('rowheader', { name: 'Aguardando entrega' })).toBeInTheDocument();
  });

  it('periodo padrao e 90 dias e a troca vai para o endereco e para a consulta', async () => {
    renderizar();
    await screen.findByRole('group', { name: 'PCs em aberto' });

    expect(pedidosAoPainel(servidor)[0].params).toEqual({ dias: 90 });
    expect(screen.getByLabelText('Período')).toHaveValue('90');

    await userEvent.selectOptions(screen.getByLabelText('Período'), 'Últimos 30 dias');

    expect(endereco().get('dias')).toBe('30');
    await waitFor(() => expect(pedidosAoPainel(servidor).at(-1)?.params).toEqual({ dias: 30 }));
  });

  it('le periodo e atualizacao do endereco (favorito da TV)', async () => {
    renderizar('/paineis/compras?dias=365&atualizar=300');
    await screen.findByRole('group', { name: 'PCs em aberto' });

    expect(screen.getByLabelText('Período')).toHaveValue('365');
    expect(screen.getByLabelText('Atualização automática')).toHaveValue('300');
    expect(pedidosAoPainel(servidor)[0].params).toEqual({ dias: 365 });
  });

  it('valor invalido no endereco cai no padrao', async () => {
    renderizar('/paineis/compras?dias=7&atualizar=5');
    await screen.findByRole('group', { name: 'PCs em aberto' });

    expect(screen.getByLabelText('Período')).toHaveValue('90');
    expect(screen.getByLabelText('Atualização automática')).toHaveValue('60');
  });

  it('oferece os intervalos de atualizacao, com 1 min por padrao', async () => {
    renderizar();

    const atualizacao = screen.getByLabelText('Atualização automática');
    expect(atualizacao).toHaveValue('60');
    expect(within(atualizacao).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Desligada', '30 s', '1 min', '2 min', '5 min', '10 min',
    ]);

    await userEvent.selectOptions(atualizacao, 'Desligada');
    expect(endereco().get('atualizar')).toBe('0');
  });

  it('atualiza sozinho no intervalo escolhido', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderizar('/paineis/compras?atualizar=30');
    await screen.findByRole('group', { name: 'PCs em aberto' });
    expect(pedidosAoPainel(servidor)).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    await waitFor(() => expect(pedidosAoPainel(servidor)).toHaveLength(2));
  });

  it('com a atualizacao desligada, nao busca de novo sozinho', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderizar('/paineis/compras?atualizar=0');
    await screen.findByRole('group', { name: 'PCs em aberto' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });

    expect(pedidosAoPainel(servidor)).toHaveLength(1);
  });

  it('mostra o horario da ultima atualizacao e "Atualizar agora" busca de novo', async () => {
    renderizar();

    expect(await screen.findByText(/^Atualizado às \d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }));

    await waitFor(() => expect(pedidosAoPainel(servidor)).toHaveLength(2));
  });

  it('erro sem dados anteriores: mensagem e Tentar de novo', async () => {
    servidor.responder([{ metodo: 'get', url: '/paineis/compras', status: 500, corpo: { sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno' } } }]);
    renderizar();

    expect(await screen.findByText(/Não foi possível carregar o painel/)).toBeInTheDocument();

    servidor.responder([{ metodo: 'get', url: '/paineis/compras', status: 200, corpo: { sucesso: true, dados } }]);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('group', { name: 'PCs em aberto' })).toBeInTheDocument();
  });

  it('enquanto carrega, mostra esqueletos', () => {
    renderizar();

    expect(screen.getAllByTestId('esqueleto-indicador')).toHaveLength(4);
    expect(screen.getAllByTestId('esqueleto-grafico')).toHaveLength(4);
  });

  describe('modo TV', () => {
    let pedirTelaCheia: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      pedirTelaCheia = vi.fn().mockResolvedValue(undefined);
      document.documentElement.requestFullscreen = pedirTelaCheia as unknown as typeof document.documentElement.requestFullscreen;
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    });
    afterEach(() => {
      delete (document.documentElement as unknown as Record<string, unknown>).requestFullscreen;
      delete (document as unknown as Record<string, unknown>).fullscreenEnabled;
      delete (document as unknown as Record<string, unknown>).fullscreenElement;
    });

    it('"Modo TV" pede tela cheia, vai para o endereco e avisa o resto da aplicacao', async () => {
      renderizar('/paineis/compras?dias=180');
      await screen.findByRole('group', { name: 'PCs em aberto' });

      await userEvent.click(screen.getByRole('button', { name: 'Modo TV' }));

      expect(pedirTelaCheia).toHaveBeenCalledOnce();
      expect(endereco().get('tv')).toBe('1');
      expect(endereco().get('dias')).toBe('180');
      expect(useModoTV.getState().ativo).toBe(true);
      expect(document.documentElement.dataset.modoTv).toBe('true');
    });

    it('no modo TV, os seletores viram texto e fica o botao de sair', async () => {
      renderizar('/paineis/compras?tv=1&atualizar=120');
      await screen.findByRole('group', { name: 'PCs em aberto' });

      expect(screen.queryByLabelText('Período')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Modo TV' })).not.toBeInTheDocument();
      expect(screen.getByText('Últimos 90 dias · atualização a cada 2 min')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sair do modo TV' })).toBeInTheDocument();
      // Aberto pelo favorito (sem clique), a tela cheia fica a um botao.
      expect(screen.getByRole('button', { name: 'Tela cheia' })).toBeInTheDocument();
    });

    it('"Tela cheia" pede a tela cheia de novo (fallback do favorito)', async () => {
      renderizar('/paineis/compras?tv=1');

      await userEvent.click(screen.getByRole('button', { name: 'Tela cheia' }));

      expect(pedirTelaCheia).toHaveBeenCalledOnce();
    });

    it('navegador negou a tela cheia: o modo TV segue dentro da pagina', async () => {
      pedirTelaCheia.mockRejectedValue(new Error('negado'));
      renderizar();
      await screen.findByRole('group', { name: 'PCs em aberto' });

      await userEvent.click(screen.getByRole('button', { name: 'Modo TV' }));

      expect(await screen.findByRole('button', { name: 'Sair do modo TV' })).toBeInTheDocument();
      expect(useModoTV.getState().ativo).toBe(true);
    });

    it('"Sair do modo TV" volta ao normal', async () => {
      renderizar('/paineis/compras?tv=1&dias=30');

      await userEvent.click(screen.getByRole('button', { name: 'Sair do modo TV' }));

      expect(endereco().get('tv')).toBeNull();
      expect(endereco().get('dias')).toBe('30');
      expect(useModoTV.getState().ativo).toBe(false);
      expect(document.documentElement.dataset.modoTv).toBeUndefined();
      expect(screen.getByRole('button', { name: 'Modo TV' })).toBeInTheDocument();
    });

    it('Esc sai do modo TV', async () => {
      renderizar('/paineis/compras?tv=1');
      expect(useModoTV.getState().ativo).toBe(true);

      fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(() => expect(useModoTV.getState().ativo).toBe(false));
      expect(endereco().get('tv')).toBeNull();
    });

    it('sair da tela cheia pelo navegador sai do modo TV', async () => {
      renderizar();
      await screen.findByRole('group', { name: 'PCs em aberto' });
      await userEvent.click(screen.getByRole('button', { name: 'Modo TV' }));

      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: document.documentElement });
      act(() => void document.dispatchEvent(new Event('fullscreenchange')));
      expect(useModoTV.getState().ativo).toBe(true);
      expect(screen.queryByRole('button', { name: 'Tela cheia' })).not.toBeInTheDocument();

      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
      act(() => void document.dispatchEvent(new Event('fullscreenchange')));

      await waitFor(() => expect(useModoTV.getState().ativo).toBe(false));
      expect(endereco().get('tv')).toBeNull();
    });

    it('sair da tela tambem desliga o modo TV', () => {
      const { unmount } = renderizar('/paineis/compras?tv=1');
      expect(useModoTV.getState().ativo).toBe(true);

      unmount();

      expect(useModoTV.getState().ativo).toBe(false);
    });
  });
});
