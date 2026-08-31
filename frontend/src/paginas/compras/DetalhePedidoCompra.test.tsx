import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { DetalhePedidoCompra } from './DetalhePedidoCompra';

const navegar = vi.fn();
vi.mock('react-router-dom', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('react-router-dom')>();
  return { ...original, useNavigate: () => navegar };
});

const paginaFornecedores = {
  sucesso: true,
  dados: [{ id: 1, razao_social: 'Componentes Silva Ltda', ativo: true }],
  paginacao: { pagina: 1, limite: 200, total: 1, total_paginas: 1 },
};

const paginaPecas = {
  sucesso: true,
  dados: [{ id: 1, codigo: 'RES-10K', descricao: 'Resistor', ativo: true }],
  paginacao: { pagina: 1, limite: 200, total: 1, total_paginas: 1 },
};

function pedidoBase(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: 1,
    numero_pc: 'PC-2026-001',
    fornecedor_id: 1,
    data_pedido: '2026-08-25',
    data_entrega_prevista: '2026-09-25',
    valor_total: 5000,
    status,
    itens: [{ id: 1, parte_peca_id: 1, quantidade_solicitada: 100, quantidade_recebida: 0, preco_unitario: 50, total: 5000 }],
    created_at: '2026-08-25T12:00:00Z',
    updated_at: '2026-08-25T12:00:00Z',
    ...extra,
  };
}

function renderizar() {
  return renderizarComProvedores(
    <Routes>
      <Route path="/pedidos-compra/:id" element={<DetalhePedidoCompra />} />
    </Routes>,
    { rota: '/pedidos-compra/1' },
  );
}

describe('DetalhePedidoCompra', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    navegar.mockClear();
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
  });

  it('em Rascunho, Emitir muda o status', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase('Rascunho') } },
      { metodo: 'post', url: '/pedidos-compra/1/emitir', status: 200, corpo: { sucesso: true, dados: pedidoBase('Emitido') } },
    ]);
    renderizar();
    await screen.findByText('PC-2026-001');

    await userEvent.click(screen.getByRole('button', { name: /Emitido/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Emitir' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Pedido de compra emitido'));
  });

  it('cancelar pede confirmacao antes de agir', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase('Emitido') } },
    ]);
    renderizar();
    await screen.findByText('PC-2026-001');

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));

    expect(screen.getByRole('dialog', { name: 'Cancelar pedido de compra' })).toBeInTheDocument();
  });

  it('mostra o link para a cotacao de origem quando existe', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      {
        metodo: 'get',
        url: '/pedidos-compra/1',
        status: 200,
        corpo: { sucesso: true, dados: pedidoBase('Emitido', { cotacao_id: 7 }) },
      },
    ]);
    renderizar();
    await screen.findByText('PC-2026-001');

    expect(screen.getByRole('link', { name: /Ver cotação de origem/ })).toHaveAttribute('href', '/cotacoes/7');
  });

  it('mostra a condicao de pagamento quando informada', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      {
        metodo: 'get',
        url: '/pedidos-compra/1',
        status: 200,
        corpo: { sucesso: true, dados: pedidoBase('Emitido', { condicao_pagamento: '30 dias' }) },
      },
    ]);
    renderizar();

    expect(await screen.findByText(/30 dias/)).toBeInTheDocument();
  });

  it('pedido cancelado mostra o aviso em vez da trilha', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase('Cancelado') } },
    ]);
    renderizar();

    expect(await screen.findByText(/Pedido cancelado/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /Status/ })).not.toBeInTheDocument();
  });

  it('pedido concluido nao mostra o botao de cancelar', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase('Concluido') } },
    ]);
    renderizar();
    await screen.findByText('PC-2026-001');

    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
  });

  it('mostra a etapa Concluido como acionavel quando aguardando entrega', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      {
        metodo: 'get',
        url: '/pedidos-compra/1',
        status: 200,
        corpo: { sucesso: true, dados: pedidoBase('Aguardando Entrega') },
      },
    ]);
    renderizar();

    expect(await screen.findByRole('button', { name: /Concluído/ })).toHaveAttribute('aria-current', 'step');
  });

  it('registrar recebimento parcial envia o corpo certo e atualiza a tela', async () => {
    const pedidoAguardandoEntrega = pedidoBase('Aguardando Entrega');
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoAguardandoEntrega } },
      {
        metodo: 'post',
        url: '/pedidos-compra/1/registrar-recebimento',
        status: 200,
        corpo: { sucesso: true, dados: { ...pedidoAguardandoEntrega, status: 'Recebido Parcial' } },
      },
    ]);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: /Concluído/ }));
    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/receber agora/), '40');
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar recebimento' }));

    await waitFor(() =>
      expect(servidor.requisicoes.find((r) => r.url === '/pedidos-compra/1/registrar-recebimento')?.corpo).toEqual({
        itens: [{ parte_peca_id: pedidoAguardandoEntrega.itens[0].parte_peca_id, quantidade_recebida: 40 }],
      }),
    );
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Recebimento registrado');
  });
});
