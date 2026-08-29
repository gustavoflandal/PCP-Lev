import { ErroApi } from '@/servicos/api';

/** Erro de um formulario de cadastro, ja separado em geral x por campo. */
export interface ErroDeFormulario {
  geral: string | null;
  porCampo: Record<string, string>;
}

/** Separa o erro da API em "marca o campo" e "mostra no topo do modal". */
export function separarErro(erro: unknown): ErroDeFormulario {
  if (!(erro instanceof ErroApi)) {
    return { geral: erro ? 'Não foi possível salvar. Tente de novo.' : null, porCampo: {} };
  }
  if (erro.detalhes?.length) {
    return {
      geral: null,
      porCampo: Object.fromEntries(erro.detalhes.map((d) => [d.campo, d.mensagem])),
    };
  }
  return { geral: erro.message, porCampo: {} };
}
