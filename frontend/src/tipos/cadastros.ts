import type { FlagsControle } from './arquivos';

/** Recursos de cadastro da API. Tambem serve de chave de cache no TanStack Query. */
export type Recurso =
  | 'produtos-acabados'
  | 'partes-pecas'
  | 'fornecedores'
  | 'clientes'
  | 'centros-trabalho';

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
  /**
   * Filtros proprios de cada recurso (`tipo` em clientes, `etapa` em centros
   * de trabalho). So entram aqui chaves que o handler daquele recurso aceita.
   */
  filtros?: Record<string, string>;
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

export interface EstruturaResumo {
  versao: number;
  data_vigencia_inicio: string;
}

export interface ProdutoAcabado extends RegistroCadastro, Partial<FlagsControle> {
  codigo: string;
  descricao: string;
  unidade_medida: string;
  preco_venda: number;
  lead_time_producao: number;
  /** Radar sujeito ao Inmetro (metrologia por unidade). */
  exige_metrologia?: boolean;
  /** Ausente quando o produto ainda nao tem BOM cadastrada. */
  estrutura_ativa?: EstruturaResumo;
  /** Miniatura assinada da foto principal (5 min); ausente sem foto. */
  foto_url?: string;
}

export interface PartePeca extends RegistroCadastro, Partial<FlagsControle> {
  codigo: string;
  descricao: string;
  unidade_medida: string;
  estoque_minimo: number;
  estoque_maximo: number;
  /** Ausente no JSON quando nao ha fornecedor padrao (omitempty no backend). */
  fornecedor_padrao_id?: number | null;
  lead_time_compra: number;
  /** Dias minimos de validade restante aceitos no recebimento (0-3650). */
  validade_minima_dias?: number;
  /** Expressao regular do numero de serie (o backend ancora com ^...$). */
  mascara_serie?: string;
  /** Miniatura assinada da foto principal (5 min); ausente sem foto. */
  foto_url?: string;
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

export type TipoCliente = 'ORGAO_PUBLICO' | 'CONCESSIONARIA' | 'INTEGRADOR' | 'OUTRO';

export const ROTULO_TIPO_CLIENTE: Record<TipoCliente, string> = {
  ORGAO_PUBLICO: 'Órgão público',
  CONCESSIONARIA: 'Concessionária',
  INTEGRADOR: 'Integrador',
  OUTRO: 'Outro',
};

export const OPCOES_TIPO_CLIENTE = (Object.keys(ROTULO_TIPO_CLIENTE) as TipoCliente[]).map((tipo) => ({
  valor: tipo,
  rotulo: ROTULO_TIPO_CLIENTE[tipo],
}));

export interface Cliente extends RegistroCadastro {
  tipo: TipoCliente;
  razao_social: string;
  nome_fantasia: string;
  /** Somente digitos, como o backend persiste. A tela formata para exibir. */
  cnpj: string;
  inscricao_estadual: string;
  contato_nome: string;
  contato_email: string;
  contato_telefone: string;
  endereco: string;
  cidade: string;
  /** Sigla da UF ou '' quando nao informada. */
  uf: string;
  numero_contrato: string;
  /** AAAA-MM-DD; ausente ou null quando nao ha contrato com vigencia. */
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  condicao_pagamento: string;
  observacoes: string;
}

/** Etapas fixas do Kanban de producao (RN3). */
export type EtapaProducao = 'SEPARACAO' | 'MONTAGEM' | 'TESTES' | 'EXPEDICAO';

export const ROTULO_ETAPA: Record<EtapaProducao, string> = {
  SEPARACAO: 'Separação',
  MONTAGEM: 'Montagem',
  TESTES: 'Testes',
  EXPEDICAO: 'Expedição',
};

export const OPCOES_ETAPA = (Object.keys(ROTULO_ETAPA) as EtapaProducao[]).map((etapa) => ({
  valor: etapa,
  rotulo: ROTULO_ETAPA[etapa],
}));

export interface CentroTrabalho extends RegistroCadastro {
  codigo: string;
  nome: string;
  etapa: EtapaProducao;
  /** Horas produtivas por dia; null quando nao informada. */
  capacidade_horas_dia?: number | null;
  /** Custo por hora (R$) usado no custo real da OP; null quando nao informado. */
  custo_hora?: number | null;
  descricao: string;
}
