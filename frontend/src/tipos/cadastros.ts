/** Recursos de cadastro da API. Tambem serve de chave de cache no TanStack Query. */
export type Recurso = 'produtos-acabados' | 'partes-pecas' | 'fornecedores';

export type Ordem = 'asc' | 'desc';

/**
 * Espelha exatamente o que `consulta.Analisar` aceita no backend. Nenhum outro
 * parametro deve ser enviado: `ordenar_por` fora da lista permitida vira 400.
 */
export interface ParametrosListagem {
  pagina: number;
  limite: number;
  ordenar_por: string;
  ordem: Ordem;
  busca: string;
  /** null significa "sem filtro": traz ativos e inativos. */
  filtro_ativo: boolean | null;
}

export interface DadosPaginacao {
  pagina: number;
  limite: number;
  total: number;
  total_paginas: number;
}

export interface Pagina<T> {
  itens: T[];
  paginacao: DadosPaginacao;
}

/** Campos que todo cadastro base carrega. */
export interface RegistroCadastro {
  id: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProdutoAcabado extends RegistroCadastro {
  codigo: string;
  descricao: string;
  unidade_medida: string;
  preco_venda: number;
  lead_time_producao: number;
}

export interface PartePeca extends RegistroCadastro {
  codigo: string;
  descricao: string;
  unidade_medida: string;
  estoque_minimo: number;
  estoque_maximo: number;
  /** Ausente no JSON quando nao ha fornecedor padrao (omitempty no backend). */
  fornecedor_padrao_id?: number | null;
  lead_time_compra: number;
}

export interface Fornecedor extends RegistroCadastro {
  razao_social: string;
  /** Somente digitos, como o backend persiste. A tela formata para exibir. */
  cnpj: string;
  contato_nome: string;
  contato_email: string;
  contato_telefone: string;
  endereco: string;
  lead_time_medio: number;
  condicao_pagamento: string;
}
