import { useNavigate } from 'react-router-dom';
import { BadgeStatusPedidoVenda, SeloAtraso } from '@/componentes/producao/Selos';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useListagemCompras } from '@/hooks/useListagemCompras';
import { formatarData, formatarMoeda } from '@/lib/formato';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import {
  ROTULO_STATUS_PEDIDO_VENDA,
  hojeAAAAMMDD,
  pedidoAtrasado,
  type PedidoVenda,
  type StatusPedidoVenda,
} from '@/tipos/producao';

const OPCOES_STATUS = (Object.keys(ROTULO_STATUS_PEDIDO_VENDA) as StatusPedidoVenda[]).map((s) => ({
  valor: s,
  rotulo: ROTULO_STATUS_PEDIDO_VENDA[s],
}));

export function PedidosVenda() {
  const navegar = useNavigate();
  const podeIncluir = usePode(PERMISSOES.vendasIncluir);
  const lista = useListagemCompras<PedidoVenda>('pedidos-venda', 'data_entrega_prometida');
  const hoje = hojeAAAAMMDD();

  const colunas: Coluna<PedidoVenda>[] = [
    {
      chave: 'numero_pedido',
      rotulo: 'Número',
      ordenavel: true,
      renderizar: (p) => (
        <button
          type="button"
          onClick={() => navegar(`/pedidos-venda/${p.id}`)}
          className="font-mono text-brand hover:underline"
        >
          {p.numero_pedido}
        </button>
      ),
    },
    { chave: 'cliente', rotulo: 'Cliente', ordenavel: true, renderizar: (p) => p.cliente_nome },
    { chave: 'data_pedido', rotulo: 'Data', ordenavel: true, renderizar: (p) => formatarData(p.data_pedido) },
    {
      chave: 'data_entrega_prometida',
      rotulo: 'Entrega prometida',
      ordenavel: true,
      renderizar: (p) => (
        <span className="flex flex-wrap items-center gap-2">
          {formatarData(p.data_entrega_prometida)}
          {pedidoAtrasado(p, hoje) && <SeloAtraso />}
        </span>
      ),
    },
    {
      chave: 'valor_total',
      rotulo: 'Valor total',
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (p) => formatarMoeda(p.valor_total),
    },
    { chave: 'status', rotulo: 'Situação', ordenavel: true, renderizar: (p) => <BadgeStatusPedidoVenda status={p.status} /> },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Pedidos de venda</h1>
        <p className="text-body text-texto-secondary">
          O que cada cliente comprou e quando foi prometido. Cada item vira uma ordem de produção.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-[320px] max-w-full">
            <Campo
              rotulo="Buscar por número ou cliente"
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
        {podeIncluir && (
          <Botao icone="plus" onClick={() => navegar('/pedidos-venda/novo')}>
            Novo pedido de venda
          </Botao>
        )}
      </div>

      <div>
        <Tabela<PedidoVenda>
          rotulo="Pedidos de venda"
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(p) => p.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio="Nenhum pedido de venda encontrado. Cadastre um pedido para gerar as ordens de produção."
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
