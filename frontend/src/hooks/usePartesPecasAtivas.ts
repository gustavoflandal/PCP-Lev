import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { OpcaoSelecao } from '@/componentes/ui/Selecao';
import { listar } from '@/servicos/cadastros';
import type { PartePeca } from '@/tipos/cadastros';

export interface PartesPecasAtivas {
  itens: PartePeca[];
  /** Pronto para popular a Selecao de item de uma cotacao/pedido de compra. */
  opcoes: OpcaoSelecao[];
  /** Para exibir o codigo a partir do parte_peca_id numa lista. */
  porId: Map<number, string>;
}

/**
 * Partes/pecas ativas, para escolher itens em cotacao e pedido de compra, e
 * para resolver o codigo a partir do id em listas — mesmo raciocinio de
 * useFornecedoresAtivos.
 */
export function usePartesPecasAtivas(): PartesPecasAtivas {
  const consulta = useQuery({
    queryKey: ['partes-pecas', 'selecao'],
    queryFn: () =>
      listar<PartePeca>('partes-pecas', {
        pagina: 1,
        limite: 200,
        ordenar_por: 'codigo',
        ordem: 'asc',
        busca: '',
        filtro_ativo: true,
      }),
  });

  const itens = useMemo(() => consulta.data?.itens ?? [], [consulta.data]);

  const opcoes = useMemo<OpcaoSelecao[]>(
    () => itens.map((p) => ({ valor: String(p.id), rotulo: `${p.codigo} — ${p.descricao}` })),
    [itens],
  );

  const porId = useMemo(() => new Map(itens.map((p) => [p.id, p.codigo])), [itens]);

  return { itens, opcoes, porId };
}
