export type MetodoCusteio = 'CMP' | 'PEPS' | 'UPC';

/** Corpo de PUT /configuracoes/negocio — sempre a configuração inteira. */
export interface DadosNegocio {
  metodo_custeio: MetodoCusteio;
  /** Percentual com até 2 casas (5.25 = 5,25%). */
  tolerancia_excesso_recebimento_pct: number;
  lead_time_padrao_dias: number;
  /** Nulo = o Gestor emite pedido de compra de qualquer valor. */
  limite_emissao_gestor: number | null;
  /** 0 = regra desligada. */
  cotacoes_minimas: number;
  valor_exige_cotacoes: number;
  /** Divergencia de preco NF x PC tolerada, em % (v1.2). */
  tolerancia_preco_pct: number;
  /** Acima da tolerancia: BLOQUEAR a efetivacao ou exigir APROVAR (permissao propria). */
  divergencia_preco_acao: AcaoDivergenciaPreco;
}

export type AcaoDivergenciaPreco = 'BLOQUEAR' | 'APROVAR';

export interface ConfiguracaoNegocio extends DadosNegocio {
  updated_at: string;
  updated_by?: string;
}
