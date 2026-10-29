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

function renderizar(rota = '/estrutura-produtos/1/nova') {
  return renderizarComProvedores(
    <Routes>
      <Route path="/estrutura-produtos/:produtoId/nova" element={<NovaEstruturaProduto />} />
    </Routes>,
    { rota },
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

    await userEvent.clear(screen.getByLabelText(/Vigência/));
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

    await userEvent.clear(screen.getByLabelText(/Vigência/));
    await userEvent.type(screen.getByLabelText(/Vigência/), '2026-10-01');
    await userEvent.selectOptions(screen.getByLabelText(/Parte\/peça/), 'RES-10K — Resistor');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(servidor.requisicoes.find((r) => r.url === '/boms/10/versionar')).toBeTruthy());
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Nova versão criada');
  });

  it('replica a versao de origem e envia exatamente os itens que ficaram na tela', async () => {
    const pecas = {
      sucesso: true,
      dados: [
        { id: 1, codigo: 'RES-10K', descricao: 'Resistor', ativo: true },
        { id: 2, codigo: 'CAP-1U', descricao: 'Capacitor', ativo: true },
        { id: 3, codigo: 'LED-R', descricao: 'LED', ativo: true },
      ],
      paginacao: { pagina: 1, limite: 200, total: 3, total_paginas: 1 },
    };
    servidor.responder([
      {
        metodo: 'get', url: '/produtos-acabados/1/boms', status: 200,
        corpo: {
          sucesso: true,
          dados: [
            { id: 20, versao: 2, data_vigencia_inicio: '2026-10-01', ativo: true, itens: [{ id: 3, parte_peca_id: 1, quantidade: 4 }, { id: 4, parte_peca_id: 2, quantidade: 2 }] },
            { id: 10, versao: 1, data_vigencia_inicio: '2026-09-01', ativo: false, itens: [{ id: 1, parte_peca_id: 1, quantidade: 4 }] },
          ],
        },
      },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: pecas },
      { metodo: 'post', url: '/boms/20/versionar', status: 201, corpo: { sucesso: true, dados: { id: 30, versao: 3 } } },
    ]);
    renderizar();
    await screen.findByText('Nova versão da estrutura');

    // Replicou os 2 itens da mais recente (v2); retira o primeiro e acrescenta o LED.
    expect(screen.getAllByLabelText(/Parte\/peça/)).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Remover item' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    await userEvent.selectOptions(screen.getAllByLabelText(/Parte\/peça/)[1], 'LED-R — LED');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      const corpo = servidor.requisicoes.find((r) => r.url === '/boms/20/versionar')?.corpo as {
        itens: { parte_peca_id: number; quantidade: number }[];
      };
      expect(corpo.itens).toEqual([
        { parte_peca_id: 2, quantidade: 2 },
        { parte_peca_id: 3, quantidade: 1 },
      ]);
    });
  });

  it('com ?base= parte da versao indicada, nao da mais recente', async () => {
    servidor.responder([
      {
        metodo: 'get', url: '/produtos-acabados/1/boms', status: 200,
        corpo: {
          sucesso: true,
          dados: [
            { id: 20, versao: 2, data_vigencia_inicio: '2026-10-01', ativo: true, itens: [{ id: 3, parte_peca_id: 1, quantidade: 4 }, { id: 4, parte_peca_id: 1, quantidade: 2 }] },
            { id: 10, versao: 1, data_vigencia_inicio: '2026-09-01', ativo: false, itens: [{ id: 1, parte_peca_id: 1, quantidade: 4 }] },
          ],
        },
      },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
    ]);
    renderizar('/estrutura-produtos/1/nova?base=10');

    expect(await screen.findByText(/Parte da versão 1/)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Parte\/peça/)).toHaveLength(1);
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

    await userEvent.clear(screen.getByLabelText(/Vigência/));
    await userEvent.type(screen.getByLabelText(/Vigência/), '2026-09-01');
    await userEvent.selectOptions(screen.getByLabelText(/Parte\/peça/), 'RES-10K — Resistor');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('estrutura ativa');
  });

  it('rejeita a mesma peca em dois itens sem enviar a requisicao', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1/boms', status: 200, corpo: { sucesso: true, dados: [] } },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
    ]);
    renderizar();
    await screen.findByText('Criar estrutura');

    await userEvent.clear(screen.getByLabelText(/Vigência/));
    await userEvent.type(screen.getByLabelText(/Vigência/), '2026-09-01');
    await userEvent.selectOptions(screen.getAllByLabelText(/Parte\/peça/)[0], 'RES-10K — Resistor');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    await userEvent.selectOptions(screen.getAllByLabelText(/Parte\/peça/)[1], 'RES-10K — Resistor');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Esta peça já foi adicionada')).toBeInTheDocument();
    expect(servidor.requisicoes.find((r) => r.url === '/boms')).toBeUndefined();
  });

  it('historico indisponivel mostra mensagem de erro em vez do formulario', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1/boms', status: 500, corpo: { sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'falha' } } },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
    ]);
    renderizar();

    expect(await screen.findByText('Não foi possível carregar o histórico da estrutura.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
  });
});
