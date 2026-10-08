import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { Cotacoes } from './Cotacoes';

const navegar = vi.fn();
vi.mock('react-router-dom', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('react-router-dom')>();
  return { ...original, useNavigate: () => navegar };
});

const cotacao = {
  id: 1,
  numero_cotacao: 'COT-2026-001',
  fornecedor_id: 1,
  data_emissao: '2026-08-25',
  data_validade: '2026-09-25',
  valor_total: 5000,
  status: 'Enviada',
  itens: [],
  created_at: '2026-08-25T12:00:00Z',
  updated_at: '2026-08-25T12:00:00Z',
};

const paginaComUmaCotacao = {
  sucesso: true,
  dados: [cotacao],
  paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 },
};

const fornecedor = { id: 1, razao_social: 'Componentes Silva Ltda', ativo: true };
const paginaFornecedores = {
  sucesso: true,
  dados: [fornecedor],
  paginacao: { pagina: 1, limite: 200, total: 1, total_paginas: 1 },
};

describe('Cotacoes', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    navegar.mockClear();
    servidor = instalarServidorFalso();
    servidor.responder([
      { metodo: 'get', url: '/cotacoes', status: 200, corpo: paginaComUmaCotacao },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
    ]);
  });

  it('mostra a cotacao com o fornecedor resolvido e o status em destaque', async () => {
    renderizarComProvedores(<Cotacoes />);

    expect(await screen.findByText('COT-2026-001')).toBeInTheDocument();
    expect(await screen.findByText('Componentes Silva Ltda')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Enviada')).toBeInTheDocument();
  });

  it('Nova cotação navega para o formulario', async () => {
    renderizarComProvedores(<Cotacoes />);
    await screen.findByText('COT-2026-001');

    await userEvent.click(screen.getByRole('button', { name: 'Nova cotação' }));

    expect(navegar).toHaveBeenCalledWith('/cotacoes/nova');
  });

  it('clicar na linha navega para o detalhe da cotacao', async () => {
    renderizarComProvedores(<Cotacoes />);
    await screen.findByText('COT-2026-001');

    await userEvent.click(screen.getByText('COT-2026-001'));

    expect(navegar).toHaveBeenCalledWith('/cotacoes/1');
  });

  it('filtro de status envia o status escolhido na consulta', async () => {
    renderizarComProvedores(<Cotacoes />);
    await screen.findByText('COT-2026-001');

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'Respondida');

    await waitFor(() =>
      expect(servidor.requisicoes.at(-1)?.params).toMatchObject({ status: 'Respondida' }),
    );
  });
});
