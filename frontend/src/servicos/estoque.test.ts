import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { ajustarEstoque, listarEstoque, listarEstoqueCriticos, listarMovimentacoes, obterEstoque } from './estoque';

describe('servicos/estoque', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('listarEstoque desembrulha o envelope', async () => {
    servidor.responder([
      { metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [{ id: 1 }], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
    ]);
    const resultado = await listarEstoque({ pagina: 1, limite: 20, ordenar_por: 'codigo', ordem: 'asc', status: null });
    expect(resultado.itens).toHaveLength(1);
  });

  it('listarEstoque omite status nulo da query', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [], paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 } } }]);
    await listarEstoque({ pagina: 1, limite: 20, ordenar_por: 'codigo', ordem: 'asc', status: null });
    expect(servidor.requisicoes[0].params.status).toBeUndefined();
  });

  it('listarEstoque envia o status quando informado', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [], paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 } } }]);
    await listarEstoque({ pagina: 1, limite: 20, ordenar_por: 'codigo', ordem: 'asc', status: 'CRITICO' });
    expect(servidor.requisicoes[0].params.status).toBe('CRITICO');
  });

  it('obterEstoque busca por parte_peca_id', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque/1', status: 200, corpo: { dados: { id: 1, parte_peca_id: 1 } } }]);
    const resultado = await obterEstoque(1);
    expect(resultado.parte_peca_id).toBe(1);
  });

  it('listarEstoqueCriticos bate em /estoque/criticos', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque/criticos', status: 200, corpo: { dados: [] } }]);
    const resultado = await listarEstoqueCriticos();
    expect(resultado).toEqual([]);
  });

  it('ajustarEstoque envia POST para /estoque/ajuste', async () => {
    servidor.responder([{ metodo: 'post', url: '/estoque/ajuste', status: 201, corpo: { dados: { id: 1 } } }]);
    await ajustarEstoque({ parte_peca_id: 1, quantidade: 10, motivo: 'Inventario' });
    expect(servidor.requisicoes[0].corpo).toEqual({ parte_peca_id: 1, quantidade: 10, motivo: 'Inventario' });
  });

  it('listarMovimentacoes desembrulha o envelope', async () => {
    servidor.responder([{ metodo: 'get', url: '/movimentacoes', status: 200, corpo: { dados: [], paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 } } }]);
    const resultado = await listarMovimentacoes(1, 20);
    expect(resultado.itens).toEqual([]);
  });
});
