import { tokenAtual, useAutenticacao } from '@/store/autenticacao';
import axios, { type AxiosInstance } from 'axios';

/** Detalhe de validacao por campo, conforme o doc 3. */
export interface CampoInvalido {
  campo: string;
  mensagem: string;
}

/** Erro normalizado da API. Carrega o codigo do doc 3 e a mensagem legivel. */
export class ErroApi extends Error {
  constructor(
    message: string,
    readonly codigo: string,
    readonly status?: number,
    readonly detalhes?: CampoInvalido[],
  ) {
    super(message);
    this.name = 'ErroApi';
  }

  /** Erro de validacao tem detalhes por campo para marcar o formulario. */
  get ehValidacao(): boolean {
    return this.codigo === 'ERRO_VALIDACAO';
  }
}

interface EnvelopeErro {
  erro?: { codigo?: string; mensagem?: string; detalhes?: CampoInvalido[] };
}

export interface OpcoesCliente {
  baseURL: string;
  obterToken: () => string | null;
  /** Chamado quando a API rejeita o token de uma sessao ja iniciada. */
  aoExpirarSessao?: () => void;
}

/** Rotas em que um 401 significa "credenciais erradas", nao "sessao expirada". */
const ROTAS_PUBLICAS = ['/auth/login'];

export function criarClienteApi({ baseURL, obterToken, aoExpirarSessao }: OpcoesCliente): AxiosInstance {
  const cliente = axios.create({
    baseURL,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
  });

  cliente.interceptors.request.use((config) => {
    const token = obterToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  cliente.interceptors.response.use(
    (resposta) => resposta,
    (erro: unknown) => Promise.reject(normalizar(erro, aoExpirarSessao)),
  );

  return cliente;
}

function normalizar(erro: unknown, aoExpirarSessao?: () => void): ErroApi {
  if (!axios.isAxiosError(erro)) {
    return new ErroApi('Erro inesperado na aplicacao', 'ERRO_INTERNO');
  }

  const resposta = erro.response;
  if (!resposta) {
    return new ErroApi(
      'Nao foi possivel conectar ao servidor. Verifique sua rede e tente novamente.',
      'INDISPONIVEL',
    );
  }

  const envelope = resposta.data as EnvelopeErro | undefined;
  const detalhe = envelope?.erro;

  const rota = erro.config?.url ?? '';
  const ehRotaPublica = ROTAS_PUBLICAS.some((publica) => rota.includes(publica));
  if (resposta.status === 401 && !ehRotaPublica) {
    aoExpirarSessao?.();
  }

  return new ErroApi(
    detalhe?.mensagem ?? 'Nao foi possivel concluir a operacao.',
    detalhe?.codigo ?? 'ERRO_INTERNO',
    resposta.status,
    detalhe?.detalhes,
  );
}

/**
 * Cliente unico da aplicacao. A sessao expirada derruba o usuario para o
 * login com o motivo registrado.
 */
export const api = criarClienteApi({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  obterToken: () => tokenAtual(),
  aoExpirarSessao: () => useAutenticacao.getState().sair('expirada'),
});
