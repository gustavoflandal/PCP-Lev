import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import { TrilhaEtapas, type Etapa, type EstadoEtapa } from '@/componentes/ui/TrilhaEtapas';
import { useFornecedoresAtivos } from '@/hooks/useFornecedoresAtivos';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { separarErro } from '@/lib/errosDeFormulario';
import { formatarData, formatarMoeda } from '@/lib/formato';
import {
  cancelarCotacao,
  converterCotacaoEmPedido,
  enviarCotacao,
  obterCompra,
  registrarRespostaCotacao,
} from '@/servicos/compras';
import type { Cotacao, ItemCotacao } from '@/tipos/compras';

type ModalAberto = 'enviar' | 'resposta' | 'converter' | 'cancelar' | null;

function estadoDaEtapaEnviada(status: Cotacao['status']): EstadoEtapa {
  if (status === 'Rascunho') return 'pendente-acionavel';
  return 'concluida';
}

function estadoDaEtapaRespondida(status: Cotacao['status']): EstadoEtapa {
  if (status === 'Respondida') return 'concluida';
  if (status === 'Enviada') return 'pendente-acionavel';
  return 'pendente-futura';
}

export function DetalheCotacao() {
  const { id } = useParams<{ id: string }>();
  const cotacaoId = Number(id);
  const navegar = useNavigate();
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const { porId: fornecedorPorId } = useFornecedoresAtivos();
  const { porId: pecaPorId } = usePartesPecasAtivas();
  const [modalAberto, definirModalAberto] = useState<ModalAberto>(null);

  const consulta = useQuery({
    queryKey: ['cotacoes', cotacaoId],
    queryFn: () => obterCompra<Cotacao>('cotacoes', cotacaoId),
  });

  const invalidar = () => {
    void clienteQuery.invalidateQueries({ queryKey: ['cotacoes'] });
  };

  const mutacaoEnviar = useMutation({
    mutationFn: () => enviarCotacao(cotacaoId),
    onSuccess: () => {
      invalidar();
      mostrarToast('Cotação enviada');
      definirModalAberto(null);
    },
  });

  const mutacaoResposta = useMutation({
    mutationFn: (corpo: Parameters<typeof registrarRespostaCotacao>[1]) =>
      registrarRespostaCotacao(cotacaoId, corpo),
    onSuccess: () => {
      invalidar();
      mostrarToast('Resposta registrada');
      definirModalAberto(null);
    },
  });

  const mutacaoConverter = useMutation({
    mutationFn: (corpo: Parameters<typeof converterCotacaoEmPedido>[1]) =>
      converterCotacaoEmPedido(cotacaoId, corpo),
    onSuccess: (pedido) => {
      mostrarToast('Pedido de compra criado');
      navegar(`/pedidos-compra/${pedido.id}`);
    },
  });

  const mutacaoCancelar = useMutation({
    mutationFn: () => cancelarCotacao(cotacaoId),
    onSuccess: () => {
      invalidar();
      mostrarToast('Cotação cancelada');
      definirModalAberto(null);
    },
  });

  if (consulta.isPending) {
    return <p className="text-body text-texto-secondary">Carregando…</p>;
  }
  if (consulta.isError || !consulta.data) {
    return <p className="text-body text-estado-pending">Não foi possível carregar a cotação.</p>;
  }

  const cotacao = consulta.data;

  const etapas: Etapa[] = [
    { chave: 'rascunho', nome: 'Criada', estado: 'concluida', timestamp: formatarData(cotacao.data_emissao) },
    {
      chave: 'enviada',
      nome: 'Enviada',
      estado: estadoDaEtapaEnviada(cotacao.status),
      aoAcionar: () => definirModalAberto('enviar'),
    },
    {
      chave: 'respondida',
      nome: 'Respondida',
      estado: estadoDaEtapaRespondida(cotacao.status),
      timestamp: cotacao.data_resposta ? formatarData(cotacao.data_resposta) : undefined,
      aoAcionar: () => definirModalAberto('resposta'),
    },
  ];

  const colunasItens: Coluna<ItemCotacao>[] = [
    { chave: 'parte_peca_id', rotulo: 'Peça', renderizar: (i) => pecaPorId.get(i.parte_peca_id) ?? '—' },
    { chave: 'quantidade', rotulo: 'Quantidade', alinhamento: 'direita', renderizar: (i) => i.quantidade },
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
          <h1 className="text-title text-texto-primary">{cotacao.numero_cotacao}</h1>
          <p className="text-body text-texto-secondary">
            {fornecedorPorId.get(cotacao.fornecedor_id) ?? '—'} · Validade {formatarData(cotacao.data_validade)}
          </p>
        </div>
        <p className="text-subtitle text-texto-primary">{formatarMoeda(cotacao.valor_total)}</p>
      </div>

      {cotacao.status === 'Cancelada' ? (
        <Badge tom="neutral" icone="circle" className="self-start">
          Cotação cancelada em {formatarData(cotacao.updated_at)}
        </Badge>
      ) : (
        <TrilhaEtapas rotulo="Status da cotação" etapas={etapas} />
      )}

      <Tabela<ItemCotacao>
        rotulo="Itens da cotação"
        colunas={colunasItens}
        itens={cotacao.itens}
        chaveDe={(i) => i.id}
        ordenarPor="id"
        ordem="asc"
        aoOrdenar={() => {}}
        vazio="Nenhum item nesta cotação."
      />

      {cotacao.status !== 'Cancelada' && (
        <div className="flex items-center justify-end gap-2">
          {cotacao.status === 'Respondida' && (
            <Botao icone="shopping-cart" onClick={() => definirModalAberto('converter')}>
              Converter em pedido de compra
            </Botao>
          )}
          <Botao variante="fantasma" icone="trash-2" onClick={() => definirModalAberto('cancelar')}>
            Cancelar cotação
          </Botao>
        </div>
      )}

      <Confirmacao
        aberto={modalAberto === 'enviar'}
        titulo="Enviar cotação"
        mensagem={`Enviar a cotação ${cotacao.numero_cotacao} para o fornecedor?`}
        rotuloConfirmar="Enviar"
        rotuloOcupado="Enviando…"
        ocupado={mutacaoEnviar.isPending}
        aoConfirmar={() => mutacaoEnviar.mutate()}
        aoCancelar={() => definirModalAberto(null)}
      />

      <Confirmacao
        aberto={modalAberto === 'cancelar'}
        titulo="Cancelar cotação"
        mensagem={`Cancelar a cotação ${cotacao.numero_cotacao}? O histórico é preservado.`}
        rotuloConfirmar="Cancelar cotação"
        rotuloOcupado="Cancelando…"
        ocupado={mutacaoCancelar.isPending}
        aoConfirmar={() => mutacaoCancelar.mutate()}
        aoCancelar={() => definirModalAberto(null)}
      />

      {modalAberto === 'resposta' && (
        <ModalRegistrarResposta
          cotacao={cotacao}
          pecaPorId={pecaPorId}
          ocupado={mutacaoResposta.isPending}
          erro={separarErro(mutacaoResposta.error).geral}
          aoFechar={() => definirModalAberto(null)}
          aoEnviar={(corpo) => mutacaoResposta.mutate(corpo)}
        />
      )}

      {modalAberto === 'converter' && (
        <ModalConverterEmPedido
          numeroCotacao={cotacao.numero_cotacao}
          ocupado={mutacaoConverter.isPending}
          erro={separarErro(mutacaoConverter.error).geral}
          aoFechar={() => definirModalAberto(null)}
          aoEnviar={(corpo) => mutacaoConverter.mutate(corpo)}
        />
      )}
    </div>
  );
}

interface ModalRegistrarRespostaProps {
  cotacao: Cotacao;
  pecaPorId: Map<number, string>;
  ocupado: boolean;
  erro: string | null;
  aoFechar: () => void;
  aoEnviar: (corpo: Parameters<typeof registrarRespostaCotacao>[1]) => void;
}

function ModalRegistrarResposta({ cotacao, pecaPorId, ocupado, erro, aoFechar, aoEnviar }: ModalRegistrarRespostaProps) {
  const [dataResposta, definirDataResposta] = useState('');
  const [precos, definirPrecos] = useState<Record<number, string>>(
    Object.fromEntries(cotacao.itens.map((item) => [item.parte_peca_id, String(item.preco_unitario)])),
  );

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Registrar resposta do fornecedor">
      <div className="flex flex-col gap-4">
        {erro && (
          <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
            {erro}
          </p>
        )}
        <Campo
          rotulo="Data da resposta"
          obrigatorio
          ajuda="Formato AAAA-MM-DD"
          value={dataResposta}
          onChange={(evento) => definirDataResposta(evento.target.value)}
        />
        {cotacao.itens.map((item) => (
          <Campo
            key={item.id}
            rotulo={`Preço unitário — ${pecaPorId.get(item.parte_peca_id) ?? item.parte_peca_id}`}
            tipoDado="quantidade"
            value={precos[item.parte_peca_id] ?? ''}
            onChange={(evento) =>
              definirPrecos((atual) => ({ ...atual, [item.parte_peca_id]: evento.target.value }))
            }
          />
        ))}
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
                data_resposta: dataResposta,
                itens: cotacao.itens.map((item) => ({
                  parte_peca_id: item.parte_peca_id,
                  preco_unitario: Number(precos[item.parte_peca_id] ?? 0),
                })),
              })
            }
          >
            Registrar resposta
          </Botao>
        </div>
      </div>
    </Modal>
  );
}

interface ModalConverterEmPedidoProps {
  numeroCotacao: string;
  ocupado: boolean;
  erro: string | null;
  aoFechar: () => void;
  aoEnviar: (corpo: Parameters<typeof converterCotacaoEmPedido>[1]) => void;
}

function ModalConverterEmPedido({ numeroCotacao, ocupado, erro, aoFechar, aoEnviar }: ModalConverterEmPedidoProps) {
  const [numeroPC, definirNumeroPC] = useState('');
  const [dataEntrega, definirDataEntrega] = useState('');
  const [condicaoPagamento, definirCondicaoPagamento] = useState('');

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Converter em pedido de compra" descricao={`Origem: ${numeroCotacao}`}>
      <div className="flex flex-col gap-4">
        {erro && (
          <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
            {erro}
          </p>
        )}
        <Campo
          rotulo="Número do PC"
          obrigatorio
          tipoDado="codigo"
          ajuda="Ex.: PC-2026-001"
          value={numeroPC}
          onChange={(evento) => definirNumeroPC(evento.target.value)}
        />
        <Campo
          rotulo="Data de entrega prevista"
          obrigatorio
          ajuda="Formato AAAA-MM-DD"
          value={dataEntrega}
          onChange={(evento) => definirDataEntrega(evento.target.value)}
        />
        <Campo
          rotulo="Condição de pagamento"
          value={condicaoPagamento}
          onChange={(evento) => definirCondicaoPagamento(evento.target.value)}
        />
        <div className="flex items-center justify-end gap-2">
          <Botao variante="secundaria" onClick={aoFechar} disabled={ocupado}>
            Cancelar
          </Botao>
          <Botao
            icone="shopping-cart"
            ocupado={ocupado}
            rotuloOcupado="Convertendo…"
            onClick={() =>
              aoEnviar({
                numero_pc: numeroPC,
                data_entrega_prevista: dataEntrega,
                condicao_pagamento: condicaoPagamento,
              })
            }
          >
            Converter
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
