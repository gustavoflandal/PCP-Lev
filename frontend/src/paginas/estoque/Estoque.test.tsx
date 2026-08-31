import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderizarComProvedores, instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { useToasts } from '@/componentes/ui/Toast';
import { Estoque } from './Estoque';

const ITEM = {
  id: 1, parte_peca_id: 10, codigo: 'CON-001', descricao: 'Conector RCA Macho',
  quantidade_atual: 250, quantidade_reservada: 100, disponivel: 150,
  estoque_minimo: 50, status: 'OK', updated_at: '2026-08-30T12:00:00Z',
};

describe('Estoque', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    useToasts.setState({ itens: [] });
  });

  it('mostra as colunas e o saldo', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } }]);
    renderizarComProvedores(<Estoque />);

    expect(await screen.findByText('CON-001')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('badge de status critico usa o tom certo', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [{ ...ITEM, status: 'CRITICO' }], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } }]);
    renderizarComProvedores(<Estoque />);

    expect(await screen.findByText('Crítico')).toBeInTheDocument();
  });

  it('filtro de status muda a query', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } }]);
    renderizarComProvedores(<Estoque />);
    await screen.findByText('CON-001');

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'CRITICO');

    await waitFor(() => expect(servidor.requisicoes.at(-1)?.params.status).toBe('CRITICO'));
  });

  it('ajustar saldo envia o corpo certo e mostra toast', async () => {
    servidor.responder([
      { metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
      { metodo: 'post', url: '/estoque/ajuste', status: 201, corpo: { dados: { ...ITEM, quantidade_atual: 260 } } },
    ]);
    renderizarComProvedores(<Estoque />);
    await screen.findByText('CON-001');

    await userEvent.click(screen.getByRole('button', { name: 'Ajustar' }));
    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/Quantidade/), '10');
    await userEvent.type(within(modal).getByLabelText(/Motivo/), 'Inventário físico');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ajuste' }));

    await waitFor(() =>
      expect(servidor.requisicoes.find((r) => r.url === '/estoque/ajuste')?.corpo).toEqual({
        parte_peca_id: 10, quantidade: 10, motivo: 'Inventário físico',
      }),
    );
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Estoque ajustado');
  });

  it('erro 409 no ajuste mostra alerta com o modal aberto', async () => {
    servidor.responder([
      { metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
      { metodo: 'post', url: '/estoque/ajuste', status: 409, corpo: { sucesso: false, erro: { codigo: 'CONFLITO', mensagem: 'O ajuste deixaria o saldo negativo' } } },
    ]);
    renderizarComProvedores(<Estoque />);
    await screen.findByText('CON-001');

    await userEvent.click(screen.getByRole('button', { name: 'Ajustar' }));
    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/Quantidade/), '-1000');
    await userEvent.type(within(modal).getByLabelText(/Motivo/), 'Perda');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ajuste' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('saldo negativo');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
