export interface TabelaBanco {
  tabela: string;
  tamanho_bytes: number;
  /** Nulo quando o PostgreSQL ainda não tem estimativa para a tabela. */
  linhas_estimadas: number | null;
}

export interface PoolConexoes {
  em_uso: number;
  ociosas: number;
  total: number;
  maximo: number;
}

/** GET /configuracoes/banco — diagnóstico somente-leitura, nunca credenciais. */
export interface StatusBanco {
  conectado: boolean;
  latencia_ms: number;
  host: string;
  banco: string;
  versao: string;
  tamanho_bytes: number;
  maiores_tabelas: TabelaBanco[];
  pool: PoolConexoes;
  conexoes_ativas: number;
  ultimo_backup: string | null;
}

export interface TesteConexao {
  ok: boolean;
  latencia_ms: number;
}
