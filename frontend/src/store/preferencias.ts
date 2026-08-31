import { create } from 'zustand';

export type Tema = 'claro' | 'escuro' | 'automatico';
export type Densidade = 'compacta' | 'confortavel';
export type TamanhoFonte = 'padrao' | 'grande' | 'extra-grande';

export interface Preferencias {
  tema: Tema;
  alto_contraste: boolean;
  densidade: Densidade;
  tamanho_fonte: TamanhoFonte;
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  tema: 'automatico',
  alto_contraste: false,
  // 'compacta' preserva o visual de antes da Fase 4.1 (linha de 40px fixa);
  // ver o comentario da migration 009 no backend.
  densidade: 'compacta',
  tamanho_fonte: 'padrao',
};

const CHAVE_PREFERENCIAS = 'pcp.preferencias';

/** Resolve "automatico" para claro/escuro a partir da preferencia do SO —
 * mesma logica do script inline em index.html, que roda antes do React
 * montar (sem acesso a este modulo). */
export function resolverTema(tema: Tema, prefereEscuro: boolean): 'claro' | 'escuro' {
  if (tema === 'claro' || tema === 'escuro') return tema;
  return prefereEscuro ? 'escuro' : 'claro';
}

function prefereEscuroAgora(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Mesma normalizacao defensiva do script inline em index.html -- um valor
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
}

function salvarCache(preferencias: Preferencias): void {
  try {
    localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias));
  } catch {
    // Armazenamento indisponivel: a preferencia ainda vale para esta sessao,
    // so nao sobrevive a um F5 antes do backend confirmar de novo.
  }
}

/** Le o mesmo cache que o script inline de index.html ja aplicou no <html>
 * antes do React montar -- sem isso, um F5 com sessao ja aberta deixaria o
 * <html> com os atributos certos, mas o estado desta store (que a tela de
 * Preferencias le para marcar os controles) voltaria ao padrao ate o
 * usuario mexer em algo. */
function lerCache(): Preferencias {
  try {
    const bruto = localStorage.getItem(CHAVE_PREFERENCIAS);
    if (!bruto) return PREFERENCIAS_PADRAO;
    return { ...PREFERENCIAS_PADRAO, ...(JSON.parse(bruto) as Partial<Preferencias>) };
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
