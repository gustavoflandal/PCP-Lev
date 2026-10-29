import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import es from './es';

const RAIZ = join(__dirname, '..');

function arquivosDeCodigo(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      return caminho.includes(join('i18n', 'es')) || nome === 'testes' ? [] : arquivosDeCodigo(caminho);
    }
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

// t('...'), t("..."), t(`...`) e marcar(...), com o literal inteiro (aspas escapadas incluidas).
const CHAMADA = /\b(?:t|marcar)\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/g;
// t(`... ${x} ...`): chave dinamica, que o dicionario nunca cobriria.
const CHAVE_DINAMICA = /\b(?:t|marcar)\(\s*`[^`]*\$\{/;

function desescapar(literal: string): string {
  return literal.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
}

const placeholders = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function chavesUsadas(): Map<string, string> {
  const usadas = new Map<string, string>();
  for (const arquivo of arquivosDeCodigo(RAIZ)) {
    const fonte = readFileSync(arquivo, 'utf-8');
    for (const m of fonte.matchAll(CHAMADA)) {
      const chave = desescapar(m[1] ?? m[2] ?? m[3]);
      if (/[a-zA-ZÀ-ÿ]/.test(chave)) usadas.set(chave, arquivo.replace(RAIZ, 'src'));
    }
  }
  return usadas;
}

describe('internacionalizacao (espanhol)', () => {
  const usadas = chavesUsadas();

  it('todo texto passado a t() tem traducao em espanhol', () => {
    const faltam = [...usadas].filter(([chave]) => !es[chave]).map(([chave, arq]) => `${arq}: ${chave}`);
    expect(faltam, `${faltam.length} texto(s) sem traducao:\n${faltam.slice(0, 40).join('\n')}`).toEqual([]);
  });

  it('a traducao mantem os mesmos {parametros} do original', () => {
    const divergentes = Object.entries(es)
      .filter(([chave, trad]) => placeholders(chave).join() !== placeholders(trad).join())
      .map(([chave]) => chave);
    expect(divergentes).toEqual([]);
  });

  it('nenhuma traducao esta vazia', () => {
    expect(Object.entries(es).filter(([, trad]) => !trad.trim()).map(([chave]) => chave)).toEqual([]);
  });

  it('t() nao recebe template com ${} (a chave nao seria encontrada)', () => {
    const ruins = arquivosDeCodigo(RAIZ).filter((a) => CHAVE_DINAMICA.test(readFileSync(a, 'utf-8')));
    expect(ruins.map((a) => a.replace(RAIZ, 'src'))).toEqual([]);
  });
});
