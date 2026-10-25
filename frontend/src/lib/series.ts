/** Ferramentas da entrada de numeros de serie (recebimento e ajuste de estoque). */

/** Teto da faixa gerada de uma vez: evita travar a tela com um fim digitado errado. */
export const LIMITE_FAIXA = 5000;

/**
 * Gera a faixa sequencial "prefixo + numero", com zeros a esquerda quando o
 * inicio foi digitado com zeros (SN-0001 a SN-0050) ou na largura do fim.
 * Devolve null quando a faixa e invalida.
 */
export function gerarFaixa(prefixo: string, inicio: string, fim: string): string[] | null {
  if (!/^\d+$/.test(inicio) || !/^\d+$/.test(fim)) return null;
  const de = Number(inicio);
  const ate = Number(fim);
  if (ate < de || ate - de + 1 > LIMITE_FAIXA) return null;
  const largura = inicio.startsWith('0') || fim.startsWith('0') ? Math.max(inicio.length, fim.length) : 0;
  const lista: string[] = [];
  for (let n = de; n <= ate; n += 1) {
    lista.push(`${prefixo}${String(n).padStart(largura, '0')}`);
  }
  return lista;
}

/** Quebra o texto colado (uma serie por linha; virgula, ponto e virgula e tab tambem separam). */
export function separarLista(texto: string): string[] {
  return texto
    .split(/[\r\n,;\t]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}
