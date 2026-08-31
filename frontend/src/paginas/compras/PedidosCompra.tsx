import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Badge, type TomBadge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import type { NomeIcone } from '@/componentes/ui/icones';
import { useFornecedoresAtivos } from '@/hooks/useFornecedoresAtivos';
import { useListagemCompras } from '@/hooks/useListagemCompras';
import { baixarArquivo } from '@/lib/arquivos';
import { formatarData, formatarMoeda } from '@/lib/formato';
import { listarPedidosEmAtraso } from '@/servicos/compras';
import type { PedidoCompra, StatusPedidoCompra } from '@/tipos/compras';

const OPCOES_STATUS = [
  { valor: 'Rascunho', rotulo: 'Rascunho' },
  { valor: 'Emitido', rotulo: 'Emitido' },
  { valor: 'Aceito', rotulo: 'Aceito' },
  { valor: 'Aguardando Entrega', rotulo: 'Aguardando entrega' },
  { valor: 'Recebido Parcial', rotulo: 'Recebido parcial' },
  { valor: 'Concluido', rotulo: 'Concluído' },
  { valor: 'Cancelado', rotulo: 'Cancelado' },
];

/**
 * Tom por status (design system §2): as fases em andamento (Emitido, Aceito,
 * Aguardando Entrega) usam "blocked" — aguardando o fornecedor entregar, uma
 * dependencia externa, nao um problema; Recebido Parcial usa "warning" por
 * ser literalmente um estado de atencao/acompanhamento.
 */
const TOM_STATUS: Record<StatusPedidoCompra, { tom: TomBadge; icone: NomeIcone }> = {
  Rascunho: { tom: 'neutral', icone: 'circle' },
  Emitido: { tom: 'blocked', icone: 'shield-alert' },
  Aceito: { tom: 'blocked', icone: 'shield-alert' },
  'Aguardando Entrega': { tom: 'blocked', icone: 'shield-alert' },
  'Recebido Parcial': { tom: 'warning', icone: 'alert-triangle' },
  Concluido: { tom: 'done', icone: 'check-circle-2' },
  Cancelado: { tom: 'neutral', icone: 'circle' },
};

export function PedidosCompra() {
  const navegar = useNavigate();
  const lista = useListagemCompras<PedidoCompra>('pedidos-compra', 'numero_pc');
  const { porId: fornecedorPorId } = useFornecedoresAtivos();
  const emAtraso = useQuery({ queryKey: ['pedidos-compra', 'em-atraso'], queryFn: listarPedidosEmAtraso });
  const mutacaoExportar = useMutation({
    mutationFn: () => baixarArquivo('/pedidos-compra/relatorio.csv', 'pedidos-compra.csv'),
  });

  const colunas: Coluna<PedidoCompra>[] = [
    {
      chave: 'numero_pc',
      rotulo: 'Número',
      ordenavel: true,
      renderizar: (p) => (
        <button
          type="button"
          onClick={() => navegar(`/pedidos-compra/${p.id}`)}
          className="font-mono text-brand hover:underline"
        >
          {p.numero_pc}
        </button>
      ),
    },
    {
      chave: 'fornecedor',
      rotulo: 'Fornecedor',
      renderizar: (p) => fornecedorPorId.get(p.fornecedor_id) ?? '—',
    },
    {
      chave: 'data_entrega_prevista',
      rotulo: 'Entrega prevista',
      ordenavel: true,
      renderizar: (p) => formatarData(p.data_entrega_prevista),
    },
    {
      chave: 'valor_total',
      rotulo: 'Valor total',
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (p) => formatarMoeda(p.valor_total),
    },
    {
      chave: 'status',
      rotulo: 'Situação',
      renderizar: (p) => (
        <Badge tom={TOM_STATUS[p.status].tom} icone={TOM_STATUS[p.status].icone}>
          {p.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Pedidos de compra</h1>
        <p className="text-body text-texto-secondary">Compras emitidas a fornecedores.</p>
      </div>

      {emAtraso.data && emAtraso.data.length > 0 && (
        <div className="flex flex-col gap-2 rounded-cartao border border-estado-warning bg-estado-warning-bg p-4">
          <h2 className="flex items-center gap-2 text-subtitle text-estado-warning">Pedidos em atraso</h2>
          <ul className="flex flex-col gap-1">
            {emAtraso.data.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => navegar(`/pedidos-compra/${p.id}`)}
                  className="font-mono text-estado-warning hover:underline"
                >
                  {p.numero_pc}
                </button>
                <span className="ml-2 text-label text-texto-secondary">
                  entrega prevista {formatarData(p.data_entrega_prevista)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-[320px] max-w-full">
            <Campo
              rotulo="Buscar por número"
              value={lista.busca}
              onChange={(evento) => lista.definirBusca(evento.target.value)}
              placeholder="Digite para filtrar"
            />
          </div>
          <div className="w-[200px]">
            <Selecao
              rotulo="Situação"
              opcoes={OPCOES_STATUS}
              placeholder="Todos"
              value={lista.status ?? ''}
              onChange={(evento) => lista.definirStatus(evento.target.value || null)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Botao
            variante="secundaria"
            icone="save"
            ocupado={mutacaoExportar.isPending}
            rotuloOcupado="Exportando…"
            onClick={() => mutacaoExportar.mutate()}
          >
            Exportar CSV
          </Botao>
          <Botao icone="plus" onClick={() => navegar('/pedidos-compra/novo')}>
            Novo pedido de compra
          </Botao>
        </div>
      </div>

      <div>
        <Tabela<PedidoCompra>
          rotulo="Pedidos de compra"
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(p) => p.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio="Nenhum pedido de compra cadastrado. Cadastre o primeiro para começar."
        />
        <Paginacao
          pagina={lista.paginacao.pagina}
          totalPaginas={lista.paginacao.total_paginas}
          total={lista.paginacao.total}
          aoMudar={lista.definirPagina}
        />
      </div>
    </div>
  );
}
