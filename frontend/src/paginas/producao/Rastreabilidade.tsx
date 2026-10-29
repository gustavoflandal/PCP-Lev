import { useQueries, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from '@/componentes/producao/QRCodeSVG';
import { BadgeStatusSerie, NomeEtapa } from '@/componentes/producao/Selos';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { icones } from '@/componentes/ui/icones';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { t, td, useIdioma } from '@/i18n';
import { formatarData, formatarDataHora } from '@/lib/formato';
import { ErroApi } from '@/servicos/api';
import { obterUrlArquivo } from '@/servicos/arquivos';
import { obterFichaAsBuilt } from '@/servicos/producao';
import type { Apontamento, ComponenteBOM, DocumentoOP, LoteConsumido, SerieComponente } from '@/tipos/producao';

/** Campo para digitar ou bipar o numero de serie (leitor de codigo age como teclado + Enter). */
function BuscaSerie({ inicial = '' }: { inicial?: string }) {
  useIdioma();
  const navegar = useNavigate();
  const [numero, definirNumero] = useState(inicial);
  const [erro, definirErro] = useState<string | undefined>();

  function abrir(evento: FormEvent) {
    evento.preventDefault();
    const valor = numero.trim().toUpperCase();
    if (valor === '') {
      definirErro(t('Digite ou bipe o número de série da unidade'));
      return;
    }
    navegar(`/rastreabilidade/${encodeURIComponent(valor)}`);
  }

  return (
    <form onSubmit={abrir} noValidate className="flex flex-wrap items-end gap-2">
      <div className="w-[360px] max-w-full">
        <Campo
          rotulo={t('Número de série')}
          tipoDado="codigo"
          ajuda={t('Ex.: RAD-200-2026-00001')}
          erro={erro}
          value={numero}
          autoFocus
          onChange={(e) => {
            definirNumero(e.target.value);
            definirErro(undefined);
          }}
        />
      </div>
      <Botao type="submit" icone="search" className="mb-[1.25rem]">
        {t('Abrir ficha')}
      </Botao>
    </form>
  );
}

/** /rastreabilidade — so a busca. */
export function BuscaRastreabilidade() {
  useIdioma();
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Rastreabilidade')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Digite ou bipe o número de série de uma unidade para ver a ficha as-built: como e por quem ela foi produzida, e de quais lotes e notas vieram os componentes.')}
        </p>
      </div>
      <BuscaSerie />
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-2">
      <h2 className="text-subtitle text-texto-primary">{titulo}</h2>
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

/** URLs assinadas vivem 5 minutos: renovadas antes de expirar. */
const RENOVAR_URLS_MS = 4 * 60_000;

const ESTILO_LINK_ACAO =
  'inline-flex h-[2.5rem] items-center gap-2 rounded-campo border border-borda-strong bg-surface-raised px-4 text-body font-medium text-texto-primary hover:bg-surface-sunken';

/**
 * Laudos de teste e relatorios de inspecao da OP (Fase 3.1). A ficha traz so
 * o id do arquivo: a URL assinada de cada um vem de /arquivos/:id/url.
 */
function LaudosEInspecoes({ documentos }: { documentos: DocumentoOP[] }) {
  useIdioma();
  const urls = useQueries({
    queries: documentos.map((d) => ({
      queryKey: ['arquivos', d.arquivo_id, 'url'],
      queryFn: () => obterUrlArquivo(d.arquivo_id),
      staleTime: RENOVAR_URLS_MS,
      refetchInterval: RENOVAR_URLS_MS,
    })),
  });
  const IconeArquivo = icones['file-text'];
  const IconeAbrir = icones['external-link'];

  if (documentos.length === 0) {
    return (
      <p className="rounded-cartao border border-borda-subtle bg-surface-raised p-4 text-body text-texto-secondary">
        {t('Nenhum laudo de teste ou relatório de inspeção anexado à OP desta unidade.')}
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-borda-subtle rounded-cartao border border-borda-subtle bg-surface-raised">
      {documentos.map((d, i) => {
        const nome = d.titulo || d.nome_arquivo;
        const url = urls[i];
        return (
          <li key={d.anexo_id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
            <div className="flex min-w-0 items-start gap-3">
              <IconeArquivo size={20} aria-hidden="true" className="mt-[2px] shrink-0 text-texto-secondary" />
              <div className="flex min-w-0 flex-col">
                <span className="text-label text-texto-secondary">{td(d.categoria)}</span>
                <span className="text-body text-texto-primary">{nome}</span>
                <span className="text-label text-texto-secondary">
                  <span className="font-mono">{d.nome_arquivo}</span>
                  {d.data_emissao ? ` · ${t('emissão {data}', { data: formatarData(d.data_emissao) })}` : ''} · {t('anexado em {data}', { data: formatarDataHora(d.created_at) })}
                </span>
              </div>
            </div>
            {url?.data ? (
              <a href={url.data.url} target="_blank" rel="noopener noreferrer" aria-label={t('Abrir {nome}', { nome })} className={ESTILO_LINK_ACAO}>
                <IconeAbrir size={16} aria-hidden="true" />
                {t('Abrir')}
              </a>
            ) : url?.isError ? (
              <span className="text-label text-estado-pending">
                {url.error instanceof ErroApi ? url.error.message : t('Não foi possível obter o link do arquivo.')}
              </span>
            ) : (
              <span className="text-label text-texto-secondary">{t('Preparando link…')}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** /rastreabilidade/:numero — ficha as-built com QR Code da propria URL. */
export function FichaRastreabilidade() {
  useIdioma();
  const { numero = '' } = useParams<{ numero: string }>();
  const consulta = useQuery({
    queryKey: ['rastreabilidade', numero],
    queryFn: () => obterFichaAsBuilt(numero),
    retry: false,
  });

  if (consulta.isPending) {
    return <p className="text-body text-texto-secondary">{t('Carregando ficha…')}</p>;
  }
  if (consulta.isError || !consulta.data) {
    const naoAchou = consulta.error instanceof ErroApi && consulta.error.status === 404;
    return (
      <div className="mx-auto flex max-w-[900px] flex-col gap-4">
        <h1 className="text-title text-texto-primary">{t('Rastreabilidade')}</h1>
        <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
          {naoAchou
            ? t('Número de série {numero} não encontrado. Confira o número na etiqueta e tente de novo.', { numero })
            : t('Não foi possível carregar a ficha. Tente de novo.')}
        </p>
        <BuscaSerie inicial={numero} />
      </div>
    );
  }

  const { serie, ordem_producao: op, componentes, apontamentos, historico } = consulta.data;
  const urlFicha = `${window.location.origin}/rastreabilidade/${encodeURIComponent(serie.numero)}`;

  const colunasComponentes: Coluna<ComponenteBOM>[] = [
    { chave: 'codigo', rotulo: t('Código'), renderizar: (c) => <span className="font-mono">{c.codigo}</span> },
    { chave: 'descricao', rotulo: t('Descrição'), renderizar: (c) => c.descricao },
    {
      chave: 'quantidade',
      rotulo: t('Qtd. por unidade'),
      alinhamento: 'direita',
      renderizar: (c) => <span className="tabular">{c.quantidade_por_unidade}</span>,
    },
  ];

  const colunasSeries: Coluna<SerieComponente>[] = [
    {
      chave: 'peca',
      rotulo: t('Componente'),
      renderizar: (s) => (
        <span>
          <span className="font-mono">{s.peca_codigo}</span> {s.peca_descricao}
        </span>
      ),
    },
    { chave: 'serie', rotulo: t('Série'), renderizar: (s) => <span className="font-mono">{s.numero}</span> },
    { chave: 'lote', rotulo: t('Lote'), renderizar: (s) => (s.numero_lote ? <span className="font-mono">{s.numero_lote}</span> : '—') },
    {
      chave: 'nota',
      rotulo: t('Nota fiscal'),
      renderizar: (s) =>
        s.nota_id ? (
          <Link to={`/notas-entrada/${s.nota_id}`} className="font-mono text-brand hover:underline">
            {s.nota ? `NF ${s.nota}` : t('Ver nota')}
          </Link>
        ) : (
          (s.nota ?? '—')
        ),
    },
    { chave: 'fornecedor', rotulo: t('Fornecedor'), renderizar: (s) => s.fornecedor_nome || '—' },
    { chave: 'entrada', rotulo: t('Entrada'), renderizar: (s) => formatarData(s.data_entrada ?? undefined) },
  ];

  const colunasLotes: Coluna<LoteConsumido>[] = [
    {
      chave: 'lote',
      rotulo: t('Lote'),
      renderizar: (l) => (
        <Link to={`/lotes/${l.lote_id}`} className="font-mono text-brand hover:underline">
          {l.numero_lote}
        </Link>
      ),
    },
    { chave: 'peca', rotulo: t('Componente'), renderizar: (l) => <span className="font-mono">{l.peca_codigo}</span> },
    { chave: 'validade', rotulo: t('Validade'), renderizar: (l) => formatarData(l.validade ?? undefined) },
    { chave: 'quantidade', rotulo: t('Quantidade'), alinhamento: 'direita', renderizar: (l) => l.quantidade },
    { chave: 'notas', rotulo: t('Notas fiscais'), renderizar: (l) => l.notas || '—' },
    { chave: 'fornecedor', rotulo: t('Fornecedor'), renderizar: (l) => l.fornecedor_nome || '—' },
  ];

  const colunasApontamentos: Coluna<Apontamento>[] = [
    { chave: 'etapa', rotulo: t('Etapa'), renderizar: (a) => <NomeEtapa etapa={a.etapa} /> },
    { chave: 'operador', rotulo: t('Operador'), renderizar: (a) => a.operador_nome || '—' },
    {
      chave: 'centro',
      rotulo: t('Centro de trabalho'),
      renderizar: (a) => (
        <span>
          <span className="font-mono">{a.centro_codigo}</span> {a.centro_nome}
        </span>
      ),
    },
    { chave: 'inicio', rotulo: t('Início'), renderizar: (a) => formatarDataHora(a.inicio) },
    { chave: 'fim', rotulo: t('Fim'), renderizar: (a) => (a.fim ? formatarDataHora(a.fim) : t('em andamento')) },
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-label text-texto-secondary">{t('Ficha as-built')}</p>
          <h1 className="font-mono text-display text-texto-primary">{serie.numero}</h1>
          <p className="text-body text-texto-primary">
            <span className="font-mono">{op.produto_codigo}</span> — {op.produto_descricao}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <BadgeStatusSerie status={serie.status} />
            {op.exige_metrologia && (
              <Badge tom="blocked" icone="gauge">
                {t('Exige metrologia')}
              </Badge>
            )}
          </div>
        </div>
        <figure className="flex flex-col items-center gap-1">
          <QRCodeSVG valor={urlFicha} rotulo={t('QR Code da ficha da unidade {numero}', { numero: serie.numero })} />
          <figcaption className="text-label text-texto-secondary">{t('Aponte a câmera para abrir esta ficha')}</figcaption>
        </figure>
      </div>

      <dl className="grid gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-4 md:grid-cols-3">
        <Dado rotulo={t('Ordem de produção')}>
          <Link to={`/producao/ops/${op.id}`} className="font-mono text-brand hover:underline">
            {op.numero_op}
          </Link>{' '}
          · {t('BOM versão {versao}', { versao: op.estrutura_versao })}
        </Dado>
        <Dado rotulo={t('Pedido de venda')}>
          <Link to={`/pedidos-venda/${op.pedido_venda_id}`} className="font-mono text-brand hover:underline">
            {op.numero_pedido}
          </Link>{' '}
          {t('de {data}', { data: formatarData(consulta.data.data_pedido) })}
        </Dado>
        <Dado rotulo={t('Cliente')}>{op.cliente_nome}</Dado>
        <Dado rotulo={t('Liberação')}>{op.data_liberacao ? formatarDataHora(op.data_liberacao) : '—'}</Dado>
        <Dado rotulo={t('Conclusão')}>{op.data_conclusao_real ? formatarData(op.data_conclusao_real) : '—'}</Dado>
        <Dado rotulo={t('Expedição')}>{serie.expedido_em ? formatarDataHora(serie.expedido_em) : '—'}</Dado>
      </dl>

      <div className="grid gap-4 md:grid-cols-2">
        <Bloco titulo={t('Teste')}>
          <dl className="flex flex-col gap-2 rounded-cartao border border-borda-subtle bg-surface-raised p-4">
            <Dado rotulo={t('Resultado')}>{serie.resultado_teste || '—'}</Dado>
            <Dado rotulo={t('Testado por')}>
              {serie.testado_por ? `${serie.testado_por}${serie.testado_em ? ` · ${formatarDataHora(serie.testado_em)}` : ''}` : '—'}
            </Dado>
          </dl>
        </Bloco>
        <Bloco titulo={t('Metrologia')}>
          {serie.metrologia ? (
            <dl className="grid gap-2 rounded-cartao border border-borda-subtle bg-surface-raised p-4 md:grid-cols-2">
              <Dado rotulo={t('Aprovação de modelo (Inmetro)')}>
                <span className="font-mono">{serie.metrologia.numero_aprovacao_modelo}</span>
              </Dado>
              <Dado rotulo={t('Lacre')}>
                <span className="font-mono">{serie.metrologia.numero_lacre}</span>
              </Dado>
              <Dado rotulo={t('Verificação')}>{formatarData(serie.metrologia.data_verificacao)}</Dado>
              <Dado rotulo={t('Validade')}>{formatarData(serie.metrologia.validade)}</Dado>
              {serie.metrologia.observacoes && <Dado rotulo={t('Observações')}>{serie.metrologia.observacoes}</Dado>}
            </dl>
          ) : (
            <p className="rounded-cartao border border-borda-subtle bg-surface-raised p-4 text-body text-texto-secondary">
              {op.exige_metrologia ? t('Metrologia ainda não registrada.') : t('Este produto não exige metrologia.')}
            </p>
          )}
        </Bloco>
      </div>

      <Bloco titulo={t('Laudos e inspeções')}>
        <LaudosEInspecoes documentos={consulta.data.documentos ?? []} />
      </Bloco>

      <Bloco titulo={t('Componentes (BOM congelada na OP)')}>
        <Tabela<ComponenteBOM>
          rotulo={t('Componentes da unidade')}
          colunas={colunasComponentes}
          itens={componentes ?? []}
          chaveDe={(c) => c.codigo}
          ordenarPor="codigo"
          ordem="asc"
          aoOrdenar={() => {}}
          vazio={t('Nenhum componente registrado.')}
        />
      </Bloco>

      <Bloco titulo={t('Componentes com série')}>
        <Tabela<SerieComponente>
          rotulo={t('Séries de componentes instaladas')}
          colunas={colunasSeries}
          itens={consulta.data.series_componentes ?? []}
          chaveDe={(s) => `${s.peca_codigo}-${s.numero}`}
          ordenarPor="peca"
          ordem="asc"
          aoOrdenar={() => {}}
          vazio={t('Nenhum componente com número de série instalado nesta unidade.')}
        />
      </Bloco>

      <Bloco titulo={t('Lotes consumidos')}>
        <Tabela<LoteConsumido>
          rotulo={t('Lotes consumidos pela OP')}
          colunas={colunasLotes}
          itens={consulta.data.lotes_consumidos ?? []}
          chaveDe={(l) => l.lote_id}
          ordenarPor="lote"
          ordem="asc"
          aoOrdenar={() => {}}
          vazio={t('Nenhum lote de componente consumido pela OP desta unidade.')}
        />
      </Bloco>

      <Bloco titulo={t('Apontamentos')}>
        <Tabela<Apontamento>
          rotulo={t('Apontamentos da produção')}
          colunas={colunasApontamentos}
          itens={apontamentos ?? []}
          chaveDe={(a) => a.id}
          ordenarPor="inicio"
          ordem="asc"
          aoOrdenar={() => {}}
          vazio={t('Nenhum apontamento registrado.')}
        />
      </Bloco>

      <Bloco titulo={t('Histórico do Kanban')}>
        {(historico ?? []).length === 0 ? (
          <p className="text-body text-texto-secondary">{t('Sem movimentação no Kanban.')}</p>
        ) : (
          <ol className="flex flex-col gap-1 rounded-cartao border border-borda-subtle bg-surface-raised p-3">
            {(historico ?? []).map((h) => (
              <li key={`${h.data_hora}-${h.etapa_nova}`} className="text-body text-texto-primary">
                <span className="text-texto-secondary">{formatarDataHora(h.data_hora)}</span> ·{' '}
                {h.etapa_anterior ? (
                  <>
                    <NomeEtapa etapa={h.etapa_anterior} /> → <NomeEtapa etapa={h.etapa_nova} />
                  </>
                ) : (
                  <>
                    {t('Liberada para')} <NomeEtapa etapa={h.etapa_nova} />
                  </>
                )}{' '}
                · {h.usuario}
              </li>
            ))}
          </ol>
        )}
      </Bloco>
    </div>
  );
}
