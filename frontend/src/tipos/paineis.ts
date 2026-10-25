/**
 * Contrato dos paineis (dashboards) -- espelho dos JSON tags de
 * backend/internal/domain/painel/painel.go. Os numeros chegam agregados do
 * banco: a tela so desenha, nao soma nada.
 *
 * Percentuais vem de 0 a 100; lead times em dias. Os dois chegam `null`
 * quando nao ha dado no periodo (nenhum pedido concluido, nenhuma unidade
 * testada...), o que e diferente de zero.
 */

/** Um valor rotulado de grafico (uma barra, um mes, uma fatia). */
export interface Ponto {
  rotulo: string;
  valor: number;
}

/** Periodos oferecidos na tela (em dias); outro valor cai no padrao. */
export const PERIODOS_PAINEL = [30, 90, 180, 365] as const;
export type PeriodoPainel = (typeof PERIODOS_PAINEL)[number];
export const PERIODO_PADRAO: PeriodoPainel = 90;

export interface InicioProducao {
  ops_em_atraso: number;
  metrologia_a_vencer_30: number;
  ops_por_etapa: Ponto[];
}

export interface InicioCompras {
  pcs_a_receber: number;
  pcs_em_atraso: number;
}

export interface InicioEstoque {
  itens_criticos: number;
  lotes_a_vencer_30: number;
}

/** Notas lancadas que ainda nao deram entrada no estoque (rascunho ou conferida). */
export interface InicioNotas {
  pendentes: number;
}

export interface InicioVendas {
  em_producao: number;
  prontos_para_envio: number;
  entregues_hoje: number;
}

/** Painel inicial: cada bloco so vem para quem ve o modulo dele (omitempty). */
export interface PainelInicio {
  producao?: InicioProducao;
  compras?: InicioCompras;
  estoque?: InicioEstoque;
  notas?: InicioNotas;
  vendas?: InicioVendas;
}

export interface PainelCompras {
  em_aberto: number;
  valor_em_aberto: number;
  em_atraso: number;
  lead_time_medio_dias: number | null;
  recebido_no_prazo_pct: number | null;
  por_situacao: Ponto[];
  comprado_por_mes: Ponto[];
  atrasos_por_fornecedor: Ponto[];
  lead_time_por_fornecedor: Ponto[];
}

/** Sem `producao.custos`, valor_em_estoque vem null e top_valor_em_estoque nao vem. */
export interface PainelEstoque {
  valor_em_estoque: number | null;
  itens_criticos: number;
  notas_pendentes: number;
  lotes_vencidos: number;
  lotes_a_vencer_30: number;
  entradas_por_mes: Ponto[];
  notas_por_situacao: Ponto[];
  lotes_por_vencimento: Ponto[];
  top_valor_em_estoque?: Ponto[];
}

export interface PainelProducao {
  abertas: number;
  liberadas: number;
  concluidas_periodo: number;
  em_atraso: number;
  lead_time_medio_dias: number | null;
  horas_apontadas: number;
  por_etapa: Ponto[];
  concluidas_por_semana: Ponto[];
  horas_por_centro: Ponto[];
  atraso_por_produto: Ponto[];
}

export interface PainelVendas {
  carteira: number;
  em_atraso: number;
  entregue_periodo: number;
  otd_pct: number | null;
  por_situacao: Ponto[];
  entregue_por_mes: Ponto[];
  otd_por_mes: Ponto[];
  principais_clientes: Ponto[];
}

export interface PainelQualidade {
  testadas: number;
  aprovadas: number;
  reprovadas: number;
  taxa_aprovacao_pct: number | null;
  metrologia_vencida: number;
  metrologia_a_vencer_30: number;
  aprovacao_por_semana: Ponto[];
  reprovacoes_por_produto: Ponto[];
  metrologia_por_faixa: Ponto[];
}
