import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import type { Fornecedor } from '@/tipos/cadastros';
import { useListagem } from './useListagem';

function envolver({ children }: { children: ReactNode }) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

const paginaVazia = {
  sucesso: true,
  dados: [],
  paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 },
};

describe('useListagem', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    servidor.responder([{ metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaVazia }]);
  });

  it('comeca na pagina 1, ordenado pela coluna padrao e so com ativos', async () => {
    const { result } = renderHook(() => useListagem<Fornecedor>('fornecedores', 'razao_social'), {
      wrapper: envolver,
    });

    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.pagina).toBe(1);
    expect(result.current.ordenarPor).toBe('razao_social');
    expect(result.current.ordem).toBe('asc');
    expect(result.current.filtroAtivo).toBe(true);
    expect(servidor.requisicoes[0].params).toMatchObject({ filtro_ativo: true });
  });

  it('clicar na mesma coluna inverte a ordem', async () => {
    const { result } = renderHook(() => useListagem<Fornecedor>('fornecedores', 'razao_social'), {
      wrapper: envolver,
    });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    act(() => result.current.alternarOrdenacao('razao_social'));

    expect(result.current.ordem).toBe('desc');
  });

  it('clicar em outra coluna ordena por ela em ordem crescente', async () => {
    const { result } = renderHook(() => useListagem<Fornecedor>('fornecedores', 'razao_social'), {
      wrapper: envolver,
    });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    act(() => result.current.alternarOrdenacao('razao_social'));
    act(() => result.current.alternarOrdenacao('cnpj'));

    expect(result.current.ordenarPor).toBe('cnpj');
    expect(result.current.ordem).toBe('asc');
  });

  it('mudar o filtro de situacao volta para a primeira pagina', async () => {
    const { result } = renderHook(() => useListagem<Fornecedor>('fornecedores', 'razao_social'), {
      wrapper: envolver,
    });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    act(() => result.current.definirPagina(3));
    expect(result.current.pagina).toBe(3);

    act(() => result.current.definirFiltroAtivo(null));

    await waitFor(() => expect(result.current.pagina).toBe(1));
  });

  it('falha na listagem vira mensagem legivel, nao stack trace', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/fornecedores',
        status: 500,
        corpo: {
          sucesso: false,
          erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' },
        },
      },
    ]);

    const { result } = renderHook(() => useListagem<Fornecedor>('fornecedores', 'razao_social'), {
      wrapper: envolver,
    });

    await waitFor(() => expect(result.current.erro).toBe('Erro interno do servidor'));
  });
});
