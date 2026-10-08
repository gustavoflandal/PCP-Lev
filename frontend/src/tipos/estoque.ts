import type { Ordem } from './cadastros';

export type StatusEstoque = 'OK' | 'CRITICO' | 'BLOQUEADO';

export interface SaldoEstoque {
  id: number;
  parte_peca_id: number;
  codigo: string;
  descricao: string;
  quantidade_atual: number;
  quantidade_reservada: number;
  disponivel: number;
  estoque_minimo: number;
  localizacao_armazem?: string;
  status: StatusEstoque;
  updated_at: string;
}

export interface Movimentacao {
  id: number;
  parte_peca_id: number;
  codigo_pp: string;
  tipo: 'Entrada' | 'Ajuste';
  quantidade: number;
  motivo: string;
  referencia_numero?: string;
  observacoes?: string;
  usuario?: string;
  data_hora: string;
}

/** Espelha o que o backend aceita em GET /estoque — mesma forma de
 * ParametrosListagemCompras, mas sem busca (a tela de estoque nao tem
 * campo de busca no design aprovado). */
export interface ParametrosListagemEstoque {
  pagina: number;
  limite: number;
  ordenar_por: string;
  ordem: Ordem;
  /** null significa "sem filtro": traz todos os status. */
  status: string | null;
}
