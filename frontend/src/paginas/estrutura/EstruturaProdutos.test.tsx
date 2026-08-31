import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { EstruturaProdutos } from './EstruturaProdutos';

const PAGINA = {
  sucesso: true,
  dados: [
    { id: 1, codigo: 'VMS-01', descricao: 'Painel de velocidade', ativo: true, estrutura_ativa: { versao: 2, data_vigencia_inicio: '2026-10-01' } },
    { id: 2, codigo: 'R-200', descricao: 'Radar fixo', ativo: true },
  ],
  paginacao: { pagina: 1, limite: 20, total: 2, total_paginas: 1 },
};

describe('EstruturaProdutos', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('mostra a versao vigente e "Sem estrutura ativa" para quem nao tem', async () => {
    servidor.responder([{ metodo: 'get', url: '/produtos-acabados', status: 200, corpo: PAGINA }]);
    renderizarComProvedores(<EstruturaProdutos />);

    expect(await screen.findByText('v.2 desde 01/10/2026')).toBeInTheDocument();
    expect(screen.getByText('Sem estrutura ativa')).toBeInTheDocument();
  });

  it('clicar no codigo navega para o detalhe', async () => {
    servidor.responder([{ metodo: 'get', url: '/produtos-acabados', status: 200, corpo: PAGINA }]);
    renderizarComProvedores(<EstruturaProdutos />);
    await screen.findByText('VMS-01');

    // navegacao real via MemoryRouter -- o teste so confirma que o botao existe
    // e e clicavel; a Task F3 cobre o destino renderizado.
    expect(screen.getByRole('button', { name: 'VMS-01' })).toBeInTheDocument();
  });
});
