/** Contrato de POST /importacao (espelho de backend/internal/importacao). */
export interface ErroImportacao {
  aba: string;
  linha: number;
  coluna?: string;
  mensagem: string;
}

export interface ResumoAbaImportacao {
  aba: string;
  lidas: number;
  importadas: number;
  /** Registro que ja existia no sistema e foi mantido como estava. */
  ignoradas: number;
}

export interface ResultadoImportacao {
  /** true so quando nao houve erro e tudo foi gravado. */
  importado: boolean;
  resumo: ResumoAbaImportacao[];
  erros: ErroImportacao[];
}
