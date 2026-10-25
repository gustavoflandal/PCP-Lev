import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { api } from '@/servicos/api';
import { useAutenticacao } from '@/store/autenticacao';

/** Renderiza com os provedores reais da aplicacao — sem repetir em cada teste. */
export function renderizarComProvedores(
  elemento: ReactElement,
  opcoes: { rota?: string; queryClient?: QueryClient } = {},
): RenderResult {
  // queryClient proprio: para simular um cache ja preenchido (dado antigo).
  const queryClient =
    opcoes.queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[opcoes.rota ?? '/']}>{elemento}</MemoryRouter>
    </QueryClientProvider>,
  );
}

export interface RotaFalsa {
  metodo: 'get' | 'post' | 'put' | 'delete';
  /** Trecho da URL (comparado com includes) ou expressao regular. */
  url: string | RegExp;
  status: number;
  corpo?: unknown;
}

export interface RequisicaoObservada {
  metodo: string;
  url: string;
  corpo: unknown;
  params: Record<string, unknown>;
}

export interface ServidorFalso {
  /** Requisicoes ja feitas, na ordem, para assercao no teste. */
  requisicoes: RequisicaoObservada[];
  /** Define (ou redefine) as rotas atendidas. */
  responder: (rotas: RotaFalsa[]) => void;
}

function combina(padrao: string | RegExp, url: string): boolean {
  return typeof padrao === 'string' ? url.includes(padrao) : padrao.test(url);
}

/**
 * Troca apenas o transporte do axios: servico, store, formulario e componentes
 * seguem reais. Uma rota nao declarada responde 404 com mensagem explicita,
 * para que o teste acuse a chamada esquecida em vez de travar em "carregando".
 */
export function instalarServidorFalso(): ServidorFalso {
  let rotas: RotaFalsa[] = [];
  const requisicoes: RequisicaoObservada[] = [];

  api.defaults.adapter = async (config) => {
    const metodo = (config.method ?? 'get').toLowerCase();
    const url = config.url ?? '';
    requisicoes.push({
      metodo,
      url,
      corpo: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
      params: (config.params ?? {}) as Record<string, unknown>,
    });

    // A rota mais especifica ganha: "/fornecedores/1" antes de "/fornecedores".
    const rota = rotas
      .filter((candidata) => candidata.metodo === metodo && combina(candidata.url, url))
      .sort((a, b) => String(b.url).length - String(a.url).length)[0];

    const resposta = rota ?? {
      status: 404,
      corpo: {
        sucesso: false,
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: `sem rota falsa para ${metodo} ${url}` },
      },
    };

    if (resposta.status >= 400) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const erro: any = new Error('erro http');
      erro.isAxiosError = true;
      erro.config = config;
      erro.response = { status: resposta.status, data: resposta.corpo, headers: {}, config };
      throw erro;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: resposta.status, data: resposta.corpo, headers: {}, config } as any;
  };

  return {
    requisicoes,
    responder: (novas) => {
      rotas = novas;
    },
  };
}

/**
 * Abre uma sessao com o perfil informado e as permissoes semeadas dele
 * (setup.ts completa as permissoes). Para telas cujo comportamento depende
 * do que o usuario pode fazer.
 */
export function entrarComoPerfil(perfil: string): void {
  useAutenticacao.getState().entrar({
    access_token: 'token-teste',
    token_type: 'Bearer',
    expires_in: 28800,
    usuario: {
      id: 1, username: 'teste', nome: 'Usuário de Teste', perfil,
      tema: 'automatico', alto_contraste: false, densidade: 'compacta', tamanho_fonte: 'padrao',
    },
  });
}
