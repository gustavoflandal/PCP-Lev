import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { mensagemDeErro } from '@/componentes/arquivos/comum';
import { AnexosDaNota } from '@/componentes/recebimento/AnexosDaNota';
import { PainelPendencias } from '@/componentes/recebimento/PainelPendencias';
import { SeloStatusNota } from '@/componentes/recebimento/Selos';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Cartao } from '@/componentes/ui/Cartao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Selecao } from '@/componentes/ui/Selecao';
import { TrilhaEtapas, type Etapa } from '@/componentes/ui/TrilhaEtapas';
import { useToasts } from '@/componentes/ui/Toast';
import { useFornecedoresAtivos } from '@/hooks/useFornecedoresAtivos';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { usePedidosQueRecebem } from '@/hooks/usePedidosQueRecebem';
import { t, td } from '@/i18n';
import { formatarCNPJ, formatarData, formatarDataHora, formatarMoeda } from '@/lib/formato';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { ErroApi } from '@/servicos/api';
import { obterCompra } from '@/servicos/compras';
import {
  atualizarNota,
  cancelarNota,
  conferirNota,
  criarNota,
  efetivarNota,
  estornarNota,
  listarPendencias,
  obterNota,
  pendenciasDoErro,
  pendenciasExibidas,
  type PendenciaExibida,
} from '@/servicos/notasEntrada';
import type { PedidoCompra } from '@/tipos/compras';
import type { NotaEntrada as Nota } from '@/tipos/notasEntrada';
import { ImportarXML } from './ImportarXML';
import { ItemDaNota } from './ItemDaNota';
import {
  CAMPOS_VALOR,
  formularioParaCorpo,
  formularioVazio,
  itemBonificacao,
  itemDoPedido,
  notaParaFormulario,
  paraNumero,
  validarParaSalvar,
  type FormItem,
  type FormNota,
} from './modeloNota';

const EDITAVEIS = ['Rascunho', 'Conferida'];

/** /notas-entrada/nova e /notas-entrada/:id */
export function NotaEntrada() {
  const { id } = useParams<{ id: string }>();
  const notaId = id ? Number(id) : null;
  const consulta = useQuery({
    queryKey: ['notas-entrada', notaId],
    queryFn: () => obterNota(notaId ?? 0),
    enabled: notaId !== null,
  });

  if (notaId === null) {
    return <EditorNota key="nova" nota={null} />;
  }
  if (consulta.isPending) {
    return <p className="text-body text-texto-secondary">{t('Carregando nota fiscal…')}</p>;
  }
  if (consulta.isError || !consulta.data) {
    const naoAchou = consulta.error instanceof ErroApi && consulta.error.status === 404;
    return (
      <p role="alert" className="text-body text-estado-pending">
        {naoAchou ? t('Nota fiscal não encontrada.') : t('Não foi possível carregar a nota fiscal. Tente de novo.')}
      </p>
    );
  }
  return <EditorNota key={consulta.data.id} nota={consulta.data} />;
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-label text-texto-secondary">{rotulo}</dt>
      <dd className="text-body text-texto-primary">{children}</dd>
    </div>
  );
}

function etapasDaNota(nota: Nota | null, aoEfetivar?: () => void): Etapa[] {
  const status = nota?.status ?? 'Rascunho';
  const salva = !!nota;
  return [
    {
      chave: 'lancada',
      nome: t('Lançada'),
      estado: salva ? 'concluida' : 'pendente-acionavel',
      timestamp: nota ? formatarData(nota.created_at) : undefined,
    },
    {
      chave: 'conferida',
      nome: t('Conferida'),
      estado: status === 'Rascunho' ? (salva ? 'pendente-acionavel' : 'pendente-futura') : 'concluida',
    },
    {
      chave: 'efetivada',
      nome: t('Efetivada (estoque)'),
      estado: status === 'Efetivada' ? 'concluida' : status === 'Conferida' ? 'pendente-acionavel' : 'pendente-futura',
      timestamp: nota?.efetivada_em ? formatarDataHora(nota.efetivada_em) : undefined,
      executante: nota?.efetivada_por,
      aoAcionar: status === 'Conferida' ? aoEfetivar : undefined,
    },
  ];
}

function EditorNota({ nota }: { nota: Nota | null }) {
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const podeLancar = usePode(PERMISSOES.notasLancar);
  const podeEfetivar = usePode(PERMISSOES.notasEfetivar);
  const podeEstornar = usePode(PERMISSOES.notasEstornar);
  const podeAprovar = usePode(PERMISSOES.notasAprovarDivergencia);
  const fornecedores = useFornecedoresAtivos();
  const pecas = usePartesPecasAtivas();
  const pedidos = usePedidosQueRecebem(fornecedores.porId);

  const pedidoDaURL = parametros.get('pedido') ?? '';
  const [form, definirForm] = useState<FormNota>(() => (nota ? notaParaFormulario(nota) : formularioVazio(pedidoDaURL)));
  const [alterado, definirAlterado] = useState(false);
  const [erros, definirErros] = useState<Record<string, string>>({});
  const [erroGeral, definirErroGeral] = useState<string | null>(null);
  const [pendenciasDaAcao, definirPendenciasDaAcao] = useState<PendenciaExibida[] | null>(null);
  const [itemPCEscolhido, definirItemPCEscolhido] = useState('');
  const [pecaBonificacao, definirPecaBonificacao] = useState('');
  const [modal, definirModal] = useState<'cancelar' | 'estornar' | 'importar' | null>(null);
  const [motivoEstorno, definirMotivoEstorno] = useState('');

  const status = nota?.status ?? 'Rascunho';
  const editavel = podeLancar && EDITAVEIS.includes(status);
  const somenteLeitura = !editavel;
  const pedidoId = Number(form.pedido_compra_id) || 0;

  const pedido = useQuery({
    queryKey: ['pedidos-compra', pedidoId],
    queryFn: () => obterCompra<PedidoCompra>('pedidos-compra', pedidoId),
    enabled: pedidoId > 0,
  });

  const pendencias = useQuery({
    queryKey: ['notas-entrada', nota?.id, 'pendencias'],
    queryFn: () => listarPendencias(nota?.id ?? 0),
    enabled: !!nota && EDITAVEIS.includes(status),
  });

  const pecaPorId = useMemo(() => new Map(pecas.itens.map((p) => [p.id, p])), [pecas.itens]);
  const fornecedorDoPedido = pedido.data ? fornecedores.itens.find((f) => f.id === pedido.data.fornecedor_id) : undefined;
  const fornecedorNome = fornecedorDoPedido?.razao_social ?? nota?.fornecedor_nome ?? '—';

  // Opcoes de PC: os que recebem + o da nota (que pode ja ter sido concluido).
  const opcoesPedido = useMemo(() => {
    const opcoes = [...pedidos.opcoes];
    if (nota && !opcoes.some((o) => o.valor === String(nota.pedido_compra_id))) {
      opcoes.unshift({ valor: String(nota.pedido_compra_id), rotulo: `${nota.numero_pc} — ${nota.fornecedor_nome}` });
    }
    return opcoes;
  }, [pedidos.opcoes, nota]);

  function mudar(parcial: Partial<FormNota>) {
    definirForm((atual) => ({ ...atual, ...parcial }));
    definirAlterado(true);
  }

  function mudarItem(chave: string, item: FormItem) {
    mudar({ itens: form.itens.map((i) => (i.chave === chave ? item : i)) });
  }

  function escolherPedido(valor: string) {
    const pc = pedidos.porId.get(Number(valor));
    const cnpj = pc ? (fornecedores.itens.find((f) => f.id === pc.fornecedor_id)?.cnpj ?? '') : '';
    mudar({ pedido_compra_id: valor, cnpj_emitente: cnpj });
  }

  // CNPJ do emitente = fornecedor do PC (preenche quando o PC chega pela URL).
  const cnpjEfetivo = form.cnpj_emitente || fornecedorDoPedido?.cnpj || '';

  function adicionarItemDoPedido() {
    const pc = pedido.data;
    const item = pc?.itens.find((i) => String(i.id) === itemPCEscolhido);
    if (!pc || !item) return;
    mudar({ itens: [...form.itens, itemDoPedido(item, pc.numero_pc, pecaPorId.get(item.parte_peca_id))] });
    definirItemPCEscolhido('');
  }

  function adicionarBonificacao() {
    const peca = pecaPorId.get(Number(pecaBonificacao));
    if (!peca) return;
    mudar({ itens: [...form.itens, itemBonificacao(peca)] });
    definirPecaBonificacao('');
  }

  function aplicarNota(n: Nota) {
    clienteQuery.setQueryData(['notas-entrada', n.id], n);
    void clienteQuery.invalidateQueries({ queryKey: ['notas-entrada'], refetchType: 'none' });
    void clienteQuery.invalidateQueries({ queryKey: ['notas-entrada', n.id, 'pendencias'] });
    void clienteQuery.invalidateQueries({ queryKey: ['pedidos-compra'] });
    void clienteQuery.invalidateQueries({ queryKey: ['estoque'] });
    definirForm(notaParaFormulario(n));
    definirAlterado(false);
  }

  /** Salva (cria ou regrava) e devolve a nota atualizada; null se a validacao local barrou. */
  async function salvar(): Promise<Nota | null> {
    const corpo = {
      ...formularioParaCorpo(form),
      cnpj_emitente: cnpjEfetivo,
      origem: nota?.origem === 'XML' ? ('XML' as const) : ('MANUAL' as const),
    };
    const problemas = validarParaSalvar(form);
    definirErros(problemas);
    if (Object.keys(problemas).length > 0) {
      definirErroGeral(t('Corrija os campos marcados para salvar o rascunho.'));
      return null;
    }
    return nota ? atualizarNota(nota.id, corpo) : criarNota(corpo);
  }

  function tratarErro(e: unknown, padrao: string, recarregarEmConflito = false) {
    const lista = pendenciasDoErro(e);
    if (lista) {
      definirPendenciasDaAcao(lista);
      definirErroGeral(e instanceof Error ? e.message : padrao);
      return;
    }
    // Conferir/efetivar com a nota alterada por outra pessoa (controle de
    // versao, v1.2): mostra o motivo e recarrega a nota do servidor.
    if (recarregarEmConflito && nota && e instanceof ErroApi && e.status === 409 && e.codigo === 'CONFLITO') {
      definirErroGeral(t('{motivo}. A nota foi recarregada com a versão atual — confira de novo.', { motivo: e.message }));
      void obterNota(nota.id)
        .then(aplicarNota)
        .catch(() => undefined);
      return;
    }
    definirErroGeral(mensagemDeErro(e, padrao));
  }

  function aposSalvarNova(n: Nota, mensagem: string) {
    aplicarNota(n);
    mostrarToast(mensagem);
    if (!nota) navegar(`/notas-entrada/${n.id}`, { replace: true });
  }

  const mutacaoSalvar = useMutation({
    mutationFn: salvar,
    onMutate: () => {
      definirErroGeral(null);
      definirPendenciasDaAcao(null);
    },
    onSuccess: (n) => n && aposSalvarNova(n, t('Rascunho salvo')),
    onError: (e) => tratarErro(e, t('Não foi possível salvar a nota.')),
  });

  const mutacaoConferir = useMutation({
    mutationFn: async () => {
      // Conferir sempre sobre o que esta na tela: salva antes, se mudou.
      let atual = nota;
      if (!nota || alterado) {
        const salva = await salvar();
        if (!salva) return null;
        atual = salva;
        aplicarNota(salva);
      }
      return conferirNota((atual as Nota).id).catch((e) => {
        // A nota foi salva mesmo se a conferencia recusar: a tela vai para ela.
        if (!nota && atual) navegar(`/notas-entrada/${atual.id}`, { replace: true });
        throw e;
      });
    },
    onMutate: () => {
      definirErroGeral(null);
      definirPendenciasDaAcao(null);
    },
    onSuccess: (n) => n && aposSalvarNova(n, t('Nota conferida')),
    onError: (e) => tratarErro(e, t('Não foi possível conferir a nota.'), true),
  });

  const mutacaoEfetivar = useMutation({
    mutationFn: () => efetivarNota((nota as Nota).id),
    onMutate: () => {
      definirErroGeral(null);
      definirPendenciasDaAcao(null);
    },
    onSuccess: (n) => {
      aplicarNota(n);
      mostrarToast(t('Nota efetivada — estoque atualizado'));
    },
    onError: (e) => tratarErro(e, t('Não foi possível efetivar a nota.'), true),
  });

  const mutacaoCancelar = useMutation({
    mutationFn: () => cancelarNota((nota as Nota).id),
    onSuccess: (n) => {
      aplicarNota(n);
      mostrarToast(t('Nota cancelada'));
      definirModal(null);
    },
    onError: (e) => {
      tratarErro(e, t('Não foi possível cancelar a nota.'));
      definirModal(null);
    },
  });

  const mutacaoEstornar = useMutation({
    mutationFn: () => estornarNota((nota as Nota).id, motivoEstorno.trim()),
    onSuccess: (n) => {
      aplicarNota(n);
      mostrarToast(t('Nota estornada'));
      definirModal(null);
    },
  });

  const listaPendencias = pendenciasDaAcao ?? pendenciasExibidas(pendencias.data ?? []);
  const exigeAprovacao = listaPendencias.some((p) => p.nivel === 'APROVACAO');
  const temBloqueio = listaPendencias.some((p) => p.nivel === 'BLOQUEIO');
  const somaItens = form.itens.reduce((s, i) => s + paraNumero(i.valor_total), 0);
  const chaveDigitos = form.chave_acesso.replace(/\D/g, '').length;
  const ocupado = mutacaoSalvar.isPending || mutacaoConferir.isPending || mutacaoEfetivar.isPending;
  const motivoValido = motivoEstorno.trim().length >= 10 && motivoEstorno.trim().length <= 255;

  const opcoesItensPC = (pedido.data?.itens ?? []).map((i) => {
    const peca = pecaPorId.get(i.parte_peca_id);
    const pendente = Math.max(0, i.quantidade_solicitada - i.quantidade_recebida);
    return {
      valor: String(i.id),
      rotulo: `${peca?.codigo ?? i.parte_peca_id} — ${peca?.descricao ?? ''} ${t('(pendente {pendente} de {total}, {preco})', {
        pendente,
        total: i.quantidade_solicitada,
        preco: formatarMoeda(i.preco_unitario),
      })}`,
    };
  });

  const titulo = nota ? `NF ${nota.numero}/${nota.serie}` : t('Nova nota fiscal de entrada');

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link to="/notas-entrada" className="text-label text-brand hover:underline">
            {t('Notas fiscais de entrada')}
          </Link>
          <h1 className="font-mono text-title text-texto-primary">{titulo}</h1>
          <p className="text-body text-texto-secondary">
            {fornecedorNome}
            {cnpjEfetivo && (
              <>
                {' · '}CNPJ <span className="font-mono">{formatarCNPJ(cnpjEfetivo)}</span>
              </>
            )}
            {nota?.numero_pc && (
              <>
                {' · '}
                <Link to={`/pedidos-compra/${nota.pedido_compra_id}`} className="font-mono text-brand hover:underline">
                  {nota.numero_pc}
                </Link>
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <SeloStatusNota status={status} />
            {nota?.origem === 'XML' && (
              <Badge tom="neutral" icone="file-code">
                {t('Importada do XML')}
              </Badge>
            )}
            {alterado && editavel && (
              <Badge tom="warning" icone="alert-triangle">
                {t('Alterações não salvas')}
              </Badge>
            )}
          </div>
        </div>
        {!nota && podeLancar && (
          <Botao variante="secundaria" icone="file-code" onClick={() => definirModal('importar')}>
            {t('Importar XML')}
          </Botao>
        )}
      </div>

      {status === 'Cancelada' || status === 'Estornada' ? (
        <div className="flex flex-col gap-1 rounded-cartao border border-borda-subtle bg-estado-neutral-bg px-3 py-2 text-body text-estado-neutral">
          {status === 'Cancelada' ? (
            <p>{t('Nota cancelada: não movimentou estoque. Fica só para consulta.')}</p>
          ) : (
            <p>
              {nota?.estornada_em
                ? t('Nota estornada em {data}: o estoque, os lotes, as séries e o saldo do pedido voltaram ao que eram. Motivo: {motivo}', {
                    data: formatarDataHora(nota.estornada_em),
                    motivo: nota?.motivo_estorno ?? '—',
                  })
                : t('Nota estornada: o estoque, os lotes, as séries e o saldo do pedido voltaram ao que eram. Motivo: {motivo}', {
                    motivo: nota?.motivo_estorno ?? '—',
                  })}
            </p>
          )}
          {nota?.efetivada_por && (
            <p>
              {nota.efetivada_em
                ? t('Tinha sido efetivada por {usuario} em {data}.', { usuario: nota.efetivada_por, data: formatarDataHora(nota.efetivada_em) })
                : t('Tinha sido efetivada por {usuario}.', { usuario: nota.efetivada_por })}
            </p>
          )}
        </div>
      ) : (
        <TrilhaEtapas
          rotulo={t('Situação da nota fiscal')}
          etapas={etapasDaNota(nota, podeEfetivar && !alterado ? () => mutacaoEfetivar.mutate() : undefined)}
        />
      )}

      {nota?.divergencia_aprovada_por && (
        <Badge tom="blocked" icone="shield-check" className="self-start">
          {t('Divergência de preço aprovada por {usuario}', { usuario: nota.divergencia_aprovada_por })}
        </Badge>
      )}

      {erroGeral && (
        <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
          {erroGeral}
        </p>
      )}

      {(nota || pendenciasDaAcao) && EDITAVEIS.includes(status) && (
        <Cartao titulo={t('Conferência')}>
          <PainelPendencias pendencias={listaPendencias} carregando={!pendenciasDaAcao && pendencias.isPending} />
          {alterado && <p className="mt-2 text-label text-texto-secondary">{t('As pendências valem para a nota salva. Salve para conferir de novo.')}</p>}
        </Cartao>
      )}

      <form
        noValidate
        aria-label={t('Nota fiscal de entrada')}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          mutacaoSalvar.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <fieldset disabled={somenteLeitura || ocupado} className="flex min-w-0 flex-col gap-4">
          <Cartao titulo={t('Cabeçalho')}>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <Selecao
                  rotulo={t('Pedido de compra')}
                  obrigatorio
                  placeholder={pedidos.carregando ? t('Carregando pedidos…') : t('Escolha o pedido que a nota atende')}
                  opcoes={opcoesPedido}
                  erro={erros.pedido_compra_id}
                  ajuda={form.itens.length > 0 ? t('Para trocar o pedido, remova os itens.') : t('Aguardando entrega ou recebido parcial. Fornecedor e CNPJ vêm do pedido.')}
                  disabled={form.itens.length > 0}
                  value={form.pedido_compra_id}
                  onChange={(e) => escolherPedido(e.target.value)}
                />
              </div>
              <Selecao
                rotulo={t('Modelo')}
                opcoes={[
                  { valor: '55', rotulo: '55 — NF-e' },
                  { valor: '01', rotulo: t('01 — nota em papel') },
                ]}
                value={form.modelo}
                onChange={(e) => mudar({ modelo: e.target.value as FormNota['modelo'] })}
              />
              <Campo rotulo={t('Série')} obrigatorio tipoDado="quantidade" erro={erros.serie} value={form.serie} onChange={(e) => mudar({ serie: e.target.value })} />
              <Campo rotulo={t('Número')} obrigatorio tipoDado="quantidade" erro={erros.numero} value={form.numero} onChange={(e) => mudar({ numero: e.target.value })} />
              <Campo rotulo="CFOP" tipoDado="quantidade" ajuda={t('Ex.: 1102 (compra para industrialização)')} value={form.cfop} onChange={(e) => mudar({ cfop: e.target.value })} />
              <div className="md:col-span-3">
                <Campo
                  rotulo={t('Chave de acesso')}
                  obrigatorio={form.modelo === '55'}
                  tipoDado="codigo"
                  inputMode="numeric"
                  maxLength={54}
                  erro={erros.chave_acesso}
                  ajuda={form.modelo === '55' ? t('{n} de 44 dígitos — obrigatória na NF-e', { n: chaveDigitos }) : t('{n} de 44 dígitos', { n: chaveDigitos })}
                  value={form.chave_acesso}
                  onChange={(e) => mudar({ chave_acesso: e.target.value })}
                />
              </div>
              <Campo rotulo={t('Data de emissão')} type="date" value={form.data_emissao} onChange={(e) => mudar({ data_emissao: e.target.value })} />
              <Campo
                rotulo={t('Data de entrada')}
                type="date"
                ajuda={t('Não pode ser anterior à emissão nem futura.')}
                value={form.data_entrada}
                onChange={(e) => mudar({ data_entrada: e.target.value })}
              />
            </div>
          </Cartao>

          <Cartao titulo={t('Valores da nota')}>
            <div className="grid gap-3 md:grid-cols-4">
              {CAMPOS_VALOR.map(([campo, rotulo]) => (
                <Campo
                  key={campo}
                  rotulo={td(rotulo)}
                  tipoDado="quantidade"
                  ajuda={campo === 'valor_produtos' ? t('Soma dos itens: {valor}', { valor: formatarMoeda(somaItens) }) : undefined}
                  value={form[campo]}
                  onChange={(e) => mudar({ [campo]: e.target.value } as Partial<FormNota>)}
                />
              ))}
            </div>
            <p className="mt-2 text-label text-texto-secondary">
              {t('Frete, seguro, IPI e ICMS-ST (menos o desconto) são rateados pelo valor de cada item no custo de entrada.')}
            </p>
          </Cartao>

          <Cartao titulo={t('Itens ({n}) — conferência de recebimento', { n: form.itens.length })}>
            <div className="flex flex-col gap-3">
              {erros.itens && (
                <p role="alert" className="text-body text-estado-pending">
                  {erros.itens}
                </p>
              )}
              {form.itens.length === 0 && (
                <p className="text-body text-texto-secondary">
                  {pedidoId ? t('Adicione os itens do pedido que chegaram nesta nota.') : t('Escolha o pedido de compra para adicionar os itens.')}
                </p>
              )}
              {form.itens.map((item, indice) => (
                <ItemDaNota
                  key={item.chave}
                  item={item}
                  ordem={indice + 1}
                  somenteLeitura={somenteLeitura}
                  aoMudar={(novo) => mudarItem(item.chave, novo)}
                  aoRemover={() => mudar({ itens: form.itens.filter((i) => i.chave !== item.chave) })}
                />
              ))}
              {editavel && pedidoId > 0 && (
                <div className="flex flex-wrap items-end gap-4 border-t border-borda-subtle pt-3">
                  <div className="flex min-w-[320px] flex-1 items-end gap-2">
                    <div className="flex-1">
                      <Selecao
                        rotulo={t('Item do pedido')}
                        placeholder={t('Escolha o item que chegou')}
                        opcoes={opcoesItensPC}
                        value={itemPCEscolhido}
                        onChange={(e) => definirItemPCEscolhido(e.target.value)}
                      />
                    </div>
                    <Botao variante="secundaria" icone="plus" disabled={!itemPCEscolhido} onClick={adicionarItemDoPedido}>
                      {t('Adicionar item')}
                    </Botao>
                  </div>
                  <div className="flex min-w-[320px] flex-1 items-end gap-2">
                    <div className="flex-1">
                      <Selecao
                        rotulo={t('Bonificação (peça sem pedido)')}
                        placeholder={t('Escolha a peça')}
                        opcoes={pecas.opcoes}
                        value={pecaBonificacao}
                        onChange={(e) => definirPecaBonificacao(e.target.value)}
                      />
                    </div>
                    <Botao variante="secundaria" icone="plus" disabled={!pecaBonificacao} onClick={adicionarBonificacao}>
                      {t('Adicionar bonificação')}
                    </Botao>
                  </div>
                </div>
              )}
            </div>
          </Cartao>

          <Cartao titulo={t('Observações')}>
            <label htmlFor="observacoes-nota" className="sr-only">
              {t('Observações')}
            </label>
            <textarea
              id="observacoes-nota"
              rows={3}
              maxLength={1000}
              value={form.observacoes}
              onChange={(e) => mudar({ observacoes: e.target.value })}
              className="w-full rounded-campo border border-borda-strong bg-surface-raised px-3 py-2 text-body text-texto-primary disabled:bg-surface-sunken"
            />
            {erros.observacoes && <p className="text-label text-estado-pending">{erros.observacoes}</p>}
          </Cartao>
        </fieldset>

        {status === 'Conferida' && exigeAprovacao && (
          <p
            role="status"
            className="rounded-campo border border-estado-warning bg-estado-warning-bg px-3 py-2 text-body text-estado-warning"
          >
            {podeAprovar
              ? t('Há divergência de preço acima da tolerância: ao efetivar, você aprova a divergência (fica registrado).')
              : t('Há divergência de preço acima da tolerância: a efetivação precisa de quem tem a permissão "Aprovar divergência de preço".')}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {nota && podeLancar && EDITAVEIS.includes(status) && (
            <Botao variante="fantasma" icone="ban" onClick={() => definirModal('cancelar')} disabled={ocupado}>
              {t('Cancelar nota')}
            </Botao>
          )}
          {nota && podeEstornar && status === 'Efetivada' && (
            <Botao
              variante="perigo"
              icone="undo-2"
              onClick={() => {
                definirMotivoEstorno('');
                mutacaoEstornar.reset();
                definirModal('estornar');
              }}
            >
              {t('Estornar nota')}
            </Botao>
          )}
          {editavel && (
            <>
              <Botao type="submit" variante="secundaria" icone="save" ocupado={mutacaoSalvar.isPending} rotuloOcupado={t('Salvando…')} disabled={ocupado}>
                {t('Salvar rascunho')}
              </Botao>
              <Botao
                variante={status === 'Conferida' && !alterado ? 'secundaria' : 'primaria'}
                icone="shield-check"
                ocupado={mutacaoConferir.isPending}
                rotuloOcupado={t('Conferindo…')}
                disabled={ocupado}
                onClick={() => mutacaoConferir.mutate()}
              >
                {t('Conferir')}
              </Botao>
            </>
          )}
          {nota && podeEfetivar && status === 'Conferida' && (
            <Botao
              icone="package-check"
              ocupado={mutacaoEfetivar.isPending}
              rotuloOcupado={t('Efetivando…')}
              disabled={ocupado || alterado || temBloqueio || (exigeAprovacao && !podeAprovar)}
              onClick={() => mutacaoEfetivar.mutate()}
            >
              {t('Efetivar nota')}
            </Botao>
          )}
        </div>
      </form>

      {nota && (
        <Cartao titulo={t('Anexos e fotos do recebimento')}>
          <AnexosDaNota notaId={nota.id} podeEditar={podeLancar && status !== 'Cancelada'} podeRemover={EDITAVEIS.includes(status)} />
        </Cartao>
      )}

      {nota?.efetivada_por && status === 'Efetivada' && (
        <dl className="grid gap-3 rounded-cartao border border-borda-subtle bg-surface-raised p-4 md:grid-cols-3">
          <Dado rotulo={t('Efetivada por')}>{nota.efetivada_por}</Dado>
          <Dado rotulo={t('Efetivada em')}>{nota.efetivada_em ? formatarDataHora(nota.efetivada_em) : '—'}</Dado>
          <Dado rotulo={t('Divergência de preço')}>
            {nota.divergencia_aprovada_por ? t('aprovada por {usuario}', { usuario: nota.divergencia_aprovada_por }) : t('não houve')}
          </Dado>
        </dl>
      )}

      <Confirmacao
        aberto={modal === 'cancelar'}
        titulo={t('Cancelar nota fiscal')}
        mensagem={t('Cancelar esta nota? Ela não movimentou estoque e fica só para consulta. Não dá para desfazer.')}
        rotuloConfirmar={t('Cancelar nota')}
        rotuloOcupado={t('Cancelando…')}
        ocupado={mutacaoCancelar.isPending}
        aoConfirmar={() => mutacaoCancelar.mutate()}
        aoCancelar={() => definirModal(null)}
      />

      <Modal
        aberto={modal === 'estornar'}
        aoFechar={() => definirModal(null)}
        titulo={t('Estornar nota fiscal')}
        descricao={t('Desfaz a entrada: estoque, lotes, séries, custo médio e saldo do pedido voltam ao que eram.')}
        rodape={
          <>
            <Botao variante="secundaria" onClick={() => definirModal(null)} disabled={mutacaoEstornar.isPending}>
              {t('Voltar')}
            </Botao>
            <Botao
              variante="perigo"
              icone="undo-2"
              disabled={!motivoValido}
              ocupado={mutacaoEstornar.isPending}
              rotuloOcupado={t('Estornando…')}
              onClick={() => mutacaoEstornar.mutate()}
            >
              {t('Estornar')}
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {mutacaoEstornar.isError && (
            <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
              {mensagemDeErro(mutacaoEstornar.error, t('Não foi possível estornar a nota.'))}
            </p>
          )}
          <Campo
            rotulo={t('Motivo do estorno')}
            obrigatorio
            maxLength={255}
            ajuda={t('{n} de 10 a 255 caracteres. Se o material já foi reservado ou consumido, o estorno é recusado — corrija por ajuste de inventário justificado.', {
              n: motivoEstorno.trim().length,
            })}
            value={motivoEstorno}
            onChange={(e) => definirMotivoEstorno(e.target.value)}
          />
        </div>
      </Modal>

      <ImportarXML aberto={modal === 'importar'} aoFechar={() => definirModal(null)} pedidoInicial={pedidoId || undefined} />
    </div>
  );
}
