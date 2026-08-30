import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import type { Cotacao } from '@/tipos/compras';
import { useListagemCompras } from './useListagemCompras';

function envolver({ children }: { children: ReactNode }) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

const paginaVazia = {
  sucesso: true,
  dados: [],
  paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 },
};

describe('useListagemCompras', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    servidor.responder([{ metodo: 'get', url: '/cotacoes', status: 200, corpo: paginaVazia }]);
  });

  it('comeca na pagina 1, ordenado pela coluna padrao e sem filtro de status', async () => {
    const { result } = renderHook(() => useListagemCompras<Cotacao>('cotacoes', 'numero_cotacao'), {
      wrapper: envolver,
    });

    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.pagina).toBe(1);
    expect(result.current.ordenarPor).toBe('numero_cotacao');
    expect(result.current.ordem).toBe('asc');
    expect(result.current.status).toBeNull();
    expect(servidor.requisicoes[0].params).not.toHaveProperty('status');
  });

  it('clicar na mesma coluna inverte a ordem', async () => {
    const { result } = renderHook(() => useListagemCompras<Cotacao>('cotacoes', 'numero_cotacao'), {
      wrapper: envolver,
    });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    act(() => result.current.alternarOrdenacao('numero_cotacao'));

    expect(result.current.ordem).toBe('desc');
  });

  it('mudar o filtro de status volta para a primeira pagina e envia o status', async () => {
    const { result } = renderHook(() => useListagemCompras<Cotacao>('cotacoes', 'numero_cotacao'), {
      wrapper: envolver,
    });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    act(() => result.current.definirPagina(3));
    expect(result.current.pagina).toBe(3);

    act(() => result.current.definirStatus('Enviada'));

    await waitFor(() => expect(result.current.pagina).toBe(1));
    await waitFor(() => expect(servidor.requisicoes.at(-1)?.params).toMatchObject({ status: 'Enviada' }));
  });

  it('a busca e adiada antes de disparar a requisicao', async () => {
    const { result } = renderHook(() => useListagemCompras<Cotacao>('cotacoes', 'numero_cotacao'), {
      wrapper: envolver,
    });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    act(() => result.current.definirBusca('COT-2026'));

    expect(result.current.busca).toBe('COT-2026');
  });

  it('falha na listagem vira mensagem legivel, nao stack trace', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/cotacoes',
        status: 500,
        corpo: { sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' } },
      },
    ]);

    const { result } = renderHook(() => useListagemCompras<Cotacao>('cotacoes', 'numero_cotacao'), {
      wrapper: envolver,
    });

    await waitFor(() => expect(result.current.erro).toBe('Erro interno do servidor'));
  });
});
