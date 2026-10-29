import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeStatusOP, NomeEtapa, SeloAtraso } from '@/componentes/producao/Selos';
import { Campo } from '@/componentes/ui/Campo';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { t, td, useIdioma } from '@/i18n';
import { useListagemCompras } from '@/hooks/useListagemCompras';
import { formatarData } from '@/lib/formato';
import {
  ETAPAS_OP,
  ROTULO_ETAPA_OP,
  ROTULO_STATUS_OP,
  hojeAAAAMMDD,
  opAtrasada,
  type OrdemProducao,
  type StatusOP,
} from '@/tipos/producao';

const opcoesStatus = () => (Object.keys(ROTULO_STATUS_OP) as StatusOP[]).map((s) => ({ valor: s, rotulo: td(ROTULO_STATUS_OP[s]) }));
const opcoesEtapa = () => ETAPAS_OP.map((e) => ({ valor: e, rotulo: td(ROTULO_ETAPA_OP[e]) }));

export function OrdensProducao() {
  useIdioma();
  const navegar = useNavigate();
  const [etapa, definirEtapa] = useState('');
  const lista = useListagemCompras<OrdemProducao>('ops', 'data_conclusao_prevista', { etapa });
  const hoje = hojeAAAAMMDD();

  const colunas: Coluna<OrdemProducao>[] = [
    {
      chave: 'numero_op',
      rotulo: t('OP'),
      ordenavel: true,
      renderizar: (op) => (
        <button type="button" onClick={() => navegar(`/producao/ops/${op.id}`)} className="font-mono text-brand hover:underline">
          {op.numero_op}
        </button>
      ),
    },
    {
      chave: 'produto',
      rotulo: t('Produto'),
      renderizar: (op) => (
        <span className="flex flex-col">
          <span className="font-mono">{op.produto_codigo}</span>
          <span className="text-label text-texto-secondary">{op.produto_descricao}</span>
        </span>
      ),
    },
    { chave: 'quantidade', rotulo: t('Qtd.'), alinhamento: 'direita', renderizar: (op) => <span className="tabular">{op.quantidade}</span> },
    {
      chave: 'pedido',
      rotulo: t('Pedido / cliente'),
      renderizar: (op) => (
        <span className="flex flex-col">
          <span className="font-mono">{op.numero_pedido}</span>
          <span className="text-label text-texto-secondary">{op.cliente_nome}</span>
        </span>
      ),
    },
    {
      chave: 'data_conclusao_prevista',
      rotulo: t('Prazo'),
      ordenavel: true,
      renderizar: (op) => (
        <span className="flex flex-wrap items-center gap-2">
          {formatarData(op.data_conclusao_prevista)}
          {opAtrasada(op, hoje) && <SeloAtraso>{t('Atrasada')}</SeloAtraso>}
        </span>
      ),
    },
    {
      chave: 'etapa_atual',
      rotulo: t('Etapa'),
      ordenavel: true,
      renderizar: (op) => (op.status === 'Liberada' ? <NomeEtapa etapa={op.etapa_atual} /> : '—'),
    },
    { chave: 'status', rotulo: t('Situação'), ordenavel: true, renderizar: (op) => <BadgeStatusOP status={op.status} /> },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Ordens de produção')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Cada OP produz um item de pedido de venda. Gere a OP no pedido; libere, aponte e avance aqui.')}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-[320px] max-w-full">
          <Campo
            rotulo={t('Buscar por OP, pedido, produto ou cliente')}
            value={lista.busca}
            onChange={(evento) => lista.definirBusca(evento.target.value)}
            placeholder={t('Digite para filtrar')}
          />
        </div>
        <div className="w-[200px]">
          <Selecao
            rotulo={t('Situação')}
            opcoes={opcoesStatus()}
            placeholder={t('Todas')}
            value={lista.status ?? ''}
            onChange={(evento) => lista.definirStatus(evento.target.value || null)}
          />
        </div>
        <div className="w-[200px]">
          <Selecao
            rotulo={t('Etapa')}
            opcoes={opcoesEtapa()}
            placeholder={t('Todas')}
            ajuda={etapa ? t('Só OPs liberadas') : undefined}
            value={etapa}
            onChange={(evento) => definirEtapa(evento.target.value)}
          />
        </div>
      </div>

      <div>
        <Tabela<OrdemProducao>
          rotulo={t('Ordens de produção')}
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(op) => op.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio={t('Nenhuma ordem de produção encontrada. Gere OPs a partir dos itens de um pedido de venda.')}
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
