export type CriptografiaSMTP = 'NENHUMA' | 'STARTTLS' | 'TLS';

/** GET /configuracoes/smtp — a senha nunca vem; só se há uma gravada. */
export interface ConfiguracaoSMTP {
  habilitado: boolean;
  host: string;
  porta: number;
  criptografia: CriptografiaSMTP;
  usuario: string;
  senha_definida: boolean;
  remetente_email: string;
  remetente_nome: string;
  updated_at: string;
  updated_by?: string;
}

/** Corpo do PUT. `senha` vazia mantém a gravada; `remover_senha` a apaga. */
export interface CorpoAtualizarSMTP {
  habilitado: boolean;
  host: string;
  porta: number;
  criptografia: CriptografiaSMTP;
  usuario: string;
  senha: string;
  remover_senha: boolean;
  remetente_email: string;
  remetente_nome: string;
}
