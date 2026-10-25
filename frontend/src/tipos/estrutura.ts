export interface ItemEstrutura {
  id: number;
  parte_peca_id: number;
  quantidade: number;
}

export interface Estrutura {
  id: number;
  produto_acabado_id: number;
  versao: number;
  data_vigencia_inicio: string;
  /** Ausente enquanto a versao esta ativa (omitempty no backend). */
  data_vigencia_fim?: string;
  ativo: boolean;
  itens: ItemEstrutura[];
  created_at: string;
  updated_at: string;
}

export interface CorpoCriarEstrutura {
  produto_acabado_id: number;
  data_vigencia_inicio: string;
  data_vigencia_fim?: string;
  itens: { parte_peca_id: number; quantidade: number }[];
}

export interface CorpoVersionarEstrutura {
  data_vigencia_inicio: string;
  data_vigencia_fim?: string;
  itens: { parte_peca_id: number; quantidade: number }[];
}
