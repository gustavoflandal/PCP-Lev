import { useNavigate } from 'react-router-dom';
import { t, td } from '@/i18n';
import { Badge, type TomBadge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import type { NomeIcone } from '@/componentes/ui/icones';
import { useFornecedoresAtivos } from '@/hooks/useFornecedoresAtivos';
import { useListagemCompras } from '@/hooks/useListagemCompras';
import { formatarData, formatarMoeda } from '@/lib/formato';
import type { Cotacao, StatusCotacao } from '@/tipos/compras';
import { PERMISSOES, usePode } from '@/lib/permissoes';

const opcoesStatus = () => [
  { valor: 'Rascunho', rotulo: t('Rascunho') },
  { valor: 'Enviada', rotulo: t('Enviada') },
  { valor: 'Respondida', rotulo: t('Respondida') },
  { valor: 'Cancelada', rotulo: t('Cancelada') },
];

/**
 * Tom por status (design system §2): Enviada usa "blocked" porque a cotacao
 * esta aguardando uma resposta externa (o fornecedor), nao um erro nem uma
 * pendencia interna; Respondida ja e um resultado favoravel (done).
 */
const TOM_STATUS: Record<StatusCotacao, { tom: TomBadge; icone: NomeIcone }> = {
  Rascunho: { tom: 'neutral', icone: 'circle' },
  Enviada: { tom: 'blocked', icone: 'shield-alert' },
  Respondida: { tom: 'done', icone: 'check-circle-2' },
  Cancelada: { tom: 'neutral', icone: 'circle' },
};

export function Cotacoes() {
  const navegar = useNavigate();
  const podeIncluir = usePode(PERMISSOES.cotacoesIncluir);
  const lista = useListagemCompras<Cotacao>('cotacoes', 'numero_cotacao');
  const { porId: fornecedorPorId } = useFornecedoresAtivos();

  const colunas: Coluna<Cotacao>[] = [
    {
      chave: 'numero_cotacao',
      rotulo: t('Número'),
      ordenavel: true,
      renderizar: (c) => (
        <button
          type="button"
          onClick={() => navegar(`/cotacoes/${c.id}`)}
          className="font-mono text-brand hover:underline"
        >
          {c.numero_cotacao}
        </button>
      ),
    },
    {
      chave: 'fornecedor',
      rotulo: t('Fornecedor'),
      renderizar: (c) => fornecedorPorId.get(c.fornecedor_id) ?? '—',
    },
    {
      chave: 'data_validade',
      rotulo: t('Validade'),
      ordenavel: true,
      renderizar: (c) => formatarData(c.data_validade),
    },
    {
      chave: 'valor_total',
      rotulo: t('Valor total'),
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (c) => formatarMoeda(c.valor_total),
    },
    {
      chave: 'status',
      rotulo: t('Situação'),
      renderizar: (c) => (
        <Badge tom={TOM_STATUS[c.status].tom} icone={TOM_STATUS[c.status].icone}>
          {td(c.status)}
        </Badge>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Cotações')}</h1>
        <p className="text-body text-texto-secondary">{t('Pedidos de preço enviados a fornecedores.')}</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-[320px] max-w-full">
            <Campo
              rotulo={t('Buscar por número')}
              value={lista.busca}
              onChange={(evento) => lista.definirBusca(evento.target.value)}
              placeholder={t('Digite para filtrar')}
            />
          </div>
          <div className="w-[160px]">
            <Selecao
              rotulo={t('Situação')}
              opcoes={opcoesStatus()}
              placeholder={t('Todos')}
              value={lista.status ?? ''}
              onChange={(evento) => lista.definirStatus(evento.target.value || null)}
            />
          </div>
        </div>

        {podeIncluir && (
          <Botao icone="plus" onClick={() => navegar('/cotacoes/nova')}>
            {t('Nova cotação')}
          </Botao>
        )}
      </div>

      <div>
        <Tabela<Cotacao>
          rotulo={t('Cotações')}
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(c) => c.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio={t('Nenhuma cotação cadastrada. Cadastre a primeira para começar.')}
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
