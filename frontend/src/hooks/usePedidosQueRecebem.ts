import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { OpcaoSelecao } from '@/componentes/ui/Selecao';
import { listar } from '@/servicos/compras';
import type { PedidoCompra, StatusPedidoCompra } from '@/tipos/compras';
import { t } from '@/i18n';

/** Situacoes de PC que aceitam nota fiscal (notaentrada.statusQueRecebem). */
export const STATUS_QUE_RECEBEM: StatusPedidoCompra[] = ['Aguardando Entrega', 'Recebido Parcial'];

export interface PedidosQueRecebem {
  itens: PedidoCompra[];
  opcoes: OpcaoSelecao[];
  porId: Map<number, PedidoCompra>;
  carregando: boolean;
}

/**
 * Pedidos de compra que podem receber nota (aguardando entrega ou recebido
 * parcial). A listagem filtra um status por vez: duas consultas, juntas.
 */
export function usePedidosQueRecebem(fornecedorPorId?: Map<number, string>): PedidosQueRecebem {
  const consultas = useQueries({
    queries: STATUS_QUE_RECEBEM.map((status) => ({
      queryKey: ['pedidos-compra', 'recebem', status],
      queryFn: () =>
        listar<PedidoCompra>('pedidos-compra', {
          pagina: 1,
          limite: 100,
          ordenar_por: 'numero_pc',
          ordem: 'asc' as const,
          busca: '',
          status,
        }),
    })),
  });

  const aguardando = consultas[0].data;
  const parcial = consultas[1].data;
  const itens = useMemo(
    () =>
      [...new Map([...(aguardando?.itens ?? []), ...(parcial?.itens ?? [])].map((p) => [p.id, p])).values()].sort((a, b) =>
        a.numero_pc.localeCompare(b.numero_pc),
      ),
    [aguardando, parcial],
  );

  const opcoes = useMemo<OpcaoSelecao[]>(
    () =>
      itens.map((p) => ({
        valor: String(p.id),
        rotulo: `${p.numero_pc} — ${fornecedorPorId?.get(p.fornecedor_id) ?? t('fornecedor {id}', { id: p.fornecedor_id })} (${p.status === 'Recebido Parcial' ? t('recebido parcial') : t('aguardando entrega')})`,
      })),
    [itens, fornecedorPorId],
  );

  const porId = useMemo(() => new Map(itens.map((p) => [p.id, p])), [itens]);

  return { itens, opcoes, porId, carregando: consultas.some((c) => c.isPending) };
}
