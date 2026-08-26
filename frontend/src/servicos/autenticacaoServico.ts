import { api } from './api';
import type { RespostaLogin } from '@/store/autenticacao';

export interface Credenciais {
  username: string;
  password: string;
}

/** POST /auth/login — a resposta vem sem envelope, conforme o doc 3. */
export async function autenticar(credenciais: Credenciais): Promise<RespostaLogin> {
  const { data } = await api.post<RespostaLogin>('/auth/login', credenciais);
  return data;
}
