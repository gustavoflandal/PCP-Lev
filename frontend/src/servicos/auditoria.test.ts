import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { listarAuditoria, queryDeExportacaoAuditoria } from './auditoria';

describe('servicos/auditoria', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('listarAuditoria envia pagina/limite e so os filtros preenchidos', async () => {
    servidor.responder([
      { metodo: 'get', url: '/auditoria', status: 200, corpo: { dados: [], paginacao: { pagina: 1, limite: 50, total: 0, total_paginas: 0 } } },
    ]);

    await listarAuditoria({ pagina: 1, limite: 50, tabela: 'fornecedores' });

    expect(servidor.requisicoes[0].params).toEqual({ pagina: 1, limite: 50, tabela: 'fornecedores' });
  });

  it('listarAuditoria devolve os itens e a paginacao', async () => {
    servidor.responder([
      {
        metodo: 'get', url: '/auditoria', status: 200,
        corpo: { dados: [{ id: 1, tabela: 'fornecedores', operacao: 'INSERT', data_hora: '2026-08-31T10:00:00Z' }], paginacao: { pagina: 1, limite: 50, total: 1, total_paginas: 1 } },
      },
    ]);

    const resultado = await listarAuditoria({ pagina: 1, limite: 50 });

    expect(resultado.itens).toHaveLength(1);
    expect(resultado.paginacao.total).toBe(1);
  });

  it('queryDeExportacaoAuditoria monta a query so com os filtros preenchidos', () => {
    expect(queryDeExportacaoAuditoria({ tabela: 'fornecedores', operacao: 'UPDATE' })).toBe('tabela=fornecedores&operacao=UPDATE');
    expect(queryDeExportacaoAuditoria({})).toBe('');
  });
});
