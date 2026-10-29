import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { marcar, t, td } from '@/i18n';
import { AnexosDoRegistro } from '@/componentes/arquivos/AnexosDoRegistro';
import { SeloStatusNota } from '@/componentes/recebimento/Selos';
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
import { cancelarPedidoCompra, emitirPedidoCompra, encerrarPedidoCompra, listar, obterCompra } from '@/servicos/compras';
import type { ItemPedidoCompra, PedidoCompra } from '@/tipos/compras';
import type { NotaEntrada } from '@/tipos/notasEntrada';
import { PERMISSOES, usePode } from '@/lib/permissoes';

type ModalAberto = 'emitir' | 'cancelar' | 'encerrar' | null;

const STATUS_QUE_RECEBEM = ['Aguardando Entrega', 'Recebido Parcial'];

const STATUS_TERMINAIS = ['Concluido', 'Cancelado'];

// A trilha (§5) so distingue concluida/pendente-acionavel/pendente-futura na
// etapa "Concluido" -- "Aguardando Entrega" e "Recebido Parcial" caem no
// mesmo estado visual (mesma cor, mesmo icone, mesmo rotulo "Pendente ·
// iniciar"), entao sem essa marca a pessoa nao sabe se ja chegou parte da
// mercadoria sem abrir as notas fiscais. Cobre so os dois status que a
// trilha nao diferencia; os demais ja sao claros pela etapa correspondente.
// Tom/icone alinhados com TOM_STATUS em PedidosCompra.tsx: "Aguardando
// Entrega" usa "blocked" porque e uma dependencia externa do fornecedor, nao
// uma pendencia do operador; "Recebido Parcial" usa "warning" por ser um
// estado de atencao/acompanhamento.
const STATUS_AMBIGUO_NA_TRILHA: Partial<Record<PedidoCompra['status'], { tom: TomBadge; icone: NomeIcone; rotulo: string }>> = {
  'Aguardando Entrega': { tom: 'blocked', icone: 'shield-alert', rotulo: marcar('Aguardando entrega — nenhum item recebido ainda') },
  'Recebido Parcial': { tom: 'warning', icone: 'alert-triangle', rotulo: marcar('Recebido parcial') },
};

function estadoDaEtapaEmitido(status: PedidoCompra['status']): EstadoEtapa {
  return status === 'Rascunho' ? 'pendente-acionavel' : 'concluida';
}

// A etapa "Concluido" fica acionavel enquanto ha recebimento pendente
// (aguardando entrega ou ja parcialmente recebido) -- o proximo passo e lancar
// a nota fiscal (RN-001: nao ha recebimento direto pelo pedido); antes disso
// e uma etapa futura, sem acao possivel.
function estadoDaEtapaConcluido(status: PedidoCompra['status']): EstadoEtapa {
  if (status === 'Concluido') return 'concluida';
  if (status === 'Aguardando Entrega' || status === 'Recebido Parcial') return 'pendente-acionavel';
  return 'pendente-futura';
}

export function DetalhePedidoCompra() {
  const podeEmitir = usePode(PERMISSOES.pedidosEmitir);
  const podeLancarNota = usePode(PERMISSOES.notasLancar);
  const podeVerNotas = usePode(PERMISSOES.notasVisualizar);
  const podeEncerrar = usePode(PERMISSOES.pedidosEncerrar);
  const podeCancelarPedido = usePode(PERMISSOES.pedidosCancelar);
  const podeEditarAnexos = usePode(PERMISSOES.pedidosEditar);
  const navegar = useNavigate();
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const { porId: fornecedorPorId } = useFornecedoresAtivos();
  const { porId: pecaPorId } = usePartesPecasAtivas();
  const [modalAberto, definirModalAberto] = useState<ModalAberto>(null);
  const [motivo, definirMotivo] = useState('');

  const consulta = useQuery({
    queryKey: ['pedidos-compra', pedidoId],
    queryFn: () => obterCompra<PedidoCompra>('pedidos-compra', pedidoId),
  });

  const notas = useQuery({
    queryKey: ['notas-entrada', { pedido_compra_id: pedidoId }],
    queryFn: () =>
      listar<NotaEntrada>('notas-entrada', {
        pagina: 1,
        limite: 50,
        ordenar_por: 'data_entrada',
        ordem: 'desc',
        busca: '',
        status: null,
        filtros: { pedido_compra_id: String(pedidoId) },
      }),
    enabled: podeVerNotas,
  });

  const invalidar = () => {
    void clienteQuery.invalidateQueries({ queryKey: ['pedidos-compra'] });
  };

  const mutacaoEmitir = useMutation({
    mutationFn: () => emitirPedidoCompra(pedidoId),
    onSuccess: () => {
      invalidar();
      mostrarToast(t('Pedido de compra emitido'));
      definirModalAberto(null);
    },
    // Sem isto, uma recusa da API (alcada do Gestor, cotacoes insuficientes,
    // status que ja mudou) so parava o "Emitindo…", sem dizer o porque.
    onError: (erro) => {
      mostrarToast(separarErro(erro).geral ?? t('Não foi possível emitir o pedido de compra.'), 'pending');
      definirModalAberto(null);
    },
  });

  const mutacaoCancelar = useMutation({
    mutationFn: () => cancelarPedidoCompra(pedidoId),
    onSuccess: () => {
      invalidar();
      mostrarToast(t('Pedido de compra cancelado'));
      definirModalAberto(null);
    },
    onError: (erro) => {
      mostrarToast(separarErro(erro).geral ?? t('Não foi possível cancelar o pedido de compra.'), 'pending');
      definirModalAberto(null);
    },
  });

  const mutacaoEncerrar = useMutation({
    mutationFn: () => encerrarPedidoCompra(pedidoId, motivo.trim()),
    onSuccess: () => {
      invalidar();
      mostrarToast(t('Pedido de compra encerrado'));
      definirModalAberto(null);
    },
  });

  if (consulta.isPending) {
    return <p className="text-body text-texto-secondary">{t('Carregando…')}</p>;
  }
  if (consulta.isError || !consulta.data) {
    return <p className="text-body text-estado-pending">{t('Não foi possível carregar o pedido de compra.')}</p>;
  }

  const pedido = consulta.data;
  const podeCancelar = !STATUS_TERMINAIS.includes(pedido.status);
  const recebendo = STATUS_QUE_RECEBEM.includes(pedido.status);
  const lancarNota = () => navegar(`/notas-entrada/nova?pedido=${pedido.id}`);
  const motivoValido = motivo.trim().length >= 10 && motivo.trim().length <= 255;

  const etapas: Etapa[] = [
    { chave: 'criado', nome: t('Criado'), estado: 'concluida', timestamp: formatarData(pedido.data_pedido) },
    {
      chave: 'emitido',
      nome: t('Emitido'),
      estado: estadoDaEtapaEmitido(pedido.status),
      aoAcionar: podeEmitir ? () => definirModalAberto('emitir') : undefined,
    },
    {
      chave: 'concluido',
      nome: t('Concluído'),
      estado: estadoDaEtapaConcluido(pedido.status),
      timestamp: pedido.data_entrega_real ? formatarData(pedido.data_entrega_real) : undefined,
      aoAcionar: podeLancarNota && recebendo ? lancarNota : undefined,
    },
  ];

  const colunasItens: Coluna<ItemPedidoCompra>[] = [
    { chave: 'parte_peca_id', rotulo: t('Peça'), renderizar: (i) => pecaPorId.get(i.parte_peca_id) ?? '—' },
    { chave: 'quantidade_solicitada', rotulo: t('Qtd. solicitada'), alinhamento: 'direita', renderizar: (i) => i.quantidade_solicitada },
    { chave: 'quantidade_recebida', rotulo: t('Qtd. recebida'), alinhamento: 'direita', renderizar: (i) => i.quantidade_recebida },
    {
      chave: 'preco_unitario',
      rotulo: t('Preço unitário'),
      alinhamento: 'direita',
      renderizar: (i) => formatarMoeda(i.preco_unitario),
    },
    { chave: 'total', rotulo: t('Total'), alinhamento: 'direita', renderizar: (i) => formatarMoeda(i.total) },
  ];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title text-texto-primary">{pedido.numero_pc}</h1>
          <p className="text-body text-texto-secondary">
            {t('{fornecedor} · Entrega prevista {data}', {
              fornecedor: fornecedorPorId.get(pedido.fornecedor_id) ?? '—',
              data: formatarData(pedido.data_entrega_prevista),
            })}
            {pedido.condicao_pagamento && ` · ${pedido.condicao_pagamento}`}
          </p>
          {pedido.cotacao_id && (
            <Link to={`/cotacoes/${pedido.cotacao_id}`} className="text-label text-brand hover:underline">
              {t('Ver cotação de origem')}
            </Link>
          )}
        </div>
        <p className="text-subtitle text-texto-primary">{formatarMoeda(pedido.valor_total)}</p>
      </div>

      {pedido.status === 'Cancelado' ? (
        <Badge tom="neutral" icone="circle" className="self-start">
          {t('Pedido cancelado em {data}', { data: formatarData(pedido.updated_at) })}
        </Badge>
      ) : (
        <>
          {STATUS_AMBIGUO_NA_TRILHA[pedido.status] && (
            <Badge
              tom={STATUS_AMBIGUO_NA_TRILHA[pedido.status]!.tom}
              icone={STATUS_AMBIGUO_NA_TRILHA[pedido.status]!.icone}
              className="self-start"
            >
              {td(STATUS_AMBIGUO_NA_TRILHA[pedido.status]!.rotulo)}
            </Badge>
          )}
          <TrilhaEtapas rotulo={t('Status do pedido de compra')} etapas={etapas} />
        </>
      )}

      <Tabela<ItemPedidoCompra>
        rotulo={t('Itens do pedido de compra')}
        colunas={colunasItens}
        itens={pedido.itens}
        chaveDe={(i) => i.id}
        ordenarPor="id"
        ordem="asc"
        aoOrdenar={() => {}}
        vazio={t('Nenhum item neste pedido.')}
      />

      {pedido.motivo_encerramento && (
        <p className="rounded-campo border border-borda-subtle bg-estado-neutral-bg px-3 py-2 text-body text-estado-neutral">
          {pedido.encerrado_por
            ? t('Encerrado com saldo pendente por {usuario}. Motivo: {motivo}', {
                usuario: pedido.encerrado_por,
                motivo: pedido.motivo_encerramento,
              })
            : t('Encerrado com saldo pendente. Motivo: {motivo}', { motivo: pedido.motivo_encerramento })}
        </p>
      )}

      {podeVerNotas && (
        <section aria-label={t('Notas fiscais do pedido')} className="flex flex-col gap-2">
          <h2 className="text-subtitle text-texto-primary">{t('Notas fiscais de entrada')}</h2>
          {notas.isPending ? (
            <p className="text-body text-texto-secondary">{t('Carregando notas…')}</p>
          ) : notas.isError ? (
            <p role="alert" className="text-body text-estado-pending">
              {t('Não foi possível carregar as notas deste pedido.')}
            </p>
          ) : (notas.data?.itens ?? []).length === 0 ? (
            <p className="text-body text-texto-secondary">
              {recebendo && podeLancarNota
                ? t('Nenhuma nota lançada para este pedido. Use "Lançar nota fiscal" quando a mercadoria chegar.')
                : t('Nenhuma nota lançada para este pedido.')}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda-subtle rounded-cartao border border-borda-subtle bg-surface-raised">
              {(notas.data?.itens ?? []).map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <Link to={`/notas-entrada/${n.id}`} className="font-mono text-brand hover:underline">
                    NF {n.numero}/{n.serie}
                  </Link>
                  <span className="text-label text-texto-secondary">
                    {t('entrada {data}', { data: formatarData(n.data_entrada ?? undefined) })}
                  </span>
                  <span className="tabular text-body text-texto-primary">{formatarMoeda(n.valor_total)}</span>
                  <SeloStatusNota status={n.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {podeCancelarPedido && podeCancelar && (
          <Botao variante="fantasma" icone="trash-2" onClick={() => definirModalAberto('cancelar')}>
            {t('Cancelar pedido')}
          </Botao>
        )}
        {podeEncerrar && recebendo && (
          <Botao
            variante="secundaria"
            icone="ban"
            onClick={() => {
              definirMotivo('');
              mutacaoEncerrar.reset();
              definirModalAberto('encerrar');
            }}
          >
            {t('Encerrar com saldo pendente')}
          </Botao>
        )}
        {podeLancarNota && recebendo && (
          <Botao icone="file-input" onClick={lancarNota}>
            {t('Lançar nota fiscal')}
          </Botao>
        )}
      </div>

      <section aria-label={t('Documentos do pedido')} className="flex flex-col gap-2">
        <h2 className="text-subtitle text-texto-primary">{t('Documentos')}</h2>
        <AnexosDoRegistro
          entidade="pedido_compra"
          entidadeId={pedido.id}
          podeEditar={podeEditarAnexos}
          encerrado={STATUS_TERMINAIS.includes(pedido.status)}
        />
      </section>

      <Confirmacao
        aberto={modalAberto === 'emitir'}
        titulo={t('Emitir pedido de compra')}
        mensagem={t('Emitir o pedido {numero} para o fornecedor?', { numero: pedido.numero_pc })}
        rotuloConfirmar={t('Emitir')}
        rotuloOcupado={t('Emitindo…')}
        ocupado={mutacaoEmitir.isPending}
        aoConfirmar={() => mutacaoEmitir.mutate()}
        aoCancelar={() => definirModalAberto(null)}
      />

      <Confirmacao
        aberto={modalAberto === 'cancelar'}
        titulo={t('Cancelar pedido de compra')}
        mensagem={t('Cancelar o pedido {numero}? O histórico é preservado.', { numero: pedido.numero_pc })}
        rotuloConfirmar={t('Cancelar pedido')}
        rotuloOcupado={t('Cancelando…')}
        ocupado={mutacaoCancelar.isPending}
        aoConfirmar={() => mutacaoCancelar.mutate()}
        aoCancelar={() => definirModalAberto(null)}
      />

      <Modal
        aberto={modalAberto === 'encerrar'}
        aoFechar={() => definirModalAberto(null)}
        titulo={t('Encerrar com saldo pendente')}
        descricao={t('O pedido vai para Concluído sem receber o restante. O saldo pendente deixa de ser esperado.')}
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => definirModalAberto(null)} disabled={mutacaoEncerrar.isPending}>
              {t('Voltar')}
            </Botao>
            <Botao
              variante="perigo"
              icone="ban"
              disabled={!motivoValido}
              ocupado={mutacaoEncerrar.isPending}
              rotuloOcupado={t('Encerrando…')}
              onClick={() => mutacaoEncerrar.mutate()}
            >
              {t('Encerrar pedido')}
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {mutacaoEncerrar.isError && (
            <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
              {separarErro(mutacaoEncerrar.error).geral ?? t('Não foi possível encerrar o pedido de compra.')}
            </p>
          )}
          <Campo
            rotulo={t('Motivo do encerramento')}
            obrigatorio
            maxLength={255}
            ajuda={t('{n} de 10 a 255 caracteres. Ex.: fornecedor descontinuou o item.', { n: motivo.trim().length })}
            value={motivo}
            onChange={(e) => definirMotivo(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
