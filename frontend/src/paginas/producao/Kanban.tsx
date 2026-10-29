import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Miniatura } from '@/componentes/arquivos/Miniatura';
import { SeloAtraso } from '@/componentes/producao/Selos';
import { Botao } from '@/componentes/ui/Botao';
import { icones } from '@/componentes/ui/icones';
import { t, td, useIdioma } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatarData, formatarDataHora } from '@/lib/formato';
import { ErroApi } from '@/servicos/api';
import { listarKanban } from '@/servicos/producao';
import { ETAPAS_OP, ROTULO_ETAPA_OP, hojeAAAAMMDD, opAtrasada, type EtapaOP, type OrdemProducao } from '@/tipos/producao';

/** Quadro atualiza sozinho: e a tela que fica aberta no galpao. */
const INTERVALO_KANBAN_MS = 30_000;

function agrupar(ops: OrdemProducao[]): Record<EtapaOP, OrdemProducao[]> {
  const grupos = Object.fromEntries(ETAPAS_OP.map((e) => [e, [] as OrdemProducao[]])) as Record<EtapaOP, OrdemProducao[]>;
  for (const op of ops) {
    (grupos[op.etapa_atual] ?? grupos.Separacao).push(op);
  }
  return grupos;
}

export function Kanban() {
  useIdioma();
  const consulta = useQuery({
    queryKey: ['kanban'],
    queryFn: listarKanban,
    refetchInterval: INTERVALO_KANBAN_MS,
  });
  const hoje = hojeAAAAMMDD();
  const IconeFalha = icones['alert-triangle'];

  const grupos = agrupar(consulta.data ?? []);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title text-texto-primary">{t('Kanban de produção')}</h1>
          <p className="text-body text-texto-secondary">
            {t('OPs liberadas por etapa. O quadro se atualiza a cada 30 segundos.')}
            {consulta.dataUpdatedAt > 0 &&
              ` ${t('Última atualização: {data}.', { data: formatarDataHora(new Date(consulta.dataUpdatedAt).toISOString()) })}`}
          </p>
        </div>
        <Botao variante="secundaria" icone="refresh-cw" ocupado={consulta.isFetching} rotuloOcupado={t('Atualizando…')} onClick={() => void consulta.refetch()}>
          {t('Atualizar')}
        </Botao>
      </div>

      {consulta.isError && (
        <p role="alert" className="flex items-center gap-2 rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
          <IconeFalha size={16} aria-hidden="true" />
          {consulta.error instanceof ErroApi ? consulta.error.message : t('Não foi possível carregar o Kanban. Tente de novo.')}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ETAPAS_OP.map((etapa) => (
          <section
            key={etapa}
            aria-label={t('Etapa {nome}', { nome: td(ROTULO_ETAPA_OP[etapa]) })}
            className="flex flex-col gap-2 rounded-cartao border border-borda-subtle bg-surface-sunken p-3"
          >
            <h2 className="flex items-center justify-between text-subtitle text-texto-primary">
              {td(ROTULO_ETAPA_OP[etapa])}
              <span className="font-mono text-label tabular text-texto-secondary">
                {grupos[etapa].length === 1 ? t('1 OP') : t('{n} OPs', { n: grupos[etapa].length })}
              </span>
            </h2>
            {consulta.isPending ? (
              <div aria-hidden="true" className="h-[6rem] animate-pulse rounded-cartao bg-surface-raised" />
            ) : grupos[etapa].length === 0 ? (
              <p className="text-label text-texto-secondary">{t('Nenhuma OP nesta etapa.')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {grupos[etapa].map((op) => (
                  <li key={op.id}>
                    <CartaoOP op={op} atrasada={opAtrasada(op, hoje)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function CartaoOP({ op, atrasada }: { op: OrdemProducao; atrasada: boolean }) {
  useIdioma();
  const IconeOperador = icones.wrench;
  const ap = op.apontamento_aberto;
  return (
    <Link
      to={`/producao/ops/${op.id}`}
      aria-label={t('OP {numero}', { numero: op.numero_op })}
      className={cn(
        'flex flex-col gap-1 rounded-cartao border border-borda-subtle border-l-[3px] bg-surface-raised p-3 hover:bg-brand-subtle',
        atrasada ? 'border-l-estado-warning' : ap ? 'border-l-brand' : 'border-l-borda-strong',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-body font-medium text-texto-primary">{op.numero_op}</span>
        <span className="font-mono text-label tabular text-texto-secondary">{t('{n} un.', { n: op.quantidade })}</span>
      </span>
      <span className="flex items-center gap-2 text-body text-texto-primary">
        <Miniatura url={op.produto_foto_url} alt={t('Foto do produto {codigo}', { codigo: op.produto_codigo })} />
        <span>
          <span className="font-mono">{op.produto_codigo}</span> — {op.produto_descricao}
        </span>
      </span>
      <span className="text-label text-texto-secondary">
        {op.cliente_nome} · {t('Pedido')} <span className="font-mono">{op.numero_pedido}</span>
      </span>
      <span className="flex flex-wrap items-center gap-2 text-label text-texto-secondary">
        {t('Prazo')} {formatarData(op.data_conclusao_prevista)}
        {atrasada && <SeloAtraso>{t('Atrasada')}</SeloAtraso>}
      </span>
      {ap ? (
        <span className="flex items-center gap-1 text-label text-brand">
          <IconeOperador size={12} aria-hidden="true" />
          {t('Em apontamento:')} {ap.operador_nome} · {ap.centro_codigo}
        </span>
      ) : (
        <span className="text-label text-texto-secondary">{t('Ninguém apontando agora')}</span>
      )}
    </Link>
  );
}
