import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { NecessidadeCompra } from './NecessidadeCompra';

const navegar = vi.fn();
vi.mock('react-router-dom', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('react-router-dom')>();
  return { ...original, useNavigate: () => navegar };
});

const ITENS = [
  { parte_peca_id: 1, codigo: 'RES-10K', descricao: 'Resistor', saldo_atual: 2, estoque_minimo: 10, necessidade: 8, fornecedor_padrao_id: 5, fornecedor_padrao_nome: 'Fornecedor Alpha' },
  { parte_peca_id: 2, codigo: 'CAP-100', descricao: 'Capacitor', saldo_atual: 0, estoque_minimo: 5, necessidade: 5 },
];

describe('NecessidadeCompra', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    navegar.mockClear();
    servidor = instalarServidorFalso();
  });

  it('agrupa por fornecedor padrao e mostra a necessidade', async () => {
    servidor.responder([{ metodo: 'get', url: '/necessidade-compra', status: 200, corpo: { sucesso: true, dados: ITENS } }]);
    renderizarComProvedores(<NecessidadeCompra />);

    expect(await screen.findByText('Fornecedor Alpha')).toBeInTheDocument();
    expect(screen.getByText('Sem fornecedor padrão')).toBeInTheDocument();
    expect(screen.getByText('RES-10K')).toBeInTheDocument();
    expect(screen.getByText('CAP-100')).toBeInTheDocument();
  });

  it('grupo sem fornecedor padrao nao mostra o botao Gerar cotacao', async () => {
    servidor.responder([{ metodo: 'get', url: '/necessidade-compra', status: 200, corpo: { sucesso: true, dados: ITENS } }]);
    renderizarComProvedores(<NecessidadeCompra />);
    await screen.findByText('Fornecedor Alpha');

    expect(screen.getAllByRole('button', { name: 'Gerar cotação' })).toHaveLength(1);
    expect(screen.getByText('Cadastre um fornecedor padrão nessas peças antes de gerar uma cotação.')).toBeInTheDocument();
  });

  it('Gerar cotacao navega para Nova Cotacao com fornecedor e itens pre-preenchidos', async () => {
    servidor.responder([{ metodo: 'get', url: '/necessidade-compra', status: 200, corpo: { sucesso: true, dados: ITENS } }]);
    renderizarComProvedores(<NecessidadeCompra />);
    await screen.findByText('Fornecedor Alpha');

    await userEvent.click(screen.getByRole('button', { name: 'Gerar cotação' }));

    expect(navegar).toHaveBeenCalledWith('/cotacoes/nova', {
      state: { fornecedorId: 5, itens: [{ parte_peca_id: 1, quantidade: 8 }] },
    });
  });

  it('lista vazia mostra mensagem de nada pendente', async () => {
    servidor.responder([{ metodo: 'get', url: '/necessidade-compra', status: 200, corpo: { sucesso: true, dados: [] } }]);
    renderizarComProvedores(<NecessidadeCompra />);

    expect(await screen.findByText('Nenhuma peça está abaixo do estoque mínimo no momento.')).toBeInTheDocument();
  });
});
