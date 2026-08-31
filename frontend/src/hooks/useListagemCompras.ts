import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ErroApi } from '@/servicos/api';
import { listar } from '@/servicos/compras';
import type { DadosPaginacao, Ordem } from '@/tipos/cadastros';
import type { ParametrosListagemCompras, RecursoCompras } from '@/tipos/compras';
import { useDebounce } from './useDebounce';

const LIMITE_PADRAO = 20;

const PAGINACAO_VAZIA: DadosPaginacao = {
  pagina: 1,
  limite: LIMITE_PADRAO,
  total: 0,
  total_paginas: 0,
};

export interface ListagemCompras<T> {
  busca: string;
  definirBusca: (texto: string) => void;
  pagina: number;
  definirPagina: (pagina: number) => void;
  ordenarPor: string;
  ordem: Ordem;
  alternarOrdenacao: (chave: string) => void;
  status: string | null;
  definirStatus: (valor: string | null) => void;
  itens: T[];
  paginacao: DadosPaginacao;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Estado da tela de lista de cotacoes/pedidos de compra: mesma forma de
 * useListagem, mas filtrando por status em vez de ativo/inativo — os dois
 * modulos de compras tem exatamente os mesmos parametros, entao um hook so
 * serve os dois (ao contrario dos cadastros, aqui a duplicacao ja e visivel
 * de antemao).
 */
export function useListagemCompras<T>(recurso: RecursoCompras, colunaPadrao: string): ListagemCompras<T> {
  const [busca, definirBusca] = useState('');
  const [pagina, definirPagina] = useState(1);
  const [ordenarPor, definirOrdenarPor] = useState(colunaPadrao);
  const [ordem, definirOrdem] = useState<Ordem>('asc');
  // null = todos os status: quem abre a lista quer ver o ciclo inteiro, nao
  // so um recorte — diferente do cadastro, onde "ativo" e o padrao.
  const [status, definirStatus] = useState<string | null>(null);

  const buscaAdiada = useDebounce(busca);

  useEffect(() => {
    definirPagina(1);
  }, [buscaAdiada, status]);

  const params: ParametrosListagemCompras = {
    pagina,
    limite: LIMITE_PADRAO,
    ordenar_por: ordenarPor,
    ordem,
    busca: buscaAdiada,
    status,
  };

  const consulta = useQuery({
    queryKey: [recurso, params],
    queryFn: () => listar<T>(recurso, params),
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
    busca,
    definirBusca,
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
