import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

export type Tema = 'claro' | 'escuro' | 'automatico';
export type Densidade = 'compacta' | 'confortavel';
export type TamanhoFonte = 'padrao' | 'grande' | 'extra-grande';
export type Idioma = 'pt-BR' | 'es';

export interface Preferencias {
  tema: Tema;
  alto_contraste: boolean;
  densidade: Densidade;
  tamanho_fonte: TamanhoFonte;
  /** Idioma da interface e das mensagens da API (cabecalho Accept-Language). */
  idioma: Idioma;
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  tema: 'automatico',
  alto_contraste: false,
  // 'compacta' preserva o visual de antes da Fase 4.1 (linha de 40px fixa);
  // ver o comentario da migration 009 no backend.
  densidade: 'compacta',
  tamanho_fonte: 'padrao',
  idioma: 'pt-BR',
};

const CHAVE_PREFERENCIAS = 'pcp.preferencias';

/** Resolve "automatico" para claro/escuro a partir da preferencia do SO —
 * mesma logica do script public/tema-inicial.js, que roda antes do React
 * montar (sem acesso a este modulo). */
export function resolverTema(tema: Tema, prefereEscuro: boolean): 'claro' | 'escuro' {
  if (tema === 'claro' || tema === 'escuro') return tema;
  return prefereEscuro ? 'escuro' : 'claro';
}

function prefereEscuroAgora(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Mesma normalizacao defensiva do script public/tema-inicial.js -- um valor
 * fora do conjunto conhecido (backend antigo, cache corrompido) cai no
 * padrao em vez de virar um atributo CSS que nenhum seletor reconhece. As
 * duas implementacoes existem em runtimes diferentes (HTML puro roda antes
 * do bundle carregar) e por isso nao podem compartilhar codigo, mas
 * precisam concordar em todo caso, nao so no caminho feliz. */
function aplicarNoDocumento(preferencias: Preferencias): void {
  const el = document.documentElement;
  el.setAttribute('data-tema', resolverTema(preferencias.tema, prefereEscuroAgora()));
  if (preferencias.alto_contraste) {
    el.setAttribute('data-alto-contraste', 'true');
  } else {
    el.removeAttribute('data-alto-contraste');
  }
  el.setAttribute('data-densidade', preferencias.densidade === 'confortavel' ? 'confortavel' : 'compacta');
  const fontesValidas: TamanhoFonte[] = ['padrao', 'grande', 'extra-grande'];
  el.setAttribute('data-fonte', fontesValidas.includes(preferencias.tamanho_fonte) ? preferencias.tamanho_fonte : 'padrao');
  el.setAttribute('lang', preferencias.idioma === 'es' ? 'es' : 'pt-BR');
}

/** Primeira visita, sem preferencia salva: segue o idioma do navegador. */
function idiomaDoNavegador(): Idioma {
  try {
    return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'pt-BR';
  } catch {
    return 'pt-BR';
  }
}

function salvarCache(preferencias: Preferencias): void {
  try {
    localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias));
  } catch {
    // Armazenamento indisponivel: a preferencia ainda vale para esta sessao,
    // so nao sobrevive a um F5 antes do backend confirmar de novo.
  }
}

/** Le o mesmo cache que o script public/tema-inicial.js ja aplicou no <html>
 * antes do React montar -- sem isso, um F5 com sessao ja aberta deixaria o
 * <html> com os atributos certos, mas o estado desta store (que a tela de
 * Preferencias le para marcar os controles) voltaria ao padrao ate o
 * usuario mexer em algo. */
function lerCache(): Preferencias {
  try {
    const bruto = localStorage.getItem(CHAVE_PREFERENCIAS);
    if (!bruto) return { ...PREFERENCIAS_PADRAO, idioma: idiomaDoNavegador() };
    const salvas = { ...PREFERENCIAS_PADRAO, ...(JSON.parse(bruto) as Partial<Preferencias>) };
    return { ...salvas, idioma: salvas.idioma === 'es' ? 'es' : 'pt-BR' };
  } catch {
    return PREFERENCIAS_PADRAO;
  }
}

interface EstadoPreferencias {
  preferencias: Preferencias;
  /** Aplica no <html> (efeito visual imediato) e grava o cache local --
   * chamado apos login e apos salvar uma alteracao na tela de Preferencias. */
  aplicar: (preferencias: Preferencias) => void;
}

// Store e logica de aplicacao ficam juntos de proposito -- mesma razao do
// useToasts: chamado a partir de fora da arvore de componentes (login).
export const usePreferencias = create<EstadoPreferencias>((set) => ({
  preferencias: lerCache(),

  aplicar: (preferencias) => {
    aplicarNoDocumento(preferencias);
    salvarCache(preferencias);
    set({ preferencias });
  },
}));

// Reaplica quando o SO troca de claro/escuro (ex.: anoitecer) e a
// preferencia e "automatico" -- sem isso, uma estacao de cho de fabrica que
// fica ligada o dia inteiro so acompanharia a troca no proximo F5/login.
// Assinatura unica, no carregamento do modulo (nao por componente).
try {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const atual = usePreferencias.getState().preferencias;
    if (atual.tema === 'automatico') {
      aplicarNoDocumento(atual);
    }
  });
} catch {
  // matchMedia ou addEventListener indisponivel (ambiente de teste sem o
  // polyfill, navegador muito antigo) -- tema automatico so atualiza no
  // proximo F5/login, degradacao aceitavel.
}

/**
 * Tema efetivo (claro/escuro), ja com "automatico" resolvido contra o SO --
 * para quem precisa saber qual variante visual esta ativa agora (ex.:
 * escolher o logo claro ou escuro da empresa no cabecalho e no login).
 */
export function useTemaResolvido(): 'claro' | 'escuro' {
  return useSyncExternalStore(inscreverEmMudancasDeTema, temaResolvidoAtual);
}

function temaResolvidoAtual(): 'claro' | 'escuro' {
  return resolverTema(usePreferencias.getState().preferencias.tema, prefereEscuroAgora());
}

function inscreverEmMudancasDeTema(notificar: () => void): () => void {
  const desinscreverStore = usePreferencias.subscribe(notificar);
  let desinscreverMedia = () => {};
  try {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', notificar);
    desinscreverMedia = () => media.removeEventListener('change', notificar);
  } catch {
    // Sem matchMedia (testes sem o polyfill): so a store notifica, e o tema
    // "automatico" nunca vai bater com uma troca do SO nesse ambiente mesmo.
  }
  return () => {
    desinscreverStore();
    desinscreverMedia();
  };
}
