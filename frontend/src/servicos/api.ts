import { t } from '@/i18n';
import { tokenAtual, useAutenticacao } from '@/store/autenticacao';
import { usePreferencias } from '@/store/preferencias';
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
  /** Chamado quando a API rejeita o token de uma sessao ja iniciada --
   * `desativado` quando o usuario foi bloqueado/inativado com ela aberta. */
  aoExpirarSessao?: (motivo: 'expirada' | 'desativado' | 'encerrada') => void;
  /** Chamado quando a API exige a troca da senha antes de qualquer operacao. */
  aoExigirTrocaDeSenha?: () => void;
}

/** Rotas em que um 401 significa "credenciais erradas", nao "sessao expirada"
 * (na troca de senha, a senha atual digitada errada). */
const ROTAS_DE_CREDENCIAL = ['/auth/login', '/auth/trocar-senha'];

export function criarClienteApi({ baseURL, obterToken, aoExpirarSessao, aoExigirTrocaDeSenha }: OpcoesCliente): AxiosInstance {
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
    // A API responde (erros e validacoes) no idioma escolhido em Preferencias.
    config.headers['Accept-Language'] = usePreferencias.getState().preferencias.idioma;
    return config;
  });

  cliente.interceptors.response.use(
    (resposta) => resposta,
    (erro: unknown) => Promise.reject(normalizar(erro, aoExpirarSessao, aoExigirTrocaDeSenha)),
  );

  return cliente;
}

/** Codigo do backend (middleware.CodigoTrocaDeSenha). */
export const CODIGO_TROCA_DE_SENHA = 'TROCA_DE_SENHA_OBRIGATORIA';

/** Codigo do backend (middleware.CodigoUsuarioInativo). */
export const CODIGO_USUARIO_INATIVO = 'USUARIO_INATIVO';

/** Codigo do backend (middleware.CodigoSessaoEncerrada): a senha mudou depois
 * que este token foi emitido. */
export const CODIGO_SESSAO_ENCERRADA = 'SESSAO_ENCERRADA';

function normalizar(
  erro: unknown,
  aoExpirarSessao?: OpcoesCliente['aoExpirarSessao'],
  aoExigirTrocaDeSenha?: () => void,
): ErroApi {
  if (!axios.isAxiosError(erro)) {
    return new ErroApi(t('Erro inesperado na aplicacao'), 'ERRO_INTERNO');
  }

  const resposta = erro.response;
  if (!resposta) {
    return new ErroApi(
      t('Nao foi possivel conectar ao servidor. Verifique sua rede e tente novamente.'),
      'INDISPONIVEL',
    );
  }

  const envelope = resposta.data as EnvelopeErro | undefined;
  const detalhe = envelope?.erro;

  const rota = erro.config?.url ?? '';
  const ehRotaDeCredencial = ROTAS_DE_CREDENCIAL.some((r) => rota.includes(r));
  if (resposta.status === 401 && detalhe?.codigo === CODIGO_USUARIO_INATIVO) {
    aoExpirarSessao?.('desativado');
  } else if (resposta.status === 401 && detalhe?.codigo === CODIGO_SESSAO_ENCERRADA) {
    aoExpirarSessao?.('encerrada');
  } else if (resposta.status === 401 && !ehRotaDeCredencial) {
    aoExpirarSessao?.('expirada');
  }
  if (resposta.status === 403 && detalhe?.codigo === CODIGO_TROCA_DE_SENHA) {
    aoExigirTrocaDeSenha?.();
  }

  return new ErroApi(
    detalhe?.mensagem ?? t('Nao foi possivel concluir a operacao.'),
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
  aoExpirarSessao: (motivo) => useAutenticacao.getState().sair(motivo),
  aoExigirTrocaDeSenha: () => useAutenticacao.getState().definirTrocaDeSenha(true),
});
