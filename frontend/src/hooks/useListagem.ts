import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ErroApi } from '@/servicos/api';
import { listar } from '@/servicos/cadastros';
import type { DadosPaginacao, Ordem, ParametrosListagem, Recurso } from '@/tipos/cadastros';
import { useDebounce } from './useDebounce';

const LIMITE_PADRAO = 20;

const PAGINACAO_VAZIA: DadosPaginacao = {
  pagina: 1,
  limite: LIMITE_PADRAO,
  total: 0,
  total_paginas: 0,
};

export interface Listagem<T> {
  busca: string;
  definirBusca: (texto: string) => void;
  pagina: number;
  definirPagina: (pagina: number) => void;
  ordenarPor: string;
  ordem: Ordem;
  alternarOrdenacao: (chave: string) => void;
  filtroAtivo: boolean | null;
  definirFiltroAtivo: (valor: boolean | null) => void;
  itens: T[];
  paginacao: DadosPaginacao;
  carregando: boolean;
  /** Mensagem legivel da API, pronta para a tela. */
  erro: string | null;
  recarregar: () => void;
}

/**
 * Estado da tela de lista: busca, pagina, ordenacao e situacao, mais a
 * consulta ao servidor. A busca e adiada para nao disparar uma requisicao por
 * tecla, e o resultado anterior fica na tela enquanto o proximo carrega —
 * uma tabela que pisca em branco a cada pagina cansa quem trabalha nela o dia
 * inteiro.
 */
export function useListagem<T>(recurso: Recurso, colunaPadrao: string): Listagem<T> {
  const [busca, definirBusca] = useState('');
  const [pagina, definirPagina] = useState(1);
  const [ordenarPor, definirOrdenarPor] = useState(colunaPadrao);
  const [ordem, definirOrdem] = useState<Ordem>('asc');
  // Cadastro inativo e historico: quem abre a tela quer o que esta em uso.
  const [filtroAtivo, definirFiltroAtivo] = useState<boolean | null>(true);

  const buscaAdiada = useDebounce(busca);

  // Filtrar de dentro da pagina 5 e cair num resultado de 2 paginas deixaria
  // a tela vazia sem motivo aparente.
  useEffect(() => {
    definirPagina(1);
  }, [buscaAdiada, filtroAtivo]);

  const params: ParametrosListagem = {
    pagina,
    limite: LIMITE_PADRAO,
    ordenar_por: ordenarPor,
    ordem,
    busca: buscaAdiada,
    filtro_ativo: filtroAtivo,
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
    filtroAtivo,
    definirFiltroAtivo,
    itens: consulta.data?.itens ?? [],
    paginacao: consulta.data?.paginacao ?? PAGINACAO_VAZIA,
    carregando: consulta.isPending,
    erro,
    recarregar: () => void consulta.refetch(),
  };
}
