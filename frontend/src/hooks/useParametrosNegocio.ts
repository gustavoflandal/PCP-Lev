import { useQuery } from '@tanstack/react-query';
import { buscarParametrosNegocio, chaveParametrosNegocio } from '@/servicos/negocio';

/** Mesmo default da migration 012 -- usado enquanto o GET nao responde ou se
 * ele falhar, para um formulario novo nunca nascer com o campo vazio. */
export const LEAD_TIME_PADRAO_FALLBACK = 7;

/**
 * Parametros de negocio (doc 0, secao 4.7.5). Para os formularios de cadastro
 * mudam raramente: staleTime infinito. A tela de edicao passa
 * `sempreAtualizar` -- o PUT grava a configuracao inteira, e editar sobre um
 * cache antigo desfaria em silencio o que outro administrador mudou depois.
 */
export function useParametrosNegocio(habilitado = true, { sempreAtualizar = false } = {}) {
  return useQuery({
    queryKey: chaveParametrosNegocio,
    queryFn: buscarParametrosNegocio,
    staleTime: sempreAtualizar ? 0 : Infinity,
    refetchOnMount: sempreAtualizar ? 'always' : true,
    enabled: habilitado,
  });
}

/** Lead time inicial dos cadastros novos de Fornecedor e Parte/Peca. */
export function useLeadTimePadrao(): number {
  return useParametrosNegocio().data?.lead_time_padrao_dias ?? LEAD_TIME_PADRAO_FALLBACK;
}
