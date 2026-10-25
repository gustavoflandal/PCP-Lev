import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { OrdensProducao } from './OrdensProducao';

const op = {
  id: 40,
  numero_op: 'OP-2026-00001',
  pedido_venda_id: 1,
  numero_pedido: 'PV-001',
  cliente_nome: 'DER Teste',
  item_pedido_venda_id: 11,
  produto_acabado_id: 5,
  produto_codigo: 'RAD-200',
  produto_descricao: 'Radar fixo R-200',
  exige_metrologia: false,
  quantidade: 2,
  estrutura_produto_id: 3,
  estrutura_versao: 1,
  data_conclusao_prevista: '2020-01-01',
  etapa_atual: 'Montagem',
  status: 'Liberada',
  observacoes: '',
  created_at: '2026-10-24T12:00:00Z',
};

describe('OrdensProducao', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    entrarComoPerfil('OPERADOR');
    servidor = instalarServidorFalso();
  });

  it('lista OPs com etapa, atraso e filtra por etapa e situacao', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/ops',
        status: 200,
        corpo: { sucesso: true, dados: [op], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } },
      },
    ]);
    renderizarComProvedores(<OrdensProducao />);

    const linha = (await screen.findByRole('button', { name: 'OP-2026-00001' })).closest('tr')!;
    expect(within(linha).getByText('Montagem')).toBeInTheDocument();
    expect(within(linha).getByText('Atrasada')).toBeInTheDocument();
    expect(within(linha).getByText('Liberada')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Etapa'), 'Testes');
    await waitFor(() => expect(servidor.requisicoes.some((r) => r.params.etapa === 'Testes')).toBe(true));
    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'Liberada');
    await waitFor(() =>
      expect(servidor.requisicoes.some((r) => r.params.status === 'Liberada' && r.params.etapa === 'Testes')).toBe(true),
    );
    // Sem filtro de etapa, o parametro nem vai.
    expect(servidor.requisicoes[0].params).not.toHaveProperty('etapa');
  });
});
