import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { mensagemDeErro } from '@/componentes/arquivos/comum';
import { SeloValidadeLote } from '@/componentes/recebimento/Selos';
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
  NOTA_ENTRADA: 'Nota fiscal',
  ORDEM_PRODUCAO: 'OP',
  PEDIDO_VENDA: 'Pedido de venda',
  AJUSTE: 'Ajuste',
};

/** Documento de origem do movimento, clicavel quando tem tela (4.4). */
function Documento({ m }: { m: MovimentoKardex }) {
  if (!m.documento_tipo) return <>{m.referencia ?? '—'}</>;
  const nome = NOME_DOCUMENTO[m.documento_tipo] ?? m.documento_tipo;
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
    { chave: 'data', rotulo: 'Data', renderizar: (m) => formatarDataHora(m.data_hora) },
    { chave: 'tipo', rotulo: 'Tipo', renderizar: (m) => m.tipo },
    { chave: 'motivo', rotulo: 'Motivo', renderizar: (m) => m.motivo || '—' },
    {
      chave: 'quantidade',
      rotulo: 'Quantidade',
      alinhamento: 'direita',
      renderizar: (m) => (m.quantidade > 0 ? `+${m.quantidade}` : String(m.quantidade)),
    },
    { chave: 'saldo', rotulo: 'Saldo após', alinhamento: 'direita', renderizar: (m) => m.saldo },
    { chave: 'lote', rotulo: 'Lote', renderizar: (m) => (m.numero_lote ? <span className="font-mono">{m.numero_lote}</span> : '—') },
    { chave: 'documento', rotulo: 'Documento', renderizar: (m) => <Documento m={m} /> },
    ...(temCusto
      ? [
          {
            chave: 'custo',
            rotulo: 'Custo unitário',
            alinhamento: 'direita' as const,
            renderizar: (m: MovimentoKardex) => (m.custo_unitario != null ? formatarMoeda(m.custo_unitario) : '—'),
          },
        ]
      : []),
    { chave: 'usuario', rotulo: 'Usuário', renderizar: (m) => m.usuario ?? '—' },
  ];

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo={`Kardex — ${item.codigo}`}
      descricao={`${item.descricao} · saldo atual ${item.quantidade_atual}. Movimentos mais recentes primeiro (até 200).`}
    >
      <Tabela<MovimentoKardex>
        rotulo={`Kardex de ${item.codigo}`}
        colunas={colunas}
        itens={movimentos}
        chaveDe={(m) => m.id}
        ordenarPor="data"
        ordem="desc"
        aoOrdenar={() => {}}
        carregando={consulta.isPending}
        erro={consulta.isError ? mensagemDeErro(consulta.error, 'Não foi possível carregar o kardex.') : null}
        aoTentarDeNovo={() => void consulta.refetch()}
        vazio="Nenhuma movimentação registrada para esta peça."
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
      rotulo: 'Lote',
      renderizar: (l) => (
        <Link to={`/lotes/${l.id}`} className="font-mono text-brand hover:underline">
          {l.numero_lote}
        </Link>
      ),
    },
    { chave: 'fornecedor', rotulo: 'Fornecedor', renderizar: (l) => l.fornecedor_nome || '—' },
    {
      chave: 'validade',
      rotulo: 'Validade',
      renderizar: (l) => (
        <span className="flex flex-wrap items-center gap-2">
          {formatarData(l.validade ?? undefined)} <SeloValidadeLote validade={l.validade} vencido={l.vencido} />
        </span>
      ),
    },
    { chave: 'saldo', rotulo: 'Saldo', alinhamento: 'direita', renderizar: (l) => l.quantidade_atual },
    { chave: 'reservado', rotulo: 'Reservado', alinhamento: 'direita', renderizar: (l) => l.quantidade_reservada },
  ];

  const colunasEntradas: Coluna<EntradaNF>[] = [
    {
      chave: 'nota',
      rotulo: 'Nota fiscal',
      renderizar: (e) => (
        <Link to={`/notas-entrada/${e.nota_id}`} className="font-mono text-brand hover:underline">
          NF {e.numero}/{e.serie}
        </Link>
      ),
    },
    { chave: 'fornecedor', rotulo: 'Fornecedor', renderizar: (e) => e.fornecedor_nome },
    { chave: 'entrada', rotulo: 'Entrada', renderizar: (e) => formatarData(e.data_entrada) },
    { chave: 'lote', rotulo: 'Lote', renderizar: (e) => (e.numero_lote ? <span className="font-mono">{e.numero_lote}</span> : '—') },
    { chave: 'quantidade', rotulo: 'Quantidade', alinhamento: 'direita', renderizar: (e) => e.quantidade },
    ...(temCusto
      ? [
          {
            chave: 'custo',
            rotulo: 'Custo unitário',
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
      titulo={`Origem do saldo — ${item.codigo}`}
      descricao={`${item.descricao}: de quais lotes e notas fiscais vem o saldo atual.`}
    >
      {consulta.isPending ? (
        <p className="text-body text-texto-secondary">Carregando a origem do saldo…</p>
      ) : consulta.isError || !dados ? (
        <p role="alert" className="text-body text-estado-pending">
          {mensagemDeErro(consulta.error, 'Não foi possível carregar a origem do saldo.')}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-body text-texto-primary">
            Saldo atual: <span className="font-mono text-dado-lg tabular">{dados.saldo}</span>
          </p>
          {dados.sem_origem > 0 && (
            <p role="status" className="rounded-campo border border-estado-warning bg-estado-warning-bg px-3 py-2 text-body text-estado-warning">
              {`${dados.sem_origem} unidade(s) do saldo sem documento de origem (saldo anterior ao recebimento fiscal ou ajuste sem nota).`}
            </p>
          )}
          {(dados.lotes ?? []).length > 0 && (
            <section aria-label="Lotes com saldo" className="flex flex-col gap-2">
              <h3 className="text-subtitle text-texto-primary">Lotes com saldo</h3>
              <Tabela<Lote>
                rotulo="Lotes com saldo"
                colunas={colunasLotes}
                itens={dados.lotes ?? []}
                chaveDe={(l) => l.id}
                ordenarPor="validade"
                ordem="asc"
                aoOrdenar={() => {}}
                vazio="Nenhum lote com saldo."
              />
            </section>
          )}
          <section aria-label="Notas que cobrem o saldo" className="flex flex-col gap-2">
            <h3 className="text-subtitle text-texto-primary">Notas fiscais que cobrem o saldo</h3>
            <Tabela<EntradaNF>
              rotulo="Notas que cobrem o saldo"
              colunas={colunasEntradas}
              itens={dados.entradas ?? []}
              chaveDe={(e) => `${e.nota_id}-${e.numero_lote ?? ''}`}
              ordenarPor="entrada"
              ordem="desc"
              aoOrdenar={() => {}}
              vazio="Nenhuma nota fiscal cobre o saldo atual."
            />
          </section>
        </div>
      )}
    </Modal>
  );
}
