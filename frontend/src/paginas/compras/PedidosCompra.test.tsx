import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { PedidosCompra } from './PedidosCompra';

const navegar = vi.fn();
vi.mock('react-router-dom', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('react-router-dom')>();
  return { ...original, useNavigate: () => navegar };
});

const pedido = {
  id: 1,
  numero_pc: 'PC-2026-001',
  fornecedor_id: 1,
  data_pedido: '2026-08-25',
  data_entrega_prevista: '2026-09-25',
  valor_total: 5000,
  status: 'Emitido',
  itens: [],
  created_at: '2026-08-25T12:00:00Z',
  updated_at: '2026-08-25T12:00:00Z',
};

const paginaComUmPedido = {
  sucesso: true,
  dados: [pedido],
  paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 },
};

const fornecedor = { id: 1, razao_social: 'Componentes Silva Ltda', ativo: true };
const paginaFornecedores = {
  sucesso: true,
  dados: [fornecedor],
  paginacao: { pagina: 1, limite: 200, total: 1, total_paginas: 1 },
};

describe('PedidosCompra', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    navegar.mockClear();
    servidor = instalarServidorFalso();
    servidor.responder([
      { metodo: 'get', url: '/pedidos-compra/em-atraso', status: 200, corpo: { sucesso: true, dados: [] } },
      { metodo: 'get', url: '/pedidos-compra', status: 200, corpo: paginaComUmPedido },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
    ]);
  });

  it('mostra o pedido com o fornecedor resolvido e o status em destaque', async () => {
    renderizarComProvedores(<PedidosCompra />);

    expect(await screen.findByText('PC-2026-001')).toBeInTheDocument();
    expect(await screen.findByText('Componentes Silva Ltda')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Pedidos de compra' })).getByText('Emitido')).toBeInTheDocument();
  });

  it('Novo pedido de compra navega para o formulario', async () => {
    renderizarComProvedores(<PedidosCompra />);
    await screen.findByText('PC-2026-001');

    await userEvent.click(screen.getByRole('button', { name: 'Novo pedido de compra' }));

    expect(navegar).toHaveBeenCalledWith('/pedidos-compra/novo');
  });

  it('clicar na linha navega para o detalhe', async () => {
    renderizarComProvedores(<PedidosCompra />);
    await screen.findByText('PC-2026-001');

    await userEvent.click(screen.getByText('PC-2026-001'));

    expect(navegar).toHaveBeenCalledWith('/pedidos-compra/1');
  });

  it('mostra o bloco de pedidos em atraso quando ha algum', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/pedidos-compra/em-atraso',
        status: 200,
        corpo: { sucesso: true, dados: [{ ...pedido, numero_pc: 'PC-2026-002' }] },
      },
      { metodo: 'get', url: '/pedidos-compra', status: 200, corpo: paginaComUmPedido },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
    ]);

    renderizarComProvedores(<PedidosCompra />);

    expect(await screen.findByText('Pedidos em atraso')).toBeInTheDocument();
    expect(screen.getByText('PC-2026-002')).toBeInTheDocument();
  });

  it('sem pedidos em atraso, o bloco de alerta nao aparece', async () => {
    renderizarComProvedores(<PedidosCompra />);
    await screen.findByText('PC-2026-001');

    expect(screen.queryByText('Pedidos em atraso')).not.toBeInTheDocument();
  });

  it('filtro de status envia o status escolhido na consulta', async () => {
    renderizarComProvedores(<PedidosCompra />);
    await screen.findByText('PC-2026-001');

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'Concluido');

    await waitFor(() =>
      expect(servidor.requisicoes.at(-1)?.params).toMatchObject({ status: 'Concluido' }),
    );
  });
});
