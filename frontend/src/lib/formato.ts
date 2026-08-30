const TAMANHO_CNPJ = 14;

const moedaBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Pontua o CNPJ para exibicao. O banco guarda so digitos, entao a pontuacao e
 * sempre derivada — nunca persistida.
 */
export function formatarCNPJ(cnpj: string): string {
  if (cnpj.length !== TAMANHO_CNPJ) {
    return cnpj;
  }
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export function formatarMoeda(valor: number): string {
  return moedaBR.format(valor);
}

/** Lead time em dias, com concordancia. */
export function formatarDias(dias: number): string {
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

/**
 * Converte a data do contrato da API (AAAA-MM-DD, ou um timestamp com essa
 * data na frente) para o formato de exibicao pt-BR. Ausente vira travessao —
 * o mesmo convite vazio usado no resto do sistema, nunca string vazia.
 */
export function formatarData(data: string | undefined): string {
  if (!data) {
    return '—';
  }
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}
