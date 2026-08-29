import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { useMutacoesCadastro } from './useMutacoesCadastro';

function envolver({ children }: { children: ReactNode }) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

const mensagens = {
  criado: 'Fornecedor cadastrado',
  atualizado: 'Fornecedor atualizado',
  inativado: 'Fornecedor inativado',
};

const fornecedor = { id: 1, razao_social: 'Componentes Eletronicos LTDA' };

describe('useMutacoesCadastro', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    useToasts.setState({ itens: [] });
  });

  it('criar avisa com o verbo no passado', async () => {
    servidor.responder([
      { metodo: 'post', url: '/fornecedores', status: 201, corpo: { sucesso: true, dados: fornecedor } },
    ]);
    const { result } = renderHook(() => useMutacoesCadastro('fornecedores', mensagens), {
      wrapper: envolver,
    });

    result.current.criar.mutate({ razao_social: 'Componentes Eletronicos LTDA' });

    await waitFor(() => expect(result.current.criar.isSuccess).toBe(true));
    expect(useToasts.getState().itens[0].mensagem).toBe('Fornecedor cadastrado');
  });

  it('atualizar usa PUT no id e avisa', async () => {
    servidor.responder([
      { metodo: 'put', url: '/fornecedores/1', status: 200, corpo: { sucesso: true, dados: fornecedor } },
    ]);
    const { result } = renderHook(() => useMutacoesCadastro('fornecedores', mensagens), {
      wrapper: envolver,
    });

    result.current.atualizar.mutate({ id: 1, corpo: { razao_social: 'Outra' } });

    await waitFor(() => expect(result.current.atualizar.isSuccess).toBe(true));
    expect(servidor.requisicoes[0].url).toBe('/fornecedores/1');
    expect(useToasts.getState().itens[0].mensagem).toBe('Fornecedor atualizado');
  });

  it('inativar avisa com o verbo no passado', async () => {
    servidor.responder([{ metodo: 'delete', url: '/fornecedores/1', status: 204 }]);
    const { result } = renderHook(() => useMutacoesCadastro('fornecedores', mensagens), {
      wrapper: envolver,
    });

    result.current.inativar.mutate(1);

    await waitFor(() => expect(result.current.inativar.isSuccess).toBe(true));
    expect(useToasts.getState().itens[0].mensagem).toBe('Fornecedor inativado');
  });

  it('falha nao dispara aviso de sucesso e deixa o erro disponivel', async () => {
    servidor.responder([
      {
        metodo: 'post',
        url: '/fornecedores',
        status: 409,
        corpo: {
          sucesso: false,
          erro: { codigo: 'CONFLITO', mensagem: 'ja existe um fornecedor com este CNPJ' },
        },
      },
    ]);
    const { result } = renderHook(() => useMutacoesCadastro('fornecedores', mensagens), {
      wrapper: envolver,
    });

    result.current.criar.mutate({});

    await waitFor(() => expect(result.current.criar.isError).toBe(true));
    expect(useToasts.getState().itens).toHaveLength(0);
    expect(result.current.criar.error).toMatchObject({ codigo: 'CONFLITO' });
  });
});
