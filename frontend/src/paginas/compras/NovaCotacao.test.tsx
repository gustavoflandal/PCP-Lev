import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { NovaCotacao } from './NovaCotacao';

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

const cotacaoCriada = {
  id: 1,
  numero_cotacao: 'COT-2026-001',
  fornecedor_id: 1,
  data_emissao: '2026-08-25',
  data_validade: '2026-09-25',
  valor_total: 5000,
  status: 'Rascunho',
  itens: [{ id: 1, parte_peca_id: 1, quantidade: 100, preco_unitario: 50, total: 5000 }],
  created_at: '2026-08-25T12:00:00Z',
  updated_at: '2026-08-25T12:00:00Z',
};

describe('NovaCotacao', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    navegar.mockClear();
    servidor = instalarServidorFalso();
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
    ]);
  });

  it('cadastrar envia o corpo e navega para o detalhe', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'post', url: '/cotacoes', status: 201, corpo: { sucesso: true, dados: cotacaoCriada } },
    ]);
    renderizarComProvedores(<NovaCotacao />);
    await screen.findByText('Componentes Silva Ltda');

    await userEvent.type(screen.getByLabelText(/^Número/), 'COT-2026-001');
    await userEvent.selectOptions(screen.getByLabelText(/^Fornecedor/), '1');
    await userEvent.type(screen.getByLabelText(/^Validade/), '2026-09-25');
    await userEvent.selectOptions(screen.getByLabelText(/^Parte\/peça/), '1');
    const quantidade = screen.getByLabelText(/^Quantidade/);
    await userEvent.clear(quantidade);
    await userEvent.type(quantidade, '100');
    const preco = screen.getByLabelText(/^Preço unitário/);
    await userEvent.clear(preco);
    await userEvent.type(preco, '50');

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(navegar).toHaveBeenCalledWith('/cotacoes/1'));
    const enviado = servidor.requisicoes.find((r) => r.metodo === 'post');
    expect(enviado?.corpo).toMatchObject({
      numero_cotacao: 'COT-2026-001',
      fornecedor_id: 1,
      data_validade: '2026-09-25',
      itens: [{ parte_peca_id: 1, quantidade: 100, preco_unitario: 50 }],
    });
  });

  it('adicionar item acrescenta uma linha', async () => {
    renderizarComProvedores(<NovaCotacao />);
    await screen.findByText('Componentes Silva Ltda');

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));

    expect(screen.getAllByLabelText(/^Parte\/peça/)).toHaveLength(2);
  });

  it('nao permite remover o unico item restante', async () => {
    renderizarComProvedores(<NovaCotacao />);
    await screen.findByText('Componentes Silva Ltda');

    expect(screen.queryByRole('button', { name: 'Remover item' })).not.toBeInTheDocument();
  });

  it('conflito 409 mostra alerta e nao navega', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      {
        metodo: 'post',
        url: '/cotacoes',
        status: 409,
        corpo: { sucesso: false, erro: { codigo: 'CONFLITO', mensagem: 'já existe uma cotação com este número' } },
      },
    ]);
    renderizarComProvedores(<NovaCotacao />);
    await screen.findByText('Componentes Silva Ltda');

    await userEvent.type(screen.getByLabelText(/^Número/), 'COT-2026-001');
    await userEvent.selectOptions(screen.getByLabelText(/^Fornecedor/), '1');
    await userEvent.type(screen.getByLabelText(/^Validade/), '2026-09-25');
    await userEvent.selectOptions(screen.getByLabelText(/^Parte\/peça/), '1');
    const quantidade = screen.getByLabelText(/^Quantidade/);
    await userEvent.clear(quantidade);
    await userEvent.type(quantidade, '100');
    const preco = screen.getByLabelText(/^Preço unitário/);
    await userEvent.clear(preco);
    await userEvent.type(preco, '50');

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('já existe uma cotação com este número');
    expect(navegar).not.toHaveBeenCalled();
  });
});
