export type FormatoData = 'DD/MM/AAAA' | 'DD-MM-AAAA' | 'AAAA-MM-DD';
export type FormatoHora = '24H' | '12H';

export interface ConfiguracaoRegional {
  formato_data: FormatoData;
  formato_hora: FormatoHora;
  updated_at: string;
  updated_by?: string;
}

/** Corpo de PUT /configuracoes/regional — sempre a configuração inteira de novo. */
export type CorpoAtualizarRegional = Pick<ConfiguracaoRegional, 'formato_data' | 'formato_hora'>;
