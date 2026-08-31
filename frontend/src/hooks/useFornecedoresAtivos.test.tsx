import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { useFornecedoresAtivos } from './useFornecedoresAtivos';

function envolver({ children }: { children: ReactNode }) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

describe('useFornecedoresAtivos', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    servidor.responder([
      {
        metodo: 'get',
        url: '/fornecedores',
        status: 200,
        corpo: {
          sucesso: true,
          dados: [
            { id: 1, razao_social: 'Componentes Silva Ltda', ativo: true },
            { id: 2, razao_social: 'Conectores Brasil Ltda', ativo: true },
          ],
          paginacao: { pagina: 1, limite: 200, total: 2, total_paginas: 1 },
        },
      },
    ]);
  });

  it('busca so fornecedores ativos, ate 200', async () => {
    renderHook(() => useFornecedoresAtivos(), { wrapper: envolver });

    await waitFor(() => expect(servidor.requisicoes).toHaveLength(1));
    expect(servidor.requisicoes[0].params).toMatchObject({ filtro_ativo: true, limite: 200 });
  });

  it('monta as opcoes de selecao ordenadas pela razao social', async () => {
    const { result } = renderHook(() => useFornecedoresAtivos(), { wrapper: envolver });

    await waitFor(() => expect(result.current.opcoes).toHaveLength(2));
    expect(result.current.opcoes[0]).toEqual({ valor: '1', rotulo: 'Componentes Silva Ltda' });
  });

  it('monta o mapa id -> razao social para exibicao em listas', async () => {
    const { result } = renderHook(() => useFornecedoresAtivos(), { wrapper: envolver });

    await waitFor(() => expect(result.current.porId.size).toBe(2));
    expect(result.current.porId.get(2)).toBe('Conectores Brasil Ltda');
  });
});
