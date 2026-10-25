export type OperacaoAuditoria = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RegistroAuditoria {
  id: number;
  tabela: string;
  operacao: OperacaoAuditoria;
  registro_id?: number;
  dados_antigos?: Record<string, unknown>;
  dados_novos?: Record<string, unknown>;
  usuario_id?: number;
  usuario_nome?: string;
  data_hora: string;
  endereco_ip?: string;
}

/** `data_inicio`/`data_fim` no formato AAAA-MM-DD (mesmo contrato do backend). */
export interface FiltrosAuditoria {
  pagina: number;
  limite: number;
  data_inicio?: string;
  data_fim?: string;
  usuario_id?: number;
  tabela?: string;
  operacao?: string;
}
