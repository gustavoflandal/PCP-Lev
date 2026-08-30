import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, type TomBadge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import { TrilhaEtapas, type Etapa, type EstadoEtapa } from '@/componentes/ui/TrilhaEtapas';
import type { NomeIcone } from '@/componentes/ui/icones';
import { useFornecedoresAtivos } from '@/hooks/useFornecedoresAtivos';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { separarErro } from '@/lib/errosDeFormulario';
import { formatarData, formatarMoeda } from '@/lib/formato';
import { cancelarPedidoCompra, emitirPedidoCompra, obterCompra, registrarRecebimentoPedidoCompra } from '@/servicos/compras';
import type { ItemPedidoCompra, PedidoCompra } from '@/tipos/compras';

type ModalAberto = 'emitir' | 'cancelar' | 'recebimento' | null;

const STATUS_TERMINAIS = ['Concluido', 'Cancelado'];

// A trilha (§5) so distingue concluida/pendente-acionavel/pendente-futura na
// etapa "Concluido" -- "Aguardando Entrega" e "Recebido Parcial" caem no
// mesmo estado visual (mesma cor, mesmo icone, mesmo rotulo "Pendente ·
// iniciar"), entao sem essa marca a pessoa nao sabe se ja chegou parte da
// mercadoria sem abrir o modal de recebimento. Cobre so os dois status que a
// trilha nao diferencia; os demais ja sao claros pela etapa correspondente.
const STATUS_AMBIGUO_NA_TRILHA: Partial<Record<PedidoCompra['status'], { tom: TomBadge; icone: NomeIcone; rotulo: string }>> = {
  'Aguardando Entrega': { tom: 'pending', icone: 'circle-dot', rotulo: 'Aguardando entrega — nenhum item recebido ainda' },
  'Recebido Parcial': { tom: 'warning', icone: 'package', rotulo: 'Recebido parcial' },
};

function estadoDaEtapaEmitido(status: PedidoCompra['status']): EstadoEtapa {
  return status === 'Rascunho' ? 'pendente-acionavel' : 'concluida';
}

// A etapa "Concluido" fica acionavel enquanto ha recebimento pendente
// (aguardando entrega ou ja parcialmente recebido); antes disso e uma etapa
// futura, sem acao possivel.
function estadoDaEtapaConcluido(status: PedidoCompra['status']): EstadoEtapa {
  if (status === 'Concluido') return 'concluida';
  if (status === 'Aguardando Entrega' || status === 'Recebido Parcial') return 'pendente-acionavel';
  return 'pendente-futura';
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

  const mutacaoRecebimento = useMutation({
    mutationFn: (corpo: Parameters<typeof registrarRecebimentoPedidoCompra>[1]) =>
      registrarRecebimentoPedidoCompra(pedidoId, corpo),
    onSuccess: () => {
      invalidar();
      void clienteQuery.invalidateQueries({ queryKey: ['pedidos-compra', pedidoId] });
      mostrarToast('Recebimento registrado');
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
      aoAcionar: () => definirModalAberto('recebimento'),
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
        <>
          {STATUS_AMBIGUO_NA_TRILHA[pedido.status] && (
            <Badge
              tom={STATUS_AMBIGUO_NA_TRILHA[pedido.status]!.tom}
              icone={STATUS_AMBIGUO_NA_TRILHA[pedido.status]!.icone}
              className="self-start"
            >
              {STATUS_AMBIGUO_NA_TRILHA[pedido.status]!.rotulo}
            </Badge>
          )}
          <TrilhaEtapas rotulo="Status do pedido de compra" etapas={etapas} />
        </>
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

      {modalAberto === 'recebimento' && (
        <ModalRegistrarRecebimento
          pedido={pedido}
          pecaPorId={pecaPorId}
          ocupado={mutacaoRecebimento.isPending}
          erro={separarErro(mutacaoRecebimento.error).geral}
          aoFechar={() => definirModalAberto(null)}
          aoEnviar={(corpo) => mutacaoRecebimento.mutate(corpo)}
        />
      )}
    </div>
  );
}

interface ModalRegistrarRecebimentoProps {
  pedido: PedidoCompra;
  pecaPorId: Map<number, string>;
  ocupado: boolean;
  erro: string | null;
  aoFechar: () => void;
  aoEnviar: (corpo: Parameters<typeof registrarRecebimentoPedidoCompra>[1]) => void;
}

function ModalRegistrarRecebimento({ pedido, pecaPorId, ocupado, erro, aoFechar, aoEnviar }: ModalRegistrarRecebimentoProps) {
  const [receberAgora, definirReceberAgora] = useState<Record<number, string>>(
    Object.fromEntries(pedido.itens.map((item) => [item.parte_peca_id, ''])),
  );

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Registrar recebimento">
      <div className="flex flex-col gap-4">
        {erro && (
          <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
            {erro}
          </p>
        )}
        {pedido.itens.map((item) => {
          const pendente = item.quantidade_solicitada - item.quantidade_recebida;
          return (
            <div key={item.id} className="flex flex-col gap-1">
              <Campo
                rotulo={`${pecaPorId.get(item.parte_peca_id) ?? item.parte_peca_id} — receber agora`}
                tipoDado="quantidade"
                ajuda={`Já recebido: ${item.quantidade_recebida} de ${item.quantidade_solicitada}. Pendente: ${pendente}.`}
                value={receberAgora[item.parte_peca_id] ?? ''}
                onChange={(evento) =>
                  definirReceberAgora((atual) => ({ ...atual, [item.parte_peca_id]: evento.target.value }))
                }
              />
            </div>
          );
        })}
        <div className="flex items-center justify-end gap-2">
          <Botao variante="secundaria" onClick={aoFechar} disabled={ocupado}>
            Cancelar
          </Botao>
          <Botao
            icone="save"
            ocupado={ocupado}
            rotuloOcupado="Registrando…"
            onClick={() =>
              aoEnviar({
                itens: pedido.itens
                  .map((item) => ({
                    parte_peca_id: item.parte_peca_id,
                    quantidade_recebida: Number(receberAgora[item.parte_peca_id] ?? 0),
                  }))
                  .filter((item) => item.quantidade_recebida > 0),
              })
            }
          >
            Registrar recebimento
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
