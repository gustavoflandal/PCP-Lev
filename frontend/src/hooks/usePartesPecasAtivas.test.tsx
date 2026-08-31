import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { usePartesPecasAtivas } from './usePartesPecasAtivas';

function envolver({ children }: { children: ReactNode }) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

describe('usePartesPecasAtivas', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    servidor.responder([
      {
        metodo: 'get',
        url: '/partes-pecas',
        status: 200,
        corpo: {
          sucesso: true,
          dados: [
            { id: 1, codigo: 'RES-10K', descricao: 'Resistor', ativo: true },
            { id: 2, codigo: 'CAP-100N', descricao: 'Capacitor', ativo: true },
          ],
          paginacao: { pagina: 1, limite: 200, total: 2, total_paginas: 1 },
        },
      },
    ]);
  });

  it('busca so partes/pecas ativas, ate 200', async () => {
    renderHook(() => usePartesPecasAtivas(), { wrapper: envolver });

    await waitFor(() => expect(servidor.requisicoes).toHaveLength(1));
    expect(servidor.requisicoes[0].params).toMatchObject({ filtro_ativo: true, limite: 200 });
  });

  it('monta as opcoes de selecao com codigo e descricao', async () => {
    const { result } = renderHook(() => usePartesPecasAtivas(), { wrapper: envolver });

    await waitFor(() => expect(result.current.opcoes).toHaveLength(2));
    expect(result.current.opcoes[0]).toEqual({ valor: '1', rotulo: 'RES-10K — Resistor' });
  });

  it('monta o mapa id -> codigo para exibicao em listas', async () => {
    const { result } = renderHook(() => usePartesPecasAtivas(), { wrapper: envolver });

    await waitFor(() => expect(result.current.porId.size).toBe(2));
    expect(result.current.porId.get(2)).toBe('CAP-100N');
  });
});
