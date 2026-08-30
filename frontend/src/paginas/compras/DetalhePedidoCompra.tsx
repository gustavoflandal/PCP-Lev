import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import { TrilhaEtapas, type Etapa, type EstadoEtapa } from '@/componentes/ui/TrilhaEtapas';
import { useFornecedoresAtivos } from '@/hooks/useFornecedoresAtivos';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { formatarData, formatarMoeda } from '@/lib/formato';
import { cancelarPedidoCompra, emitirPedidoCompra, obterCompra } from '@/servicos/compras';
import type { ItemPedidoCompra, PedidoCompra } from '@/tipos/compras';

type ModalAberto = 'emitir' | 'cancelar' | null;

const STATUS_TERMINAIS = ['Concluido', 'Cancelado'];

function estadoDaEtapaEmitido(status: PedidoCompra['status']): EstadoEtapa {
  return status === 'Rascunho' ? 'pendente-acionavel' : 'concluida';
}

function estadoDaEtapaConcluido(status: PedidoCompra['status']): EstadoEtapa {
  return status === 'Concluido' ? 'concluida' : 'pendente-futura';
}

export function DetalhePedidoCompra() {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const { porId: fornecedorPorId } = useFornecedoresAtivos();
  const { porId: pecaPorId } = usePartesPecasAtivas();
  const [modalAberto, definirModalAberto] = useState<ModalAberto>(null);

  const consulta = useQuery({
    queryKey: ['pedidos-compra', pedidoId],
    queryFn: () => obterCompra<PedidoCompra>('pedidos-compra', pedidoId),
  });

  const invalidar = () => {
    void clienteQuery.invalidateQueries({ queryKey: ['pedidos-compra'] });
  };

  const mutacaoEmitir = useMutation({
    mutationFn: () => emitirPedidoCompra(pedidoId),
    onSuccess: () => {
      invalidar();
      mostrarToast('Pedido de compra emitido');
      definirModalAberto(null);
    },
  });

  const mutacaoCancelar = useMutation({
    mutationFn: () => cancelarPedidoCompra(pedidoId),
    onSuccess: () => {
      invalidar();
      mostrarToast('Pedido de compra cancelado');
      definirModalAberto(null);
    },
  });

  if (consulta.isPending) {
    return <p className="text-body text-texto-secondary">Carregando…</p>;
  }
  if (consulta.isError || !consulta.data) {
    return <p className="text-body text-estado-pending">Não foi possível carregar o pedido de compra.</p>;
  }

  const pedido = consulta.data;
  const podeCancelar = !STATUS_TERMINAIS.includes(pedido.status);

  const etapas: Etapa[] = [
    { chave: 'criado', nome: 'Criado', estado: 'concluida', timestamp: formatarData(pedido.data_pedido) },
    {
      chave: 'emitido',
      nome: 'Emitido',
      estado: estadoDaEtapaEmitido(pedido.status),
      aoAcionar: () => definirModalAberto('emitir'),
    },
    {
      chave: 'concluido',
      nome: 'Concluído',
      estado: estadoDaEtapaConcluido(pedido.status),
      timestamp: pedido.data_entrega_real ? formatarData(pedido.data_entrega_real) : undefined,
    },
  ];

  const colunasItens: Coluna<ItemPedidoCompra>[] = [
    { chave: 'parte_peca_id', rotulo: 'Peça', renderizar: (i) => pecaPorId.get(i.parte_peca_id) ?? '—' },
    { chave: 'quantidade_solicitada', rotulo: 'Qtd. solicitada', alinhamento: 'direita', renderizar: (i) => i.quantidade_solicitada },
    { chave: 'quantidade_recebida', rotulo: 'Qtd. recebida', alinhamento: 'direita', renderizar: (i) => i.quantidade_recebida },
    {
      chave: 'preco_unitario',
      rotulo: 'Preço unitário',
      alinhamento: 'direita',
      renderizar: (i) => formatarMoeda(i.preco_unitario),
    },
    { chave: 'total', rotulo: 'Total', alinhamento: 'direita', renderizar: (i) => formatarMoeda(i.total) },
  ];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-texto-primary">{pedido.numero_pc}</h1>
          <p className="text-body text-texto-secondary">
            {fornecedorPorId.get(pedido.fornecedor_id) ?? '—'} · Entrega prevista{' '}
            {formatarData(pedido.data_entrega_prevista)}
            {pedido.condicao_pagamento && ` · ${pedido.condicao_pagamento}`}
          </p>
          {pedido.cotacao_id && (
            <Link to={`/cotacoes/${pedido.cotacao_id}`} className="text-label text-brand hover:underline">
              Ver cotação de origem
            </Link>
          )}
        </div>
        <p className="text-subtitle text-texto-primary">{formatarMoeda(pedido.valor_total)}</p>
      </div>

      {pedido.status === 'Cancelado' ? (
        <Badge tom="neutral" icone="circle" className="self-start">
          Pedido cancelado em {formatarData(pedido.updated_at)}
        </Badge>
      ) : (
        <TrilhaEtapas rotulo="Status do pedido de compra" etapas={etapas} />
      )}

      <Tabela<ItemPedidoCompra>
        rotulo="Itens do pedido de compra"
        colunas={colunasItens}
        itens={pedido.itens}
        chaveDe={(i) => i.id}
        ordenarPor="id"
        ordem="asc"
        aoOrdenar={() => {}}
        vazio="Nenhum item neste pedido."
      />

      {podeCancelar && (
        <div className="flex items-center justify-end gap-2">
          <Botao variante="fantasma" icone="trash-2" onClick={() => definirModalAberto('cancelar')}>
            Cancelar pedido
          </Botao>
        </div>
      )}

      <Confirmacao
        aberto={modalAberto === 'emitir'}
        titulo="Emitir pedido de compra"
        mensagem={`Emitir o pedido ${pedido.numero_pc} para o fornecedor?`}
        rotuloConfirmar="Emitir"
        rotuloOcupado="Emitindo…"
        ocupado={mutacaoEmitir.isPending}
        aoConfirmar={() => mutacaoEmitir.mutate()}
        aoCancelar={() => definirModalAberto(null)}
      />

      <Confirmacao
        aberto={modalAberto === 'cancelar'}
        titulo="Cancelar pedido de compra"
        mensagem={`Cancelar o pedido ${pedido.numero_pc}? O histórico é preservado.`}
        rotuloConfirmar="Cancelar pedido"
        rotuloOcupado="Cancelando…"
        ocupado={mutacaoCancelar.isPending}
        aoConfirmar={() => mutacaoCancelar.mutate()}
        aoCancelar={() => definirModalAberto(null)}
      />
    </div>
  );
}
