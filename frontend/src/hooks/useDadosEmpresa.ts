import { useQuery } from '@tanstack/react-query';
import { buscarDadosEmpresa } from '@/servicos/empresa';

/** Chave compartilhada -- a tela de edicao invalida esta query ao salvar,
 * para o cabecalho/login refletirem a mudanca sem F5. */
export const chaveDadosEmpresa = ['configuracoes', 'empresa'] as const;

/**
 * Dados publicos da empresa (nome, logo) usados no cabecalho e na tela de
 * login -- por isso nao depende de sessao. Muda raramente: staleTime
 * infinito, sem refetch automatico.
 */
export function useDadosEmpresa() {
  return useQuery({
    queryKey: chaveDadosEmpresa,
    queryFn: buscarDadosEmpresa,
    staleTime: Infinity,
  });
}
