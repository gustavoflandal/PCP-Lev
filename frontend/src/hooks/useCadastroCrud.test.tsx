import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { useCadastroCrud } from './useCadastroCrud';

function envolver({ children }: { children: ReactNode }) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

interface ItemTeste {
  id: number;
  nome: string;
}

const mensagens = {
  criado: 'Item cadastrado',
  atualizado: 'Item atualizado',
  inativado: 'Item inativado',
};

const item: ItemTeste = { id: 1, nome: 'Item um' };

function montar() {
  return renderHook(() => useCadastroCrud<ItemTeste>('fornecedores', mensagens), {
    wrapper: envolver,
  });
}

describe('useCadastroCrud', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    useToasts.setState({ itens: [] });
  });

  it('comeca com o formulario fechado e sem registro em edicao', () => {
    const { result } = montar();

    expect(result.current.formularioAberto).toBe(false);
    expect(result.current.emEdicao).toBeNull();
  });

  it('abrirNovo abre o formulario sem registro em edicao', () => {
    const { result } = montar();

    act(() => result.current.abrirNovo());

    expect(result.current.formularioAberto).toBe(true);
    expect(result.current.emEdicao).toBeNull();
  });

  it('abrirEdicao abre o formulario com o registro', () => {
    const { result } = montar();

    act(() => result.current.abrirEdicao(item));

    expect(result.current.formularioAberto).toBe(true);
    expect(result.current.emEdicao).toEqual(item);
  });

  it('fecharFormulario fecha e limpa o registro em edicao', () => {
    const { result } = montar();
    act(() => result.current.abrirEdicao(item));

    act(() => result.current.fecharFormulario());

    expect(result.current.formularioAberto).toBe(false);
    expect(result.current.emEdicao).toBeNull();
  });

  it('salvar sem emEdicao faz POST; com emEdicao faz PUT no id', async () => {
    servidor.responder([
      { metodo: 'post', url: '/fornecedores', status: 201, corpo: { sucesso: true, dados: item } },
    ]);
    const { result } = montar();

    result.current.salvar({ nome: 'Novo item' });

    await waitFor(() => expect(servidor.requisicoes.some((r) => r.metodo === 'post')).toBe(true));

    servidor.responder([
      { metodo: 'put', url: '/fornecedores/1', status: 200, corpo: { sucesso: true, dados: item } },
    ]);
    act(() => result.current.abrirEdicao(item));
    result.current.salvar({ nome: 'Item editado' });

    await waitFor(() =>
      expect(
        servidor.requisicoes.some((r) => r.metodo === 'put' && r.url === '/fornecedores/1'),
      ).toBe(true),
    );
  });

  it('sucesso do salvar fecha o formulario sozinho', async () => {
    servidor.responder([
      { metodo: 'post', url: '/fornecedores', status: 201, corpo: { sucesso: true, dados: item } },
    ]);
    const { result } = montar();
    act(() => result.current.abrirNovo());
    expect(result.current.formularioAberto).toBe(true);

    result.current.salvar({ nome: 'Novo item' });

    await waitFor(() => expect(result.current.formularioAberto).toBe(false));
  });

  it('pedirInativacao guarda o item sem chamar a API', () => {
    const { result } = montar();

    act(() => result.current.pedirInativacao(item));

    expect(result.current.aInativar).toEqual(item);
    expect(servidor.requisicoes).toHaveLength(0);
  });

  it('confirmarInativacao chama DELETE e limpa aInativar no sucesso', async () => {
    servidor.responder([{ metodo: 'delete', url: '/fornecedores/1', status: 204 }]);
    const { result } = montar();
    act(() => result.current.pedirInativacao(item));

    result.current.confirmarInativacao();

    await waitFor(() => expect(result.current.aInativar).toBeNull());
    expect(
      servidor.requisicoes.some((r) => r.metodo === 'delete' && r.url === '/fornecedores/1'),
    ).toBe(true);
  });

  it('erro 400 com detalhes preenche errosPorCampo e deixa erroGeral nulo', async () => {
    servidor.responder([
      {
        metodo: 'post',
        url: '/fornecedores',
        status: 400,
        corpo: {
          sucesso: false,
          erro: {
            codigo: 'ERRO_VALIDACAO',
            mensagem: 'Dados invalidos',
            detalhes: [{ campo: 'nome', mensagem: 'Campo obrigatorio' }],
          },
        },
      },
    ]);
    const { result } = montar();
    act(() => result.current.abrirNovo());

    result.current.salvar({});

    await waitFor(() => expect(result.current.errosPorCampo.nome).toBe('Campo obrigatorio'));
    expect(result.current.erroGeral).toBeNull();
  });

  it('erro 409 preenche erroGeral e mantem o formulario aberto', async () => {
    servidor.responder([
      {
        metodo: 'post',
        url: '/fornecedores',
        status: 409,
        corpo: {
          sucesso: false,
          erro: { codigo: 'CONFLITO', mensagem: 'ja existe um item com este nome' },
        },
      },
    ]);
    const { result } = montar();
    act(() => result.current.abrirNovo());

    result.current.salvar({});

    await waitFor(() => expect(result.current.erroGeral).toBe('ja existe um item com este nome'));
    expect(result.current.formularioAberto).toBe(true);
  });
});
