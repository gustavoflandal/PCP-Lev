import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SeloValidadeLote } from '@/componentes/recebimento/Selos';
import { Badge } from '@/componentes/ui/Badge';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { t, td } from '@/i18n';
import { formatarData, formatarMoeda } from '@/lib/formato';
import { ErroApi } from '@/servicos/api';
import { rastrearLote } from '@/servicos/rastreio';
import type { ConsumoOP, EntradaNF, UnidadeAfetada } from '@/tipos/rastreio';

function Bloco({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-2">
      <div>
        <h2 className="text-subtitle text-texto-primary">{titulo}</h2>
        <p className="text-label text-texto-secondary">{descricao}</p>
      </div>
      {children}
    </section>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-label text-texto-secondary">{rotulo}</dt>
      <dd className="text-body text-texto-primary">{children}</dd>
    </div>
  );
}

/** /lotes/:id — do lote ao campo: notas de entrada, OPs que consumiram e unidades produzidas. */
export function RastreioLote() {
  const { id } = useParams<{ id: string }>();
  const loteId = Number(id);
  const consulta = useQuery({ queryKey: ['lotes', loteId, 'rastreio'], queryFn: () => rastrearLote(loteId), retry: false });

  if (consulta.isPending) {
    return <p className="text-body text-texto-secondary">{t('Carregando rastreabilidade do lote…')}</p>;
  }
  if (consulta.isError || !consulta.data) {
    const naoAchou = consulta.error instanceof ErroApi && consulta.error.status === 404;
    return (
      <p role="alert" className="text-body text-estado-pending">
        {naoAchou ? t('Lote não encontrado.') : t('Não foi possível carregar a rastreabilidade do lote. Tente de novo.')}
      </p>
    );
  }

  const { lote, entradas, consumos, unidades } = consulta.data;
  const temCusto = (entradas ?? []).some((e) => e.custo_unitario != null);

  const colunasEntradas: Coluna<EntradaNF>[] = [
    {
      chave: 'nota',
      rotulo: t('Nota fiscal'),
      renderizar: (e) => (
        <Link to={`/notas-entrada/${e.nota_id}`} className="font-mono text-brand hover:underline">
          NF {e.numero}/{e.serie}
        </Link>
      ),
    },
    { chave: 'fornecedor', rotulo: t('Fornecedor'), renderizar: (e) => e.fornecedor_nome },
    { chave: 'entrada', rotulo: t('Entrada'), renderizar: (e) => formatarData(e.data_entrada) },
    { chave: 'quantidade', rotulo: t('Quantidade'), alinhamento: 'direita', renderizar: (e) => e.quantidade },
    ...(temCusto
      ? [
          {
            chave: 'custo',
            rotulo: t('Custo unitário'),
            alinhamento: 'direita' as const,
            renderizar: (e: EntradaNF) => (e.custo_unitario != null ? formatarMoeda(e.custo_unitario) : '—'),
          },
        ]
      : []),
  ];

  const colunasConsumos: Coluna<ConsumoOP>[] = [
    {
      chave: 'op',
      rotulo: t('Ordem de produção'),
      renderizar: (c) => (
        <Link to={`/producao/ops/${c.ordem_producao_id}`} className="font-mono text-brand hover:underline">
          {c.numero_op}
        </Link>
      ),
    },
    { chave: 'produto', rotulo: t('Produto'), renderizar: (c) => <span className="font-mono">{c.produto_codigo}</span> },
    { chave: 'quantidade', rotulo: t('Quantidade consumida'), alinhamento: 'direita', renderizar: (c) => c.quantidade },
  ];

  const colunasUnidades: Coluna<UnidadeAfetada>[] = [
    {
      chave: 'serie',
      rotulo: t('Unidade (série)'),
      renderizar: (u) => (
        <Link to={`/rastreabilidade/${encodeURIComponent(u.numero)}`} className="font-mono text-brand hover:underline">
          {u.numero}
        </Link>
      ),
    },
    { chave: 'produto', rotulo: t('Produto'), renderizar: (u) => <span className="font-mono">{u.produto_codigo}</span> },
    { chave: 'op', rotulo: t('OP'), renderizar: (u) => <span className="font-mono">{u.numero_op}</span> },
    {
      chave: 'pedido',
      rotulo: t('Pedido de venda'),
      renderizar: (u) => (
        <Link to={`/pedidos-venda/${u.pedido_venda_id}`} className="font-mono text-brand hover:underline">
          {u.numero_pedido}
        </Link>
      ),
    },
    { chave: 'cliente', rotulo: t('Cliente'), renderizar: (u) => u.cliente_nome },
    { chave: 'status', rotulo: t('Situação'), renderizar: (u) => td(u.status) },
    {
      chave: 'vinculo',
      rotulo: t('Vínculo'),
      renderizar: (u) =>
        u.direta ? (
          <Badge tom="pending" icone="link">
            {t('Direta — série instalada')}
          </Badge>
        ) : (
          <Badge tom="neutral" icone="factory">
            {t('Pela OP')}
          </Badge>
        ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link to="/lotes" className="text-label text-brand hover:underline">
          {t('Lotes')}
        </Link>
        <p className="text-label text-texto-secondary">{t('Rastreabilidade do lote — do lote ao campo')}</p>
        <h1 className="font-mono text-display text-texto-primary">{lote.numero_lote}</h1>
        <p className="text-body text-texto-primary">
          <span className="font-mono">{lote.peca_codigo}</span> — {lote.peca_descricao}
        </p>
        <SeloValidadeLote validade={lote.validade} vencido={lote.vencido} />
      </div>

      <dl className="grid gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-4 md:grid-cols-4">
        <Dado rotulo={t('Fornecedor')}>{lote.fornecedor_nome || '—'}</Dado>
        <Dado rotulo={t('Fabricação')}>{formatarData(lote.data_fabricacao ?? undefined)}</Dado>
        <Dado rotulo={t('Validade')}>{formatarData(lote.validade ?? undefined)}</Dado>
        <Dado rotulo={t('Saldo / reservado')}>
          <span className="tabular">
            {lote.quantidade_atual} / {lote.quantidade_reservada}
          </span>
        </Dado>
      </dl>

      <Bloco titulo={t('Entradas')} descricao={t('Notas fiscais que trouxeram este lote.')}>
        <Tabela<EntradaNF>
          rotulo={t('Entradas do lote')}
          colunas={colunasEntradas}
          itens={entradas ?? []}
          chaveDe={(e) => `${e.nota_id}-${e.numero_lote ?? ''}`}
          ordenarPor="entrada"
          ordem="asc"
          aoOrdenar={() => {}}
          vazio={t('Nenhuma nota fiscal: o lote entrou por ajuste de estoque.')}
        />
      </Bloco>

      <Bloco titulo={t('Consumo em ordens de produção')} descricao={t('OPs que consumiram material deste lote.')}>
        <Tabela<ConsumoOP>
          rotulo={t('Consumos do lote')}
          colunas={colunasConsumos}
          itens={consumos ?? []}
          chaveDe={(c) => c.ordem_producao_id}
          ordenarPor="op"
          ordem="asc"
          aoOrdenar={() => {}}
          vazio={t('O lote ainda não foi consumido em produção.')}
        />
      </Bloco>

      <Bloco
        titulo={t('Unidades produzidas')}
        descricao={t('Equipamentos que podem conter este lote, com pedido e cliente. "Direta": a série do componente está instalada na unidade.')}
      >
        <Tabela<UnidadeAfetada>
          rotulo={t('Unidades produzidas com o lote')}
          colunas={colunasUnidades}
          itens={unidades ?? []}
          chaveDe={(u) => u.serie_id}
          ordenarPor="serie"
          ordem="asc"
          aoOrdenar={() => {}}
          vazio={t('Nenhuma unidade produzida com este lote até agora.')}
        />
      </Bloco>
    </div>
  );
}
