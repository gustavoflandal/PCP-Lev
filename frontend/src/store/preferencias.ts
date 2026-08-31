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
  densidade: 'confortavel',
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

function aplicarNoDocumento(preferencias: Preferencias): void {
  const el = document.documentElement;
  const prefereEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
  el.setAttribute('data-tema', resolverTema(preferencias.tema, prefereEscuro));
  if (preferencias.alto_contraste) {
    el.setAttribute('data-alto-contraste', 'true');
  } else {
    el.removeAttribute('data-alto-contraste');
  }
  el.setAttribute('data-densidade', preferencias.densidade);
  el.setAttribute('data-fonte', preferencias.tamanho_fonte);
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
