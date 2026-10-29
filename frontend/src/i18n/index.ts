import { useSyncExternalStore } from 'react';
import { usePreferencias, type Idioma } from '@/store/preferencias';
import es from './es';

/**
 * Internacionalizacao: o portugues e o idioma de origem e funciona como
 * chave -- chamar t com o texto "Salvar" devolve "Guardar" em espanhol e o proprio texto em
 * portugues. Sem traducao cadastrada, o texto sai em portugues (nunca vazio).
 *
 * Regras de uso (um teste varre o codigo e reprova o descumprimento):
 * - o primeiro argumento de `t()`/`marcar()` e sempre um literal (aspas ou
 *   template sem `${}`): valores variaveis entram por `{nome}` e `params`;
 * - `t()` nao roda na carga do modulo (o idioma ainda pode mudar): constantes
 *   de modulo guardam o texto com `marcar()` e quem renderiza chama `t(valor)`;
 * - texto que so se conhece em execucao (vindo da API, de um enum) usa `td()`
 *   e suas traducoes entram no dicionario do mesmo jeito.
 */
export type { Idioma };

export const IDIOMAS: { valor: Idioma; rotulo: string }[] = [
  { valor: 'pt-BR', rotulo: 'Português (Brasil)' },
  { valor: 'es', rotulo: 'Español' },
];

type Parametros = Record<string, string | number>;

const dicionarios: Record<Idioma, Record<string, string>> = { 'pt-BR': {}, es };

/** Idioma em uso agora (le a store sem assinar -- para codigo fora de componentes). */
export function idiomaAtual(): Idioma {
  return usePreferencias.getState().preferencias.idioma;
}

function interpolar(texto: string, params?: Parametros): string {
  if (!params) return texto;
  return texto.replace(/\{(\w+)\}/g, (original, nome: string) => (nome in params ? String(params[nome]) : original));
}

function traduzir(chave: string, params?: Parametros): string {
  return interpolar(dicionarios[idiomaAtual()][chave] ?? chave, params);
}

/** Traduz um texto conhecido em tempo de escrita do codigo. */
export function t(chave: string, params?: Parametros): string {
  return traduzir(chave, params);
}

/** Traduz um texto so conhecido em execucao (API, enum). Sem traducao, devolve o original. */
export function td(texto: string | null | undefined): string {
  return texto ? traduzir(texto) : '';
}

/** Identidade: marca um texto para o dicionario sem traduzi-lo agora (constantes de modulo). */
export function marcar(chave: string): string {
  return chave;
}

/** Faz o componente renderizar de novo quando o idioma muda; devolve o idioma. */
export function useIdioma(): Idioma {
  return useSyncExternalStore(usePreferencias.subscribe, idiomaAtual);
}
