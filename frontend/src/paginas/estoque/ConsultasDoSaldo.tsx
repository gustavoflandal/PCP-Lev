import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { mensagemDeErro } from '@/componentes/arquivos/comum';
import { SeloValidadeLote } from '@/componentes/recebimento/Selos';
import { marcar, t, td } from '@/i18n';
import { Modal } from '@/componentes/ui/Modal';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { formatarData, formatarDataHora, formatarMoeda } from '@/lib/formato';
import { obterKardex, obterOrigensSaldo } from '@/servicos/rastreio';
import type { SaldoEstoque } from '@/tipos/estoque';
import type { EntradaNF, Lote, MovimentoKardex, TipoDocumentoKardex } from '@/tipos/rastreio';

const ROTA_DOCUMENTO: Partial<Record<TipoDocumentoKardex, string>> = {
  NOTA_ENTRADA: '/notas-entrada',
  ORDEM_PRODUCAO: '/producao/ops',
  PEDIDO_VENDA: '/pedidos-venda',
};

const NOME_DOCUMENTO: Record<TipoDocumentoKardex, string> = {
  NOTA_ENTRADA: marcar('Nota fiscal'),
  ORDEM_PRODUCAO: marcar('OP'),
  PEDIDO_VENDA: marcar('Pedido de venda'),
  AJUSTE: marcar('Ajuste'),
};

/** Documento de origem do movimento, clicavel quando tem tela (4.4). */
function Documento({ m }: { m: MovimentoKardex }) {
  if (!m.documento_tipo) return <>{m.referencia ?? '—'}</>;
  const nome = td(NOME_DOCUMENTO[m.documento_tipo] ?? m.documento_tipo);
  const rotulo = m.referencia ? `${nome} ${m.referencia}` : nome;
  const rota = ROTA_DOCUMENTO[m.documento_tipo];
  if (!rota || !m.documento_id) return <>{rotulo}</>;
  return (
    <Link to={`${rota}/${m.documento_id}`} className="text-brand hover:underline">
      {rotulo}
    </Link>
  );
}

export interface ConsultaDoSaldoProps {
  item: SaldoEstoque;
  aoFechar: () => void;
}

/** Kardex: cada movimento da peca com o saldo depois dele e o documento de origem. */
export function KardexDaPeca({ item, aoFechar }: ConsultaDoSaldoProps) {
  const consulta = useQuery({ queryKey: ['estoque', item.parte_peca_id, 'kardex'], queryFn: () => obterKardex(item.parte_peca_id) });
  const movimentos = consulta.data ?? [];
  const temCusto = movimentos.some((m) => m.custo_unitario != null);

  const colunas: Coluna<MovimentoKardex>[] = [
    { chave: 'data', rotulo: t('Data'), renderizar: (m) => formatarDataHora(m.data_hora) },
    { chave: 'tipo', rotulo: t('Tipo'), renderizar: (m) => td(m.tipo) },
    { chave: 'motivo', rotulo: t('Motivo'), renderizar: (m) => td(m.motivo) || '—' },
    {
      chave: 'quantidade',
      rotulo: t('Quantidade'),
      alinhamento: 'direita',
      renderizar: (m) => (m.quantidade > 0 ? `+${m.quantidade}` : String(m.quantidade)),
    },
    { chave: 'saldo', rotulo: t('Saldo após'), alinhamento: 'direita', renderizar: (m) => m.saldo },
    { chave: 'lote', rotulo: t('Lote'), renderizar: (m) => (m.numero_lote ? <span className="font-mono">{m.numero_lote}</span> : '—') },
    { chave: 'documento', rotulo: t('Documento'), renderizar: (m) => <Documento m={m} /> },
    ...(temCusto
      ? [
          {
            chave: 'custo',
            rotulo: t('Custo unitário'),
            alinhamento: 'direita' as const,
            renderizar: (m: MovimentoKardex) => (m.custo_unitario != null ? formatarMoeda(m.custo_unitario) : '—'),
          },
        ]
      : []),
    { chave: 'usuario', rotulo: t('Usuário'), renderizar: (m) => m.usuario ?? '—' },
  ];

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo={t('Kardex — {codigo}', { codigo: item.codigo })}
      descricao={t('{descricao} · saldo atual {saldo}. Movimentos mais recentes primeiro (até 200).', {
        descricao: item.descricao,
        saldo: item.quantidade_atual,
      })}
    >
      <Tabela<MovimentoKardex>
        rotulo={t('Kardex de {codigo}', { codigo: item.codigo })}
        colunas={colunas}
        itens={movimentos}
        chaveDe={(m) => m.id}
        ordenarPor="data"
        ordem="desc"
        aoOrdenar={() => {}}
        carregando={consulta.isPending}
        erro={consulta.isError ? mensagemDeErro(consulta.error, t('Não foi possível carregar o kardex.')) : null}
        aoTentarDeNovo={() => void consulta.refetch()}
        vazio={t('Nenhuma movimentação registrada para esta peça.')}
      />
    </Modal>
  );
}

/** Origem do saldo: os lotes que o compoem, as notas que o cobrem e o que ficou sem documento. */
export function OrigemDoSaldo({ item, aoFechar }: ConsultaDoSaldoProps) {
  const consulta = useQuery({ queryKey: ['estoque', item.parte_peca_id, 'origens'], queryFn: () => obterOrigensSaldo(item.parte_peca_id) });
  const dados = consulta.data;
  const temCusto = (dados?.entradas ?? []).some((e) => e.custo_unitario != null);

  const colunasLotes: Coluna<Lote>[] = [
    {
      chave: 'lote',
      rotulo: t('Lote'),
      renderizar: (l) => (
        <Link to={`/lotes/${l.id}`} className="font-mono text-brand hover:underline">
          {l.numero_lote}
        </Link>
      ),
    },
    { chave: 'fornecedor', rotulo: t('Fornecedor'), renderizar: (l) => l.fornecedor_nome || '—' },
    {
      chave: 'validade',
      rotulo: t('Validade'),
      renderizar: (l) => (
        <span className="flex flex-wrap items-center gap-2">
          {formatarData(l.validade ?? undefined)} <SeloValidadeLote validade={l.validade} vencido={l.vencido} />
        </span>
      ),
    },
    { chave: 'saldo', rotulo: t('Saldo'), alinhamento: 'direita', renderizar: (l) => l.quantidade_atual },
    { chave: 'reservado', rotulo: t('Reservado'), alinhamento: 'direita', renderizar: (l) => l.quantidade_reservada },
  ];

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
    { chave: 'lote', rotulo: t('Lote'), renderizar: (e) => (e.numero_lote ? <span className="font-mono">{e.numero_lote}</span> : '—') },
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

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo={t('Origem do saldo — {codigo}', { codigo: item.codigo })}
      descricao={t('{descricao}: de quais lotes e notas fiscais vem o saldo atual.', { descricao: item.descricao })}
    >
      {consulta.isPending ? (
        <p className="text-body text-texto-secondary">{t('Carregando a origem do saldo…')}</p>
      ) : consulta.isError || !dados ? (
        <p role="alert" className="text-body text-estado-pending">
          {mensagemDeErro(consulta.error, t('Não foi possível carregar a origem do saldo.'))}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-body text-texto-primary">
            {t('Saldo atual:')} <span className="font-mono text-dado-lg tabular">{dados.saldo}</span>
          </p>
          {dados.sem_origem > 0 && (
            <p role="status" className="rounded-campo border border-estado-warning bg-estado-warning-bg px-3 py-2 text-body text-estado-warning">
              {t('{n} unidade(s) do saldo sem documento de origem (saldo anterior ao recebimento fiscal ou ajuste sem nota).', {
                n: dados.sem_origem,
              })}
            </p>
          )}
          {(dados.lotes ?? []).length > 0 && (
            <section aria-label={t('Lotes com saldo')} className="flex flex-col gap-2">
              <h3 className="text-subtitle text-texto-primary">{t('Lotes com saldo')}</h3>
              <Tabela<Lote>
                rotulo={t('Lotes com saldo')}
                colunas={colunasLotes}
                itens={dados.lotes ?? []}
                chaveDe={(l) => l.id}
                ordenarPor="validade"
                ordem="asc"
                aoOrdenar={() => {}}
                vazio={t('Nenhum lote com saldo.')}
              />
            </section>
          )}
          <section aria-label={t('Notas que cobrem o saldo')} className="flex flex-col gap-2">
            <h3 className="text-subtitle text-texto-primary">{t('Notas fiscais que cobrem o saldo')}</h3>
            <Tabela<EntradaNF>
              rotulo={t('Notas que cobrem o saldo')}
              colunas={colunasEntradas}
              itens={dados.entradas ?? []}
              chaveDe={(e) => `${e.nota_id}-${e.numero_lote ?? ''}`}
              ordenarPor="entrada"
              ordem="desc"
              aoOrdenar={() => {}}
              vazio={t('Nenhuma nota fiscal cobre o saldo atual.')}
            />
          </section>
        </div>
      )}
    </Modal>
  );
}
