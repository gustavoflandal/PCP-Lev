import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { NovaEstruturaProduto } from './NovaEstruturaProduto';

const navegar = vi.fn();
vi.mock('react-router-dom', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('react-router-dom')>();
  return { ...original, useNavigate: () => navegar };
});

const PECAS = {
  sucesso: true,
  dados: [{ id: 1, codigo: 'RES-10K', descricao: 'Resistor', ativo: true }],
  paginacao: { pagina: 1, limite: 200, total: 1, total_paginas: 1 },
};

function renderizar() {
  return renderizarComProvedores(
    <Routes>
      <Route path="/estrutura-produtos/:produtoId/nova" element={<NovaEstruturaProduto />} />
    </Routes>,
    { rota: '/estrutura-produtos/1/nova' },
  );
}

describe('NovaEstruturaProduto', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    navegar.mockClear();
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
  });

  it('sem estrutura ativa, envia para POST /boms com o produto', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1/boms', status: 200, corpo: { sucesso: true, dados: [] } },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
      { metodo: 'post', url: '/boms', status: 201, corpo: { sucesso: true, dados: { id: 1, versao: 1 } } },
    ]);
    renderizar();
    await screen.findByText('Criar estrutura');

    await userEvent.type(screen.getByLabelText(/Vigência/), '2026-09-01');
    await userEvent.selectOptions(screen.getByLabelText(/Parte\/peça/), 'RES-10K — Resistor');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(servidor.requisicoes.find((r) => r.url === '/boms')?.corpo).toEqual({
        produto_acabado_id: 1,
        data_vigencia_inicio: '2026-09-01',
        itens: [{ parte_peca_id: 1, quantidade: 1 }],
      }),
    );
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Estrutura cadastrada');
  });

  it('com estrutura ativa, envia para POST /boms/:id/versionar', async () => {
    servidor.responder([
      {
        metodo: 'get', url: '/produtos-acabados/1/boms', status: 200,
        corpo: { sucesso: true, dados: [{ id: 10, versao: 1, data_vigencia_inicio: '2026-09-01', ativo: true, itens: [] }] },
      },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
      { metodo: 'post', url: '/boms/10/versionar', status: 201, corpo: { sucesso: true, dados: { id: 11, versao: 2 } } },
    ]);
    renderizar();
    await screen.findByText('Nova versão da estrutura');

    await userEvent.type(screen.getByLabelText(/Vigência/), '2026-10-01');
    await userEvent.selectOptions(screen.getByLabelText(/Parte\/peça/), 'RES-10K — Resistor');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(servidor.requisicoes.find((r) => r.url === '/boms/10/versionar')).toBeTruthy());
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Nova versão criada');
  });

  it('erro 409 mostra alerta', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1/boms', status: 200, corpo: { sucesso: true, dados: [] } },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
      {
        metodo: 'post', url: '/boms', status: 409,
        corpo: { sucesso: false, erro: { codigo: 'CONFLITO', mensagem: 'este produto ja possui uma estrutura ativa, use versionar' } },
      },
    ]);
    renderizar();
    await screen.findByText('Criar estrutura');

    await userEvent.type(screen.getByLabelText(/Vigência/), '2026-09-01');
    await userEvent.selectOptions(screen.getByLabelText(/Parte\/peça/), 'RES-10K — Resistor');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('estrutura ativa');
  });
});
