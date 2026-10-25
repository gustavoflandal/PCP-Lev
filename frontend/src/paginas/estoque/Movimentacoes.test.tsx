import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { Movimentacoes } from './Movimentacoes';

const PAGINA = {
  sucesso: true,
  dados: [
    {
      id: 1,
      parte_peca_id: 10,
      codigo_pp: 'PLC-CTRL-01',
      tipo: 'Entrada',
      quantidade: 25,
      motivo: 'Compra',
      referencia_numero: 'PC-2026-040',
      usuario: 'admin',
      data_hora: '2026-08-30T12:00:00Z',
    },
    {
      id: 2,
      parte_peca_id: 11,
      codigo_pp: 'RES-10K',
      tipo: 'Ajuste',
      quantidade: -5,
      motivo: 'Perda',
      usuario: 'admin',
      data_hora: '2026-08-29T09:00:00Z',
    },
  ],
  paginacao: { pagina: 1, limite: 20, total: 2, total_paginas: 1 },
};

describe('Movimentacoes', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('mostra as movimentações com peça, tipo, quantidade e motivo', async () => {
    servidor.responder([{ metodo: 'get', url: '/movimentacoes', status: 200, corpo: PAGINA }]);
    renderizarComProvedores(<Movimentacoes />);

    expect(await screen.findByText('PLC-CTRL-01')).toBeInTheDocument();
    expect(screen.getByText('Entrada')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('PC-2026-040')).toBeInTheDocument();
    expect(screen.getByText('RES-10K')).toBeInTheDocument();
    expect(screen.getByText('Ajuste')).toBeInTheDocument();
  });

  it('mostra travessão quando não há referência', async () => {
    servidor.responder([{ metodo: 'get', url: '/movimentacoes', status: 200, corpo: PAGINA }]);
    renderizarComProvedores(<Movimentacoes />);

    await screen.findByText('RES-10K');
    const linhaAjuste = screen.getByText('RES-10K').closest('tr');
    expect(linhaAjuste).not.toBeNull();
    expect(linhaAjuste!.textContent).toContain('—');
  });

  it('mostra mensagem vazia quando não há movimentações', async () => {
    servidor.responder([
      { metodo: 'get', url: '/movimentacoes', status: 200, corpo: { sucesso: true, dados: [], paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 } } },
    ]);
    renderizarComProvedores(<Movimentacoes />);

    expect(await screen.findByText('Nenhuma movimentação registrada ainda.')).toBeInTheDocument();
  });
});
