import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnexosDoRegistro } from '@/componentes/arquivos/AnexosDoRegistro';
import { BadgeStatusOP, BadgeStatusPedidoVenda, NomeEtapa, SeloAtraso } from '@/componentes/producao/Selos';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import { TrilhaEtapas, type Etapa, type EstadoEtapa } from '@/componentes/ui/TrilhaEtapas';
import { separarErro } from '@/lib/errosDeFormulario';
import { formatarData, formatarMoeda } from '@/lib/formato';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { cancelarPedidoVenda, gerarOP, obterPedidoVenda, registrarEntregaPedidoVenda } from '@/servicos/producao';
import {
  pedidoAtrasado,
  pedidoEditavel,
  type ItemPedidoVenda,
  type PedidoVenda,
  type StatusPedidoVenda,
} from '@/tipos/producao';

type ModalAberto = 'cancelar' | 'entregar' | null;

const FLUXO: { chave: StatusPedidoVenda; nome: string }[] = [
  { chave: 'Aberto', nome: 'Aberto' },
  { chave: 'Em Producao', nome: 'Em produção' },
  { chave: 'Pronto para Envio', nome: 'Pronto para envio' },
  { chave: 'Entregue', nome: 'Entregue' },
];

/** Etapas ate a atual: concluidas; a seguinte: o proximo passo; o resto: futuras. */
function etapasDoPedido(p: PedidoVenda, aoEntregar?: () => void): Etapa[] {
  const atual = FLUXO.findIndex((f) => f.chave === p.status);
  return FLUXO.map((f, indice) => {
    const estado: EstadoEtapa =
      indice <= atual ? 'concluida' : indice === atual + 1 ? 'pendente-acionavel' : 'pendente-futura';
    const timestamp =
      f.chave === 'Aberto'
        ? formatarData(p.data_pedido)
        : f.chave === 'Entregue' && p.data_entrega_real
          ? formatarData(p.data_entrega_real)
          : undefined;
    return {
      chave: f.chave,
      nome: f.nome,
      estado,
      timestamp,
      aoAcionar: f.chave === 'Entregue' && p.status === 'Pronto para Envio' ? aoEntregar : undefined,
    };
  });
}

/** O item ainda pode gerar OP: nunca gerou, ou a que gerou foi cancelada. */
function semOPAtiva(i: ItemPedidoVenda): boolean {
  return !i.ordem_producao_id || i.status_op === 'Cancelada';
}

export function DetalhePedidoVenda() {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);
  const navegar = useNavigate();
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const podeEditar = usePode(PERMISSOES.vendasEditar);
  const podeCancelar = usePode(PERMISSOES.vendasCancelar);
  const podeEntregar = usePode(PERMISSOES.vendasEntregar);
  const podeGerarOP = usePode(PERMISSOES.producaoGerarOP);
  const [modal, definirModal] = useState<ModalAberto>(null);
  const [erroAcao, definirErroAcao] = useState<string | null>(null);

  const consulta = useQuery({ queryKey: ['pedidos-venda', pedidoId], queryFn: () => obterPedidoVenda(pedidoId) });

  const invalidar = () => {
    void clienteQuery.invalidateQueries({ queryKey: ['pedidos-venda'] });
    void clienteQuery.invalidateQueries({ queryKey: ['ops'] });
    void clienteQuery.invalidateQueries({ queryKey: ['kanban'] });
  };

  const falhou = (erro: unknown, padrao: string) => {
    definirErroAcao(separarErro(erro).geral ?? padrao);
    definirModal(null);
  };

  const mutacaoGerarOP = useMutation({
    mutationFn: (itemId: number) => gerarOP(itemId),
    onSuccess: (op) => {
      definirErroAcao(null);
      invalidar();
      mostrarToast(`OP ${op.numero_op} gerada`);
    },
    onError: (erro) => falhou(erro, 'Não foi possível gerar a OP.'),
  });

  const mutacaoCancelar = useMutation({
    mutationFn: () => cancelarPedidoVenda(pedidoId),
    onSuccess: () => {
      definirErroAcao(null);
      invalidar();
      mostrarToast('Pedido de venda cancelado');
      definirModal(null);
    },
    onError: (erro) => falhou(erro, 'Não foi possível cancelar o pedido.'),
  });

  const mutacaoEntregar = useMutation({
    mutationFn: () => registrarEntregaPedidoVenda(pedidoId),
    onSuccess: () => {
      definirErroAcao(null);
      invalidar();
      mostrarToast('Entrega registrada');
      definirModal(null);
    },
    onError: (erro) => falhou(erro, 'Não foi possível registrar a entrega.'),
  });

  if (consulta.isPending) return <p className="text-body text-texto-secondary">Carregando…</p>;
  if (consulta.isError || !consulta.data) {
    return <p className="text-body text-estado-pending">Não foi possível carregar o pedido de venda.</p>;
  }

  const pedido = consulta.data;
  const itens = pedido.itens ?? [];
  const aceitaOP = pedido.status === 'Aberto' || pedido.status === 'Em Producao';
  const cancelavel = pedido.status !== 'Entregue' && pedido.status !== 'Cancelado';

  const colunas: Coluna<ItemPedidoVenda>[] = [
    {
      chave: 'produto',
      rotulo: 'Produto',
      renderizar: (i) => (
        <span className="flex flex-col">
          <span className="font-mono">{i.produto_codigo}</span>
          <span className="text-label text-texto-secondary">{i.produto_descricao}</span>
        </span>
      ),
    },
    { chave: 'quantidade', rotulo: 'Qtd.', alinhamento: 'direita', renderizar: (i) => <span className="tabular">{i.quantidade}</span> },
    { chave: 'preco_unitario', rotulo: 'Preço unitário', alinhamento: 'direita', renderizar: (i) => formatarMoeda(i.preco_unitario) },
    { chave: 'total', rotulo: 'Total', alinhamento: 'direita', renderizar: (i) => formatarMoeda(i.total) },
    {
      chave: 'op',
      rotulo: 'Ordem de produção',
      renderizar: (i) =>
        i.ordem_producao_id && i.numero_op ? (
          <span className="flex flex-wrap items-center gap-2">
            <Link to={`/producao/ops/${i.ordem_producao_id}`} className="font-mono text-brand hover:underline">
              {i.numero_op}
            </Link>
            {i.status_op && <BadgeStatusOP status={i.status_op} />}
            {i.status_op === 'Liberada' && i.etapa_op && (
              <span className="text-label text-texto-secondary">
                <NomeEtapa etapa={i.etapa_op} />
              </span>
            )}
          </span>
        ) : (
          <span className="text-label text-texto-secondary">Sem OP</span>
        ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-mono text-title text-texto-primary">{pedido.numero_pedido}</h1>
          <p className="text-body text-texto-secondary">
            {pedido.cliente_nome} · Pedido em {formatarData(pedido.data_pedido)} · Entrega prometida{' '}
            {formatarData(pedido.data_entrega_prometida)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <BadgeStatusPedidoVenda status={pedido.status} />
            {pedidoAtrasado(pedido) && <SeloAtraso>Entrega atrasada</SeloAtraso>}
          </div>
          {pedido.observacoes && <p className="text-body text-texto-secondary">{pedido.observacoes}</p>}
        </div>
        <p className="font-mono text-subtitle tabular text-texto-primary">{formatarMoeda(pedido.valor_total)}</p>
      </div>

      {pedido.status !== 'Cancelado' && <TrilhaEtapas rotulo="Situação do pedido de venda" etapas={etapasDoPedido(pedido, podeEntregar ? () => definirModal('entregar') : undefined)} />}

      {erroAcao && (
        <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
          {erroAcao}
        </p>
      )}

      <Tabela<ItemPedidoVenda>
        rotulo="Itens do pedido de venda"
        colunas={colunas}
        itens={itens}
        chaveDe={(i) => i.id}
        ordenarPor="id"
        ordem="asc"
        aoOrdenar={() => {}}
        vazio="Nenhum item neste pedido."
        acoes={
          podeGerarOP && aceitaOP
            ? (i) =>
                semOPAtiva(i) ? (
                  <Botao
                    variante="secundaria"
                    icone="factory"
                    ocupado={mutacaoGerarOP.isPending && mutacaoGerarOP.variables === i.id}
                    rotuloOcupado="Gerando…"
                    disabled={mutacaoGerarOP.isPending}
                    onClick={() => mutacaoGerarOP.mutate(i.id)}
                    aria-label={`Gerar OP de ${i.produto_codigo}`}
                  >
                    Gerar OP
                  </Botao>
                ) : null
            : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {podeEditar && pedidoEditavel(pedido) && (
          <Botao variante="secundaria" icone="pencil" onClick={() => navegar(`/pedidos-venda/${pedido.id}/editar`)}>
            Editar pedido
          </Botao>
        )}
        {podeCancelar && cancelavel && (
          <Botao variante="fantasma" icone="trash-2" onClick={() => definirModal('cancelar')}>
            Cancelar pedido
          </Botao>
        )}
        {podeEntregar && pedido.status === 'Pronto para Envio' && (
          <Botao icone="package" onClick={() => definirModal('entregar')}>
            Registrar entrega
          </Botao>
        )}
      </div>

      <section aria-label="Documentos do pedido" className="flex flex-col gap-2">
        <h2 className="text-subtitle text-texto-primary">Documentos</h2>
        <AnexosDoRegistro
          entidade="pedido_venda"
          entidadeId={pedido.id}
          podeEditar={podeEditar}
          encerrado={!cancelavel}
        />
      </section>

      <Confirmacao
        aberto={modal === 'cancelar'}
        titulo="Cancelar pedido de venda"
        mensagem={`Cancelar o pedido ${pedido.numero_pedido}? As OPs ainda abertas dele também são canceladas. O histórico é preservado.`}
        rotuloConfirmar="Cancelar pedido"
        rotuloOcupado="Cancelando…"
        ocupado={mutacaoCancelar.isPending}
        aoConfirmar={() => mutacaoCancelar.mutate()}
        aoCancelar={() => definirModal(null)}
      />

      <Confirmacao
        aberto={modal === 'entregar'}
        titulo="Registrar entrega"
        mensagem={`Registrar a entrega do pedido ${pedido.numero_pedido}? Os produtos saem do estoque e as unidades ficam como expedidas.`}
        rotuloConfirmar="Registrar entrega"
        rotuloOcupado="Registrando…"
        ocupado={mutacaoEntregar.isPending}
        aoConfirmar={() => mutacaoEntregar.mutate()}
        aoCancelar={() => definirModal(null)}
      />
    </div>
  );
}
