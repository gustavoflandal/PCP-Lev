import { create } from 'zustand';
import type { FormatoData, FormatoHora } from '@/tipos/regional';

export interface ConfiguracaoRegionalAplicada {
  formato_data: FormatoData;
  formato_hora: FormatoHora;
}

/** Mesmos defaults da migration 011 -- o que a tela mostra antes do GET
 * /configuracoes/regional responder (ou se a requisicao falhar) e
 * exatamente o que o backend usaria de qualquer forma. */
export const CONFIGURACAO_REGIONAL_PADRAO: ConfiguracaoRegionalAplicada = {
  formato_data: 'DD/MM/AAAA',
  formato_hora: '24H',
};

interface EstadoConfiguracaoRegional {
  configuracao: ConfiguracaoRegionalAplicada;
  aplicar: (configuracao: ConfiguracaoRegionalAplicada) => void;
}

// Store simples, sem cache em localStorage (diferente de usePreferencias):
// o valor so e lido dentro de renders React (formatarData/formatarDataHora),
// nunca antes do React montar, entao nao ha "flash" de formato errado a
// evitar -- o default acima ja e o mesmo que o backend usaria.
export const useConfiguracaoRegional = create<EstadoConfiguracaoRegional>((set) => ({
  configuracao: CONFIGURACAO_REGIONAL_PADRAO,
  aplicar: (configuracao) => set({ configuracao }),
}));

/** Le a configuracao fora do React -- mesmo padrao de tokenAtual() em
 * store/autenticacao.ts. formatarData/formatarDataHora (lib/formato.ts) sao
 * funcoes simples chamadas dentro de renderizadores de coluna/celula, nao
 * hooks, entao nao podem assinar a store via useConfiguracaoRegional(...). */
export function configuracaoRegionalAtual(): ConfiguracaoRegionalAplicada {
  return useConfiguracaoRegional.getState().configuracao;
}
