import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnexosDoRegistro } from '@/componentes/arquivos/AnexosDoRegistro';
import { Miniatura } from '@/componentes/arquivos/Miniatura';
import { BadgeStatusOP, BadgeStatusSerie, NomeEtapa, SeloAtraso } from '@/componentes/producao/Selos';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import { TrilhaEtapas, type Etapa, type EstadoEtapa } from '@/componentes/ui/TrilhaEtapas';
import { useCentrosDaEtapa } from '@/hooks/useOpcoesProducao';
import { separarErro } from '@/lib/errosDeFormulario';
import { formatarData, formatarDataHora, formatarMoeda } from '@/lib/formato';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { ErroApi } from '@/servicos/api';
import { useAutenticacao } from '@/store/autenticacao';
import {
  avancarOP,
  cancelarOP,
  encerrarApontamento,
  iniciarApontamento,
  liberarOP,
  obterOP,
  registrarMetrologia,
  registrarTeste,
} from '@/servicos/producao';
import {
  ETAPAS_OP,
  ROTULO_ETAPA_OP,
  etapaDoCentro,
  hojeAAAAMMDD,
  opAtrasada,
  type Apontamento,
  type Custo,
  type DetalheOP as Detalhe,
  type Metrologia,
  type Reserva,
  type Serie,
} from '@/tipos/producao';
import { ModalMetrologia, ModalTeste } from './ModaisUnidade';

const CODIGO_MATERIAL_INSUFICIENTE = 'MATERIAL_INSUFICIENTE';

interface Falha {
  mensagem: string;
  /** Lista do que falta para liberar (409 MATERIAL_INSUFICIENTE). */
  faltas?: { codigo: string; mensagem: string }[];
}

function falhaDe(erro: unknown, padrao: string): Falha {
  if (erro instanceof ErroApi && erro.codigo === CODIGO_MATERIAL_INSUFICIENTE) {
    return {
      mensagem: 'Não há material disponível para liberar a OP. Falta:',
      faltas: (erro.detalhes ?? []).map((d) => ({ codigo: d.campo, mensagem: d.mensagem })),
    };
  }
  return { mensagem: separarErro(erro).geral ?? padrao };
}

/** Trilha das 4 etapas fixas (RN3): o que passou, a etapa atual e o que vem. */
function etapasDaOP(op: Detalhe): Etapa[] {
  const indiceAtual = ETAPAS_OP.indexOf(op.etapa_atual);
  const saidas = new Map<string, string>();
  for (const t of op.historico ?? []) {
    if (t.etapa_anterior) saidas.set(t.etapa_anterior, t.data_hora);
  }
  return ETAPAS_OP.map((etapa, indice) => {
    let estado: EstadoEtapa;
    if (op.status === 'Concluida') estado = 'concluida';
    else if (op.status !== 'Liberada') estado = 'pendente-futura';
    else if (indice < indiceAtual) estado = 'concluida';
    else if (indice === indiceAtual) estado = 'pendente-acionavel';
    else estado = 'pendente-futura';
    const saida = saidas.get(etapa);
    return {
      chave: etapa,
      nome: ROTULO_ETAPA_OP[etapa],
      estado,
      timestamp: estado === 'concluida' && saida ? formatarDataHora(saida) : undefined,
    };
  });
}

function formatarDuracao(minutos: number | undefined): string {
  if (minutos === undefined) return 'em andamento';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

const horas = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function Secao({ titulo, children, descricao }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-2">
      <h2 className="text-subtitle text-texto-primary">{titulo}</h2>
      {descricao && <p className="text-label text-texto-secondary">{descricao}</p>}
      {children}
    </section>
  );
}

export function DetalheOP() {
  const { id } = useParams<{ id: string }>();
  const opId = Number(id);
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const podeLiberar = usePode(PERMISSOES.producaoLiberar);
  const podeCancelar = usePode(PERMISSOES.producaoCancelar);
  const podeApontar = usePode(PERMISSOES.producaoApontar);
  const podeAvancar = usePode(PERMISSOES.producaoAvancar);
  const podeTestar = usePode(PERMISSOES.producaoTestar);
  const podeMetrologia = usePode(PERMISSOES.producaoMetrologia);
  const usuarioId = useAutenticacao((estado) => estado.usuario?.id);

  const [falha, definirFalha] = useState<Falha | null>(null);
  const [confirmarCancelar, definirConfirmarCancelar] = useState(false);
  const [centroId, definirCentroId] = useState('');
  const [teste, definirTeste] = useState<{ serie: Serie; aprovado: boolean } | null>(null);
  const [metrologia, definirMetrologia] = useState<Serie | null>(null);

  const consulta = useQuery({ queryKey: ['ops', opId], queryFn: () => obterOP(opId) });
  const op = consulta.data;
  const emAndamento = op?.status === 'Liberada';
  const { opcoes: opcoesCentro } = useCentrosDaEtapa(
    op && emAndamento && podeApontar && !op.apontamento_aberto ? etapaDoCentro(op.etapa_atual) : '',
  );

  // Acoes de estado devolvem o detalhe ja atualizado: grava no cache e so
  // invalida o resto (listas, Kanban, pedido). Teste/metrologia respondem 204:
  // ai o proprio detalhe e recarregado.
  const atualizar = (detalhe?: Detalhe) => {
    if (detalhe) clienteQuery.setQueryData(['ops', opId], detalhe);
    void clienteQuery.invalidateQueries({
      queryKey: ['ops'],
      predicate: (q) => !detalhe || q.queryKey[1] !== opId,
    });
    void clienteQuery.invalidateQueries({ queryKey: ['kanban'] });
    void clienteQuery.invalidateQueries({ queryKey: ['pedidos-venda'] });
  };

  /** Acao de estado da OP: a API devolve o detalhe atualizado. */
  const useAcao = (fn: () => Promise<Detalhe>, sucesso: string, padrao: string, depois?: () => void) =>
    useMutation({
      mutationFn: fn,
      onSuccess: (detalhe) => {
        definirFalha(null);
        atualizar(detalhe);
        mostrarToast(sucesso);
        depois?.();
      },
      onError: (erro) => {
        definirFalha(falhaDe(erro, padrao));
        depois?.();
      },
    });

  const mutacaoLiberar = useAcao(() => liberarOP(opId), 'OP liberada', 'Não foi possível liberar a OP.');
  const mutacaoCancelar = useAcao(() => cancelarOP(opId), 'OP cancelada', 'Não foi possível cancelar a OP.', () =>
    definirConfirmarCancelar(false),
  );
  const mutacaoIniciar = useAcao(
    () => iniciarApontamento(opId, Number(centroId)),
    'Apontamento iniciado',
    'Não foi possível iniciar o apontamento.',
    () => definirCentroId(''),
  );
  const mutacaoEncerrar = useAcao(() => encerrarApontamento(opId), 'Apontamento encerrado', 'Não foi possível encerrar o apontamento.');
  const mutacaoAvancar = useAcao(
    () => avancarOP(opId),
    op?.etapa_atual === 'Expedicao' ? 'OP concluída' : 'Etapa avançada',
    'Não foi possível avançar a etapa.',
  );

  const mutacaoTeste = useMutation({
    mutationFn: (v: { serieId: number; aprovado: boolean; resultado: string }) => registrarTeste(v.serieId, v.aprovado, v.resultado),
    onSuccess: (_, v) => {
      definirTeste(null);
      atualizar();
      mostrarToast(v.aprovado ? 'Unidade aprovada' : 'Unidade reprovada');
    },
  });

  const mutacaoMetrologia = useMutation({
    mutationFn: (v: { serieId: number; corpo: Metrologia }) => registrarMetrologia(v.serieId, v.corpo),
    onSuccess: () => {
      definirMetrologia(null);
      atualizar();
      mostrarToast('Metrologia registrada');
    },
  });

  if (consulta.isPending) return <p className="text-body text-texto-secondary">Carregando…</p>;
  if (consulta.isError || !op) {
    return <p className="text-body text-estado-pending">Não foi possível carregar a ordem de produção.</p>;
  }

  const ocupado =
    mutacaoLiberar.isPending || mutacaoIniciar.isPending || mutacaoEncerrar.isPending || mutacaoAvancar.isPending;
  const naEtapaTestes = emAndamento && op.etapa_atual === 'Testes';
  const ap = op.apontamento_aberto;
  // So quem iniciou encerra o proprio apontamento; quem pode cancelar OP
  // (supervisao) encerra o de qualquer um -- a mesma regra do backend.
  const podeEncerrar = !!ap && podeApontar && (ap.operador_id === usuarioId || podeCancelar);
  const hoje = hojeAAAAMMDD();

  const colunasReserva: Coluna<Reserva>[] = [
    {
      chave: 'peca',
      rotulo: 'Peça',
      renderizar: (r) => (
        <span className="flex items-center gap-3">
          <Miniatura url={r.foto_url} alt={`Foto da peça ${r.codigo}`} />
          <span className="flex flex-col">
            <span className="font-mono">{r.codigo}</span>
            <span className="text-label text-texto-secondary">{r.descricao}</span>
          </span>
        </span>
      ),
    },
    { chave: 'reservada', rotulo: 'Reservado', alinhamento: 'direita', renderizar: (r) => <span className="tabular">{r.quantidade_reservada}</span> },
    { chave: 'consumida', rotulo: 'Consumido', alinhamento: 'direita', renderizar: (r) => <span className="tabular">{r.quantidade_consumida}</span> },
    { chave: 'status', rotulo: 'Situação', renderizar: (r) => r.status },
  ];

  const colunasSerie: Coluna<Serie>[] = [
    {
      chave: 'numero',
      rotulo: 'Número de série',
      renderizar: (s) => (
        <Link to={`/rastreabilidade/${encodeURIComponent(s.numero)}`} className="font-mono text-brand hover:underline">
          {s.numero}
        </Link>
      ),
    },
    { chave: 'status', rotulo: 'Situação', renderizar: (s) => <BadgeStatusSerie status={s.status} /> },
    {
      chave: 'teste',
      rotulo: 'Resultado do teste',
      renderizar: (s) =>
        s.resultado_teste || s.testado_por ? (
          <span className="flex flex-col">
            <span>{s.resultado_teste || '—'}</span>
            {s.testado_por && (
              <span className="text-label text-texto-secondary">
                {s.testado_por}
                {s.testado_em && ` · ${formatarDataHora(s.testado_em)}`}
              </span>
            )}
          </span>
        ) : (
          '—'
        ),
    },
    ...(op.exige_metrologia
      ? [
          {
            chave: 'metrologia',
            rotulo: 'Metrologia',
            renderizar: (s: Serie) =>
              s.metrologia ? (
                <span className="flex flex-col gap-1">
                  <span className="font-mono">Lacre {s.metrologia.numero_lacre}</span>
                  <span className="text-label text-texto-secondary">Validade {formatarData(s.metrologia.validade)}</span>
                  {s.metrologia.validade < hoje && (
                    <Badge tom="pending" icone="alert-triangle">
                      Vencida — refaça a verificação
                    </Badge>
                  )}
                </span>
              ) : (
                <Badge tom="warning" icone="alert-triangle">
                  Pendente
                </Badge>
              ),
          },
        ]
      : []),
  ];

  const podeAgirNaSerie = (naEtapaTestes && podeTestar) || (op.exige_metrologia && podeMetrologia && op.status !== 'Cancelada');
  const acoesSerie = podeAgirNaSerie
    ? (s: Serie) => (
        <div className="flex flex-wrap justify-end gap-2">
          {naEtapaTestes && podeTestar && (
            <>
              <Botao variante="secundaria" icone="check-circle-2" aria-label={`Aprovar ${s.numero}`} onClick={() => definirTeste({ serie: s, aprovado: true })}>
                Aprovar
              </Botao>
              <Botao variante="fantasma" icone="alert-triangle" aria-label={`Reprovar ${s.numero}`} onClick={() => definirTeste({ serie: s, aprovado: false })}>
                Reprovar
              </Botao>
            </>
          )}
          {op.exige_metrologia && podeMetrologia && s.status !== 'Cancelado' && (
            <Botao variante="secundaria" icone="gauge" aria-label={`Metrologia de ${s.numero}`} onClick={() => definirMetrologia(s)}>
              Metrologia
            </Botao>
          )}
        </div>
      )
    : undefined;

  const colunasApontamento: Coluna<Apontamento>[] = [
    { chave: 'etapa', rotulo: 'Etapa', renderizar: (a) => <NomeEtapa etapa={a.etapa} /> },
    { chave: 'operador', rotulo: 'Operador', renderizar: (a) => a.operador_nome || '—' },
    {
      chave: 'centro',
      rotulo: 'Centro de trabalho',
      renderizar: (a) => (
        <span>
          <span className="font-mono">{a.centro_codigo}</span> {a.centro_nome}
        </span>
      ),
    },
    { chave: 'inicio', rotulo: 'Início', renderizar: (a) => formatarDataHora(a.inicio) },
    { chave: 'fim', rotulo: 'Fim', renderizar: (a) => (a.fim ? formatarDataHora(a.fim) : '—') },
    { chave: 'duracao', rotulo: 'Duração', alinhamento: 'direita', renderizar: (a) => formatarDuracao(a.duracao_minutos) },
  ];

  const historico = op.historico ?? [];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Miniatura tamanho="media" url={op.produto_foto_url} alt={`Foto do produto ${op.produto_codigo}`} />
          <div className="flex flex-col gap-1">
            <h1 className="font-mono text-title text-texto-primary">{op.numero_op}</h1>
            <p className="text-body text-texto-primary">
              <span className="font-mono">{op.produto_codigo}</span> — {op.produto_descricao} ·{' '}
              <span className="font-mono tabular">{op.quantidade}</span> un.
            </p>
            <p className="text-body text-texto-secondary">
              Pedido{' '}
              <Link to={`/pedidos-venda/${op.pedido_venda_id}`} className="font-mono text-brand hover:underline">
                {op.numero_pedido}
              </Link>{' '}
              · {op.cliente_nome} · Prazo {formatarData(op.data_conclusao_prevista)} · BOM versão {op.estrutura_versao}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <BadgeStatusOP status={op.status} />
              {opAtrasada(op) && <SeloAtraso>Atrasada</SeloAtraso>}
              {op.exige_metrologia && (
                <Badge tom="blocked" icone="gauge">
                  Exige metrologia
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {op.status === 'Cancelada' ? (
        <Badge tom="neutral" icone="x" className="self-start">
          OP cancelada
        </Badge>
      ) : (
        <TrilhaEtapas rotulo="Etapas da ordem de produção" etapas={etapasDaOP(op)} />
      )}

      {falha && (
        <div role="alert" className="flex flex-col gap-1 rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
          <p>{falha.mensagem}</p>
          {falha.faltas && falha.faltas.length > 0 && (
            <ul className="flex flex-col gap-1">
              {falha.faltas.map((f) => (
                <li key={f.codigo}>
                  <span className="font-mono">{f.codigo}</span> — {f.mensagem}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Acoes da OP conforme situacao e permissao */}
      <div className="flex flex-col gap-3 rounded-cartao border border-borda-subtle bg-surface-raised p-4">
        {op.status === 'Aberta' && (
          <p className="text-body text-texto-secondary">
            Liberar reserva todo o material da BOM (tudo ou nada) e coloca a OP no Kanban, na Separação.
          </p>
        )}
        {emAndamento && (
          <p className="text-body text-texto-secondary">
            Etapa atual: <strong className="text-texto-primary"><NomeEtapa etapa={op.etapa_atual} /></strong>.{' '}
            {ap
              ? `Em apontamento por ${ap.operador_nome} no centro ${ap.centro_codigo} desde ${formatarDataHora(ap.inicio)}.`
              : 'Ninguém apontando agora. Para avançar, é preciso ao menos um apontamento encerrado nesta etapa.'}
          </p>
        )}
        {op.status === 'Concluida' && (
          <p className="text-body text-texto-secondary">
            OP concluída{op.data_conclusao_real ? ` em ${formatarData(op.data_conclusao_real)}` : ''}: as unidades entraram no estoque de produto acabado.
          </p>
        )}

        <div className="flex flex-wrap items-end gap-2">
          {op.status === 'Aberta' && podeLiberar && (
            <Botao icone="unlock" ocupado={mutacaoLiberar.isPending} rotuloOcupado="Liberando…" disabled={ocupado} onClick={() => mutacaoLiberar.mutate()}>
              Liberar OP
            </Botao>
          )}
          {emAndamento && podeApontar && !ap && (
            <>
              <div className="w-[280px] max-w-full">
                <Selecao
                  rotulo={`Centro de trabalho (${ROTULO_ETAPA_OP[op.etapa_atual]})`}
                  opcoes={opcoesCentro}
                  placeholder="Selecione"
                  ajuda={opcoesCentro.length === 0 ? 'Nenhum centro ativo nesta etapa — cadastre em Centros de trabalho' : undefined}
                  value={centroId}
                  onChange={(e) => definirCentroId(e.target.value)}
                />
              </div>
              <Botao
                icone="play"
                ocupado={mutacaoIniciar.isPending}
                rotuloOcupado="Iniciando…"
                disabled={ocupado || centroId === ''}
                onClick={() => mutacaoIniciar.mutate()}
              >
                Iniciar apontamento
              </Botao>
            </>
          )}
          {emAndamento && podeEncerrar && (
            <Botao icone="square" ocupado={mutacaoEncerrar.isPending} rotuloOcupado="Encerrando…" disabled={ocupado} onClick={() => mutacaoEncerrar.mutate()}>
              Encerrar apontamento
            </Botao>
          )}
          {emAndamento && podeAvancar && (
            <Botao
              variante={ap ? 'secundaria' : 'primaria'}
              icone={op.etapa_atual === 'Expedicao' ? 'check-circle-2' : 'arrow-right'}
              ocupado={mutacaoAvancar.isPending}
              rotuloOcupado={op.etapa_atual === 'Expedicao' ? 'Concluindo…' : 'Avançando…'}
              disabled={ocupado}
              onClick={() => mutacaoAvancar.mutate()}
            >
              {op.etapa_atual === 'Expedicao' ? 'Concluir OP' : 'Avançar etapa'}
            </Botao>
          )}
          {(op.status === 'Aberta' || op.status === 'Liberada') && podeCancelar && (
            <Botao variante="fantasma" icone="trash-2" disabled={ocupado} onClick={() => definirConfirmarCancelar(true)}>
              Cancelar OP
            </Botao>
          )}
        </div>
      </div>

      <Secao titulo="Material" descricao="Reservado na liberação e consumido ao sair da Separação.">
        <Tabela<Reserva>
          rotulo="Material da OP"
          colunas={colunasReserva}
          itens={op.reservas ?? []}
          chaveDe={(r) => r.parte_peca_id}
          ordenarPor="peca"
          ordem="asc"
          aoOrdenar={() => {}}
          vazio="Nenhum material reservado ainda. Libere a OP para reservar."
        />
      </Secao>

      <Secao
        titulo="Unidades"
        descricao={
          naEtapaTestes
            ? 'Registre o resultado de cada unidade. Só avança com todas aprovadas' +
              (op.exige_metrologia ? ' e com a metrologia preenchida.' : '.')
            : 'Um número de série por unidade, gerado na liberação.'
        }
      >
        <Tabela<Serie>
          rotulo="Unidades da OP"
          colunas={colunasSerie}
          itens={op.series ?? []}
          chaveDe={(s) => s.id}
          ordenarPor="numero"
          ordem="asc"
          aoOrdenar={() => {}}
          vazio="As unidades (números de série) são geradas quando a OP é liberada."
          acoes={acoesSerie}
        />
      </Secao>

      <Secao titulo="Apontamentos">
        <Tabela<Apontamento>
          rotulo="Apontamentos da OP"
          colunas={colunasApontamento}
          itens={op.apontamentos ?? []}
          chaveDe={(a) => a.id}
          ordenarPor="inicio"
          ordem="asc"
          aoOrdenar={() => {}}
          vazio="Nenhum apontamento ainda."
        />
      </Secao>

      <Secao
        titulo="Documentos e laudos"
        descricao="Laudos de teste e relatórios de inspeção entram na ficha as-built de cada unidade."
      >
        <AnexosDoRegistro
          entidade="ordem_producao"
          entidadeId={op.id}
          podeEditar={podeApontar}
          encerrado={op.status === 'Concluida' || op.status === 'Cancelada'}
        />
      </Secao>

      <Secao titulo="Histórico do Kanban">
        {historico.length === 0 ? (
          <p className="text-body text-texto-secondary">A OP ainda não entrou no Kanban.</p>
        ) : (
          <ol className="flex flex-col gap-1 rounded-cartao border border-borda-subtle bg-surface-raised p-3">
            {historico.map((t) => (
              <li key={`${t.data_hora}-${t.etapa_nova}`} className="text-body text-texto-primary">
                <span className="text-texto-secondary">{formatarDataHora(t.data_hora)}</span> ·{' '}
                {t.etapa_anterior ? (
                  <>
                    <NomeEtapa etapa={t.etapa_anterior} /> → <NomeEtapa etapa={t.etapa_nova} />
                  </>
                ) : (
                  <>
                    Liberada para <NomeEtapa etapa={t.etapa_nova} />
                  </>
                )}{' '}
                · {t.usuario}
              </li>
            ))}
          </ol>
        )}
      </Secao>

      {op.custo && <SecaoCusto custo={op.custo} />}

      <Confirmacao
        aberto={confirmarCancelar}
        titulo="Cancelar ordem de produção"
        mensagem={`Cancelar a OP ${op.numero_op}? A reserva de material é devolvida ao estoque. Depois que o material é consumido (saída da Separação), a OP não pode mais ser cancelada.`}
        rotuloConfirmar="Cancelar OP"
        rotuloOcupado="Cancelando…"
        ocupado={mutacaoCancelar.isPending}
        aoConfirmar={() => mutacaoCancelar.mutate()}
        aoCancelar={() => definirConfirmarCancelar(false)}
      />

      {teste && (
        <ModalTeste
          serie={teste.serie}
          aprovado={teste.aprovado}
          ocupado={mutacaoTeste.isPending}
          erro={separarErro(mutacaoTeste.error).geral}
          aoFechar={() => {
            definirTeste(null);
            mutacaoTeste.reset();
          }}
          aoEnviar={(resultado) => mutacaoTeste.mutate({ serieId: teste.serie.id, aprovado: teste.aprovado, resultado })}
        />
      )}

      {metrologia && (
        <ModalMetrologia
          serie={metrologia}
          ocupado={mutacaoMetrologia.isPending}
          erro={separarErro(mutacaoMetrologia.error).geral ?? (mutacaoMetrologia.error ? 'Confira os campos da metrologia.' : null)}
          aoFechar={() => {
            definirMetrologia(null);
            mutacaoMetrologia.reset();
          }}
          aoEnviar={(corpo) => mutacaoMetrologia.mutate({ serieId: metrologia.id, corpo })}
        />
      )}
    </div>
  );
}

function LinhaCusto({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-borda-subtle py-2 last:border-b-0">
      <dt className="text-body text-texto-secondary">{rotulo}</dt>
      <dd className={destaque ? 'font-mono text-subtitle tabular text-texto-primary' : 'font-mono text-body tabular text-texto-primary'}>
        {valor}
      </dd>
    </div>
  );
}

/** Custo real (doc 0, 5.1.D): so aparece para quem tem producao.custos (a API omite o campo). */
function SecaoCusto({ custo }: { custo: Custo }) {
  const diferenca = custo.material_realizado - custo.material_orcado;
  return (
    <Secao titulo="Custo" descricao="Orçado: BOM × custo médio na liberação. Realizado: material consumido + horas apontadas × custo/hora do centro.">
      {custo.incompleto && (
        <div role="status" className="flex flex-col gap-1 rounded-campo border border-estado-warning bg-estado-warning-bg px-3 py-2 text-body text-estado-warning">
          <p>Custo incompleto — os valores abaixo estão subestimados.</p>
          {(custo.avisos ?? []).length > 0 && (
            <ul className="flex flex-col gap-1">
              {(custo.avisos ?? []).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <dl className="grid gap-x-8 rounded-cartao border border-borda-subtle bg-surface-raised px-4 py-2 md:grid-cols-2">
        <div>
          <LinhaCusto rotulo="Material orçado" valor={formatarMoeda(custo.material_orcado)} />
          <LinhaCusto rotulo="Material realizado" valor={formatarMoeda(custo.material_realizado)} />
          <LinhaCusto
            rotulo="Diferença de material"
            valor={`${diferenca > 0 ? '+' : ''}${formatarMoeda(diferenca)}`}
          />
        </div>
        <div>
          <LinhaCusto rotulo="Horas apontadas" valor={`${horas.format(custo.horas_apontadas)} h`} />
          <LinhaCusto rotulo="Mão de obra" valor={formatarMoeda(custo.mao_de_obra)} />
          <LinhaCusto rotulo="Total realizado" valor={formatarMoeda(custo.total_realizado)} destaque />
          <LinhaCusto rotulo="Custo por unidade" valor={formatarMoeda(custo.custo_unitario)} destaque />
        </div>
      </dl>
    </Secao>
  );
}
