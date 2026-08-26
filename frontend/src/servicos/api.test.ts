import { describe, expect, it, vi } from 'vitest';
import { criarClienteApi, ErroApi } from './api';

/** Responde a requisicao sem tocar a rede, mantendo o axios real no caminho. */
function comResposta(status: number, data: unknown) {
  return async (config: { headers: unknown }) => {
    if (status >= 400) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const erro: any = new Error('erro http');
      erro.isAxiosError = true;
      // O axios real popula config no erro; o fixture precisa fazer o mesmo.
      erro.config = config;
      erro.response = { status, data, headers: {}, config };
      throw erro;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status, data, headers: {}, config } as any;
  };
}

describe('criarClienteApi', () => {
  it('envia o token da sessao no cabecalho Authorization', async () => {
    const cliente = criarClienteApi({ baseURL: '/api/v1', obterToken: () => 'token-abc' });
    let enviado: string | undefined;
    cliente.defaults.adapter = async (config) => {
      enviado = config.headers?.Authorization as string;
      return { status: 200, data: {}, headers: {}, config } as never;
    };

    await cliente.get('/produtos-acabados');

    expect(enviado).toBe('Bearer token-abc');
  });

  it('nao envia Authorization quando nao ha sessao', async () => {
    const cliente = criarClienteApi({ baseURL: '/api/v1', obterToken: () => null });
    let enviado: unknown;
    cliente.defaults.adapter = async (config) => {
      enviado = config.headers?.Authorization;
      return { status: 200, data: {}, headers: {}, config } as never;
    };

    await cliente.get('/produtos-acabados');

    expect(enviado).toBeUndefined();
  });

  it('traduz o envelope de erro do doc 3 em ErroApi legivel', async () => {
    const cliente = criarClienteApi({ baseURL: '/api/v1', obterToken: () => null });
    cliente.defaults.adapter = comResposta(409, {
      sucesso: false,
      erro: { codigo: 'CONFLITO', mensagem: 'Codigo VMS-01 ja cadastrado' },
    }) as never;

    const erro = await cliente.get('/produtos-acabados').catch((e) => e);

    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro.codigo).toBe('CONFLITO');
    expect(erro.message).toBe('Codigo VMS-01 ja cadastrado');
    expect(erro.status).toBe(409);
  });

  it('preserva os detalhes de validacao por campo', async () => {
    const cliente = criarClienteApi({ baseURL: '/api/v1', obterToken: () => null });
    cliente.defaults.adapter = comResposta(400, {
      sucesso: false,
      erro: {
        codigo: 'ERRO_VALIDACAO',
        mensagem: 'Dados invalidos',
        detalhes: [{ campo: 'codigo', mensagem: 'Campo obrigatorio' }],
      },
    }) as never;

    const erro = await cliente.get('/produtos-acabados').catch((e) => e);

    expect(erro.detalhes).toEqual([{ campo: 'codigo', mensagem: 'Campo obrigatorio' }]);
  });

  it('avisa a aplicacao quando a sessao expira, para levar ao login', async () => {
    const aoExpirarSessao = vi.fn();
    const cliente = criarClienteApi({
      baseURL: '/api/v1',
      obterToken: () => 'token-vencido',
      aoExpirarSessao,
    });
    cliente.defaults.adapter = comResposta(401, {
      sucesso: false,
      erro: { codigo: 'NAO_AUTORIZADO', mensagem: 'Sessao expirada, faca login novamente' },
    }) as never;

    await cliente.get('/auth/eu').catch(() => undefined);

    expect(aoExpirarSessao).toHaveBeenCalledOnce();
  });

  it('nao trata o 401 do proprio login como sessao expirada', async () => {
    const aoExpirarSessao = vi.fn();
    const cliente = criarClienteApi({
      baseURL: '/api/v1',
      obterToken: () => null,
      aoExpirarSessao,
    });
    cliente.defaults.adapter = comResposta(401, {
      sucesso: false,
      erro: { codigo: 'NAO_AUTORIZADO', mensagem: 'Usuario ou senha invalidos' },
    }) as never;

    await cliente.post('/auth/login', {}).catch(() => undefined);

    expect(aoExpirarSessao).not.toHaveBeenCalled();
  });

  it('descreve a falha de rede sem expor detalhe tecnico', async () => {
    const cliente = criarClienteApi({ baseURL: '/api/v1', obterToken: () => null });
    cliente.defaults.adapter = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const erro: any = new Error('Network Error');
      erro.isAxiosError = true;
      throw erro;
    };

    const erro = await cliente.get('/saude').catch((e) => e);

    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro.message).toContain('conectar');
  });
});
