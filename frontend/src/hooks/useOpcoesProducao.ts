import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { OpcaoSelecao } from '@/componentes/ui/Selecao';
import { listar } from '@/servicos/cadastros';
import type { CentroTrabalho, Cliente, ProdutoAcabado } from '@/tipos/cadastros';

const LIMITE_SELECAO = 200;

/** Clientes ativos para a Selecao do pedido de venda. */
export function useClientesAtivos(): { opcoes: OpcaoSelecao[]; carregando: boolean } {
  const consulta = useQuery({
    queryKey: ['clientes', 'selecao'],
    queryFn: () =>
      listar<Cliente>('clientes', {
        pagina: 1,
        limite: LIMITE_SELECAO,
        ordenar_por: 'razao_social',
        ordem: 'asc',
        busca: '',
        filtro_ativo: true,
      }),
  });
  const opcoes = useMemo<OpcaoSelecao[]>(
    () =>
      (consulta.data?.itens ?? []).map((c) => ({
        valor: String(c.id),
        rotulo: c.nome_fantasia ? `${c.razao_social} (${c.nome_fantasia})` : c.razao_social,
      })),
    [consulta.data],
  );
  return { opcoes, carregando: consulta.isPending };
}

/** Produtos acabados ativos (itens do pedido de venda; o preco de venda pre-preenche o item). */
export function useProdutosAcabadosAtivos(): {
  itens: ProdutoAcabado[];
  opcoes: OpcaoSelecao[];
  porId: Map<number, ProdutoAcabado>;
} {
  const consulta = useQuery({
    queryKey: ['produtos-acabados', 'selecao'],
    queryFn: () =>
      listar<ProdutoAcabado>('produtos-acabados', {
        pagina: 1,
        limite: LIMITE_SELECAO,
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
  const porId = useMemo(() => new Map(itens.map((p) => [p.id, p])), [itens]);
  return { itens, opcoes, porId };
}

/**
 * Centros de trabalho ativos de uma etapa (forma do centro: SEPARACAO...),
 * para iniciar o apontamento. `etapa` vazia desliga a consulta.
 */
export function useCentrosDaEtapa(etapa: string): { opcoes: OpcaoSelecao[]; carregando: boolean } {
  const consulta = useQuery({
    queryKey: ['centros-trabalho', 'selecao', etapa],
    enabled: etapa !== '',
    queryFn: () =>
      listar<CentroTrabalho>('centros-trabalho', {
        pagina: 1,
        limite: LIMITE_SELECAO,
        ordenar_por: 'codigo',
        ordem: 'asc',
        busca: '',
        filtro_ativo: true,
        filtros: { etapa },
      }),
  });
  const opcoes = useMemo<OpcaoSelecao[]>(
    () => (consulta.data?.itens ?? []).map((c) => ({ valor: String(c.id), rotulo: `${c.codigo} — ${c.nome}` })),
    [consulta.data],
  );
  return { opcoes, carregando: consulta.isPending && etapa !== '' };
}
