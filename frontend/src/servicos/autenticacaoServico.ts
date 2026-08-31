import { api } from './api';
import type { UsuarioSessao, RespostaLogin } from '@/store/autenticacao';
import type { Preferencias } from '@/store/preferencias';

export interface Credenciais {
  username: string;
  password: string;
}

/** POST /auth/login — a resposta vem sem envelope, conforme o doc 3. */
export async function autenticar(credenciais: Credenciais): Promise<RespostaLogin> {
  const { data } = await api.post<RespostaLogin>('/auth/login', credenciais);
  return data;
}

/** PUT /auth/preferencias — segue o envelope padrao (sucesso/dados). */
export async function atualizarPreferencias(preferencias: Preferencias): Promise<UsuarioSessao> {
  const { data } = await api.put<{ dados: UsuarioSessao }>('/auth/preferencias', preferencias);
  return data.dados;
}
