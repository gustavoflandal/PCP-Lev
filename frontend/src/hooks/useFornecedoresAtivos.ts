import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { OpcaoSelecao } from '@/componentes/ui/Selecao';
import { listar } from '@/servicos/cadastros';
import type { Fornecedor } from '@/tipos/cadastros';

export interface FornecedoresAtivos {
  itens: Fornecedor[];
  /** Pronto para popular uma Selecao de fornecedor. */
  opcoes: OpcaoSelecao[];
  /** Para exibir a razao social a partir do fornecedor_id numa lista. */
  porId: Map<number, string>;
}

/**
 * Fornecedores ativos, para escolher em formularios (cotacao, pedido de
 * compra, peca) e para resolver o nome a partir do id em listas. Consumido
 * por varias telas — extraido direto, sem esperar a duplicacao aparecer
 * (ao contrario do useCadastroCrud do Sprint 2), porque a query e
 * identica nos quatro lugares que precisam dela.
 */
export function useFornecedoresAtivos(): FornecedoresAtivos {
  const consulta = useQuery({
    queryKey: ['fornecedores', 'selecao'],
    queryFn: () =>
      listar<Fornecedor>('fornecedores', {
        pagina: 1,
        limite: 200,
        ordenar_por: 'razao_social',
        ordem: 'asc',
        busca: '',
        filtro_ativo: true,
      }),
  });

  const itens = useMemo(() => consulta.data?.itens ?? [], [consulta.data]);

  const opcoes = useMemo<OpcaoSelecao[]>(
    () => itens.map((f) => ({ valor: String(f.id), rotulo: f.razao_social })),
    [itens],
  );

  const porId = useMemo(() => new Map(itens.map((f) => [f.id, f.razao_social])), [itens]);

  return { itens, opcoes, porId };
}
