import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { DetalheCotacao } from './DetalheCotacao';

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

function cotacaoBase(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: 1,
    numero_cotacao: 'COT-2026-001',
    fornecedor_id: 1,
    data_emissao: '2026-08-25',
    data_validade: '2026-09-25',
    valor_total: 5000,
    status,
    itens: [{ id: 1, parte_peca_id: 1, quantidade: 100, preco_unitario: 50, total: 5000 }],
    created_at: '2026-08-25T12:00:00Z',
    updated_at: '2026-08-25T12:00:00Z',
    ...extra,
  };
}

function renderizar() {
  return renderizarComProvedores(
    <Routes>
      <Route path="/cotacoes/:id" element={<DetalheCotacao />} />
    </Routes>,
    { rota: '/cotacoes/1' },
  );
}

describe('DetalheCotacao', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    navegar.mockClear();
    servidor = instalarServidorFalso();
    useToasts.setState({ itens: [] });
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/cotacoes/1', status: 200, corpo: { sucesso: true, dados: cotacaoBase('Rascunho') } },
    ]);
  });

  it('em Rascunho, Enviar muda o status e a trilha', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/cotacoes/1', status: 200, corpo: { sucesso: true, dados: cotacaoBase('Rascunho') } },
      {
        metodo: 'post',
        url: '/cotacoes/1/enviar',
        status: 200,
        corpo: { sucesso: true, dados: cotacaoBase('Enviada') },
      },
    ]);
    renderizar();
    await screen.findByText('COT-2026-001');

    await userEvent.click(screen.getByRole('button', { name: /Enviada/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Cotação enviada'));
  });

  it('em Enviada, registrar resposta muda o status', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/cotacoes/1', status: 200, corpo: { sucesso: true, dados: cotacaoBase('Enviada') } },
      {
        metodo: 'post',
        url: '/cotacoes/1/registrar-resposta',
        status: 200,
        corpo: { sucesso: true, dados: cotacaoBase('Respondida', { data_resposta: '2026-09-01' }) },
      },
    ]);
    renderizar();
    await screen.findByText('COT-2026-001');

    await userEvent.click(screen.getByRole('button', { name: /Respondida/ }));
    await userEvent.type(screen.getByLabelText(/^Data da resposta/), '2026-09-01');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar resposta' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Resposta registrada'));
  });

  it('em Respondida, converter em pedido de compra navega para o PC criado', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      {
        metodo: 'get',
        url: '/cotacoes/1',
        status: 200,
        corpo: { sucesso: true, dados: cotacaoBase('Respondida', { data_resposta: '2026-09-01' }) },
      },
      {
        metodo: 'post',
        url: '/cotacoes/1/converter-pc',
        status: 201,
        corpo: { sucesso: true, dados: { id: 9, numero_pc: 'PC-2026-001' } },
      },
    ]);
    renderizar();
    await screen.findByText('COT-2026-001');

    await userEvent.click(screen.getByRole('button', { name: 'Converter em pedido de compra' }));
    await userEvent.type(screen.getByLabelText(/^Número do PC/), 'PC-2026-001');
    await userEvent.type(screen.getByLabelText(/^Data de entrega/), '2026-10-15');
    await userEvent.click(screen.getByRole('button', { name: 'Converter' }));

    await waitFor(() => expect(navegar).toHaveBeenCalledWith('/pedidos-compra/9'));
  });

  it('cancelar pede confirmacao antes de agir', async () => {
    renderizar();
    await screen.findByText('COT-2026-001');

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar cotação' }));

    expect(screen.getByRole('dialog', { name: 'Cancelar cotação' })).toBeInTheDocument();
  });

  it('cotacao cancelada mostra o aviso em vez da trilha', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      {
        metodo: 'get',
        url: '/cotacoes/1',
        status: 200,
        corpo: { sucesso: true, dados: cotacaoBase('Cancelada') },
      },
    ]);
    renderizar();

    expect(await screen.findByText(/Cotação cancelada/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /Status/ })).not.toBeInTheDocument();
  });
});
