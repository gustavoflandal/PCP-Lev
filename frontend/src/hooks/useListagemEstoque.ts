import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ErroApi } from '@/servicos/api';
import { listarEstoque } from '@/servicos/estoque';
import type { DadosPaginacao, Ordem } from '@/tipos/cadastros';
import type { ParametrosListagemEstoque, SaldoEstoque } from '@/tipos/estoque';

const LIMITE_PADRAO = 20;
const PAGINACAO_VAZIA: DadosPaginacao = { pagina: 1, limite: LIMITE_PADRAO, total: 0, total_paginas: 0 };

export interface ListagemEstoque {
  pagina: number;
  definirPagina: (pagina: number) => void;
  ordenarPor: string;
  ordem: Ordem;
  alternarOrdenacao: (chave: string) => void;
  status: string | null;
  definirStatus: (valor: string | null) => void;
  itens: SaldoEstoque[];
  paginacao: DadosPaginacao;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Estado da tela de estoque: mesma forma de useListagemCompras, mas sem
 * busca textual (a lista de saldo nao tem campo de busca no design
 * aprovado) — extraido a parte, nao reaproveitando useListagemCompras, para
 * nao acoplar o modulo de estoque ao de compras por uma coincidencia de
 * formato.
 */
export function useListagemEstoque(): ListagemEstoque {
  const [pagina, definirPagina] = useState(1);
  const [ordenarPor, definirOrdenarPor] = useState('codigo');
  const [ordem, definirOrdem] = useState<Ordem>('asc');
  const [status, definirStatus] = useState<string | null>(null);

  useEffect(() => {
    definirPagina(1);
  }, [status]);

  const params: ParametrosListagemEstoque = { pagina, limite: LIMITE_PADRAO, ordenar_por: ordenarPor, ordem, status };

  const consulta = useQuery({
    queryKey: ['estoque', params],
    queryFn: () => listarEstoque(params),
    placeholderData: keepPreviousData,
  });

  function alternarOrdenacao(chave: string) {
    if (chave === ordenarPor) {
      definirOrdem(ordem === 'asc' ? 'desc' : 'asc');
    } else {
      definirOrdenarPor(chave);
      definirOrdem('asc');
    }
    definirPagina(1);
  }

  const erro = consulta.error
    ? consulta.error instanceof ErroApi
      ? consulta.error.message
      : 'Não foi possível carregar a lista. Tente de novo.'
    : null;

  return {
    pagina,
    definirPagina,
    ordenarPor,
    ordem,
    alternarOrdenacao,
    status,
    definirStatus,
    itens: consulta.data?.itens ?? [],
    paginacao: consulta.data?.paginacao ?? PAGINACAO_VAZIA,
    carregando: consulta.isPending,
    erro,
    recarregar: () => void consulta.refetch(),
  };
}
