import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { corpoNovoAnexo, mensagemDeErro } from '@/componentes/arquivos/comum';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Modal } from '@/componentes/ui/Modal';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { useFornecedoresAtivos } from '@/hooks/useFornecedoresAtivos';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { usePedidosQueRecebem } from '@/hooks/usePedidosQueRecebem';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatarCNPJ, formatarData, formatarMoeda } from '@/lib/formato';
import { anexar } from '@/servicos/arquivos';
import { obterCompra } from '@/servicos/compras';
import { criarNota, importarXML, salvarDePara } from '@/servicos/notasEntrada';
import type { PedidoCompra } from '@/tipos/compras';
import type { ItemXML, PreviaXML } from '@/tipos/notasEntrada';
import { paraNumero, previaParaCorpo, vincularItemXML } from './modeloNota';

export interface ImportarXMLProps {
  aberto: boolean;
  aoFechar: () => void;
  /** PC ja escolhido na tela de origem (nota nova a partir do pedido). */
  pedidoInicial?: number;
}

const formatoQtd = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

/** arquivo.LimiteXML no backend. */
const LIMITE_XML_BYTES = 2 * 1024 * 1024;

/**
 * Importacao do XML da NF-e (R3): escolhe o PC e o arquivo, mostra a previa
 * (cabecalho e itens), pede o vinculo dos itens nao reconhecidos -- gravado
 * como de-para do fornecedor, "memorizado para as proximas notas" -- e cria o
 * rascunho com o XML anexado.
 */
export function ImportarXML({ aberto, aoFechar, pedidoInicial }: ImportarXMLProps) {
  return aberto ? <ConteudoImportar aoFechar={aoFechar} pedidoInicial={pedidoInicial} /> : null;
}

interface Vinculo {
  peca: string;
  fator: string;
  erro?: string;
}

function ConteudoImportar({ aoFechar, pedidoInicial }: Omit<ImportarXMLProps, 'aberto'>) {
  const navegar = useNavigate();
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const idArquivo = useId();
  const { porId: fornecedorPorId } = useFornecedoresAtivos();
  const pedidos = usePedidosQueRecebem(fornecedorPorId);
  const pecas = usePartesPecasAtivas();
  const [pedidoId, definirPedidoId] = useState(pedidoInicial ? String(pedidoInicial) : '');
  const [arquivo, definirArquivo] = useState<File | null>(null);
  const [previa, definirPrevia] = useState<PreviaXML | null>(null);
  const [vinculos, definirVinculos] = useState<Record<number, Vinculo>>({});
  const [memorizados, definirMemorizados] = useState<Set<number>>(new Set());
  const [erro, definirErro] = useState<string | null>(null);

  const pedidoNum = Number(pedidoId) || 0;
  const pedidoDetalhe = useQuery({
    queryKey: ['pedidos-compra', pedidoNum],
    queryFn: () => obterCompra<PedidoCompra>('pedidos-compra', pedidoNum),
    enabled: pedidoNum > 0,
  });
  const fornecedorId = pedidoDetalhe.data?.fornecedor_id ?? pedidos.porId.get(pedidoNum)?.fornecedor_id ?? 0;
  const pecaPorId = useMemo(() => new Map(pecas.itens.map((p) => [p.id, p])), [pecas.itens]);

  // Pecas do PC primeiro: e quase sempre uma delas.
  const opcoesPeca = useMemo(() => {
    const doPedido = new Set((pedidoDetalhe.data?.itens ?? []).map((i) => i.parte_peca_id));
    return [
      ...pecas.itens.filter((p) => doPedido.has(p.id)).map((p) => ({ valor: String(p.id), rotulo: `${p.codigo} — ${p.descricao} ${t('(no pedido)')}` })),
      ...pecas.itens.filter((p) => !doPedido.has(p.id)).map((p) => ({ valor: String(p.id), rotulo: `${p.codigo} — ${p.descricao}` })),
    ];
  }, [pecas.itens, pedidoDetalhe.data]);

  const leitura = useMutation({
    mutationFn: () => importarXML(pedidoNum, arquivo as File),
    onMutate: () => definirErro(null),
    onSuccess: (p) => {
      definirPrevia(p);
      definirVinculos(
        Object.fromEntries(p.itens.filter((i) => !i.parte_peca_id).map((i) => [i.numero_item, { peca: '', fator: '1' }])),
      );
    },
    onError: (e) => definirErro(mensagemDeErro(e, t('Não foi possível ler o XML. Confira o arquivo e tente de novo.'))),
  });

  const vinculo = useMutation({
    mutationFn: async ({ item, v }: { item: ItemXML; v: Vinculo }) => {
      const peca = pecaPorId.get(Number(v.peca));
      if (!peca) throw new Error('peca');
      const fator = paraNumero(v.fator);
      await salvarDePara(fornecedorId, {
        parte_peca_id: peca.id,
        codigo_fornecedor: item.codigo_fornecedor,
        descricao_fornecedor: item.descricao.slice(0, 255),
        unidade_fornecedor: item.unidade.slice(0, 10),
        fator_conversao: fator,
      });
      return { item, peca, fator };
    },
    onSuccess: ({ item, peca, fator }) => {
      definirPrevia((atual) => {
        if (!atual) return atual;
        const usados = new Map<number, number>();
        for (const i of atual.itens) {
          if (i.item_pedido_compra_id && i.numero_item !== item.numero_item) {
            usados.set(i.item_pedido_compra_id, (usados.get(i.item_pedido_compra_id) ?? 0) + i.quantidade_recebida);
          }
        }
        return {
          ...atual,
          nao_reconhecidos: Math.max(0, atual.nao_reconhecidos - 1),
          itens: atual.itens.map((i) =>
            i.numero_item === item.numero_item ? vincularItemXML(i, peca, fator, pedidoDetalhe.data?.itens ?? [], usados) : i,
          ),
        };
      });
      definirMemorizados((atual) => new Set(atual).add(item.numero_item));
      void clienteQuery.invalidateQueries({ queryKey: ['de-para', fornecedorId] });
    },
    onError: (e, { item }) =>
      definirVinculos((atual) => ({
        ...atual,
        [item.numero_item]: { ...atual[item.numero_item], erro: mensagemDeErro(e, t('Não foi possível gravar o vínculo.')) },
      })),
  });

  const criacao = useMutation({
    mutationFn: async () => {
      const p = previa as PreviaXML;
      const nota = await criarNota(previaParaCorpo(p, pecaPorId));
      let xmlAnexado = true;
      if (p.arquivo_id) {
        try {
          await anexar(
            corpoNovoAnexo('nota_entrada', nota.id, p.arquivo_id, {
              tipo: 'ANEXO',
              categoria: 'XML da NF-e',
              titulo: arquivo?.name ?? 'XML da NF-e',
            }),
          );
        } catch {
          xmlAnexado = false;
        }
      }
      return { nota, xmlAnexado };
    },
    onMutate: () => definirErro(null),
    onSuccess: ({ nota, xmlAnexado }) => {
      clienteQuery.setQueryData(['notas-entrada', nota.id], nota);
      void clienteQuery.invalidateQueries({ queryKey: ['notas-entrada'] });
      mostrarToast(
        xmlAnexado ? t('Rascunho criado a partir do XML') : t('Rascunho criado — anexe o XML na nota (o anexo automático falhou)'),
        xmlAnexado ? 'done' : 'pending',
      );
      aoFechar();
      navegar(`/notas-entrada/${nota.id}`);
    },
    onError: (e) => definirErro(mensagemDeErro(e, t('Não foi possível criar o rascunho.'))),
  });

  const pendentes = previa ? previa.itens.filter((i) => !i.parte_peca_id).length : 0;

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={t('Importar XML da NF-e')}
      descricao={t('Lê cabeçalho, itens, totais e lotes do XML. Nada é gravado até criar o rascunho.')}
      largura="larga"
      rodape={
        previa ? (
          <>
            <Botao variante="secundaria" onClick={() => definirPrevia(null)} disabled={criacao.isPending}>
              {t('Escolher outro arquivo')}
            </Botao>
            <Botao
              icone="save"
              disabled={pendentes > 0}
              ocupado={criacao.isPending}
              rotuloOcupado={t('Criando…')}
              onClick={() => criacao.mutate()}
            >
              {t('Criar rascunho')}
            </Botao>
          </>
        ) : (
          <>
            <Botao variante="secundaria" onClick={aoFechar}>
              {t('Cancelar')}
            </Botao>
            <Botao
              icone="file-code"
              disabled={!pedidoNum || !arquivo}
              ocupado={leitura.isPending}
              rotuloOcupado={t('Lendo…')}
              onClick={() => leitura.mutate()}
            >
              {t('Ler XML')}
            </Botao>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {erro && (
          <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
            {erro}
          </p>
        )}

        {!previa ? (
          <>
            <Selecao
              rotulo={t('Pedido de compra')}
              obrigatorio
              placeholder={pedidos.carregando ? t('Carregando pedidos…') : t('Escolha o pedido que a nota atende')}
              opcoes={pedidos.opcoes}
              ajuda={t('Só pedidos aguardando entrega ou recebidos parcialmente. O CNPJ do emitente precisa ser o do fornecedor do pedido.')}
              value={pedidoId}
              onChange={(e) => definirPedidoId(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label htmlFor={idArquivo} className="text-label text-texto-secondary">
                {t('Arquivo XML da NF-e')}<span aria-hidden="true" className="ml-1 text-estado-pending">*</span>
              </label>
              <input
                id={idArquivo}
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={(e) => {
                  const escolhido = e.target.files?.[0] ?? null;
                  // Limite do backend (arquivo.LimiteXML): avisa antes de enviar.
                  if (escolhido && escolhido.size > LIMITE_XML_BYTES) {
                    definirErro(t('O XML passa de 2 MB: confira se é o arquivo da NF-e.'));
                    definirArquivo(null);
                    return;
                  }
                  definirErro(null);
                  definirArquivo(escolhido);
                }}
                className="text-body text-texto-primary file:mr-3 file:rounded-campo file:border file:border-borda-strong file:bg-surface-raised file:px-3 file:py-2"
              />
              <p className="text-label text-texto-secondary">{t('XML da NF-e modelo 55, até 2 MB.')}</p>
            </div>
          </>
        ) : (
          <>
            <dl className="grid gap-3 rounded-cartao border border-borda-subtle bg-surface-sunken p-3 md:grid-cols-4">
              <Dado rotulo={t('Emitente')}>
                {previa.nome_emitente} · <span className="font-mono">{formatarCNPJ(previa.cnpj_emitente)}</span>
              </Dado>
              <Dado rotulo={t('Número / série')}>
                <span className="font-mono">
                  {previa.numero}/{previa.serie}
                </span>
              </Dado>
              <Dado rotulo={t('Emissão')}>{formatarData(previa.data_emissao ?? undefined)}</Dado>
              <Dado rotulo={t('Valor total')}>
                <span className="tabular">{formatarMoeda(previa.valor_total)}</span>
              </Dado>
              <div className="md:col-span-4">
                <Dado rotulo={t('Chave de acesso')}>
                  <span className="break-all font-mono">{previa.chave_acesso}</span>
                </Dado>
              </div>
            </dl>

            {pendentes > 0 ? (
              <p role="status" className="flex items-center gap-2 rounded-campo border border-estado-warning bg-estado-warning-bg px-3 py-2 text-body text-estado-warning">
                {pendentes === 1
                  ? t('1 item não reconhecido: vincule-o a uma peça para criar o rascunho.')
                  : t('{n} itens não reconhecidos: vincule-os a uma peça para criar o rascunho.', { n: pendentes })}
              </p>
            ) : (
              <p role="status" className="rounded-campo border border-estado-done bg-estado-done-bg px-3 py-2 text-body text-estado-done">
                {t('Todos os itens reconhecidos. Confira e crie o rascunho — lotes, séries e a contagem são completados na nota.')}
              </p>
            )}

            <ul aria-label={t('Itens do XML')} className="flex flex-col gap-2">
              {previa.itens.map((i) => {
                const reconhecido = !!i.parte_peca_id;
                const v = vinculos[i.numero_item];
                return (
                  <li
                    key={i.numero_item}
                    aria-label={t('Item {n} do XML — {codigo}', { n: i.numero_item, codigo: i.codigo_fornecedor })}
                    className={cn(
                      'flex flex-col gap-2 rounded-cartao border p-3',
                      reconhecido ? 'border-borda-subtle bg-surface-raised' : 'border-2 border-estado-warning bg-estado-warning-bg',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-body text-texto-primary">
                          <span className="font-mono">{i.codigo_fornecedor}</span> — {i.descricao}
                        </span>
                        <span className="text-label text-texto-secondary">
                          {formatoQtd.format(i.quantidade)} {i.unidade} × {formatarMoeda(i.valor_unitario)} = {formatarMoeda(i.valor_total)}
                          {(i.lotes ?? []).length > 0 &&
                            ` · ${t('lotes:')} ${(i.lotes ?? []).map((l) => `${l.numero_lote} (${l.quantidade})`).join(', ')}`}
                        </span>
                      </div>
                      {reconhecido ? (
                        <Badge tom="done" icone="link">
                          {t('{codigo} · fator {fator} · recebe {qtd}', {
                            codigo: i.peca_codigo ?? '',
                            fator: formatoQtd.format(i.fator_conversao),
                            qtd: i.quantidade_recebida,
                          })}
                        </Badge>
                      ) : (
                        <Badge tom="warning" icone="alert-triangle">
                          {t('Não reconhecido')}
                        </Badge>
                      )}
                    </div>
                    {reconhecido && !i.item_pedido_compra_id && (
                      <p className="text-label text-estado-warning">
                        {t('A peça não está neste pedido: ajuste no rascunho (bonificação ou outro pedido).')}
                      </p>
                    )}
                    {memorizados.has(i.numero_item) && (
                      <p className="text-label text-estado-done">{t('Vínculo memorizado para as próximas notas deste fornecedor.')}</p>
                    )}
                    {!reconhecido && v && (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[280px] flex-1">
                          <Selecao
                            rotulo={t('Peça do item {codigo}', { codigo: i.codigo_fornecedor })}
                            placeholder={t('Escolha a peça')}
                            opcoes={opcoesPeca}
                            erro={v.erro}
                            value={v.peca}
                            onChange={(e) => definirVinculos((a) => ({ ...a, [i.numero_item]: { ...v, peca: e.target.value, erro: undefined } }))}
                          />
                        </div>
                        <div className="w-[160px]">
                          <Campo
                            rotulo={t('Fator — {codigo}', { codigo: i.codigo_fornecedor })}
                            tipoDado="quantidade"
                            ajuda={t('1 {unidade} = ? un. de consumo', { unidade: i.unidade || t('un.') })}
                            value={v.fator}
                            onChange={(e) => definirVinculos((a) => ({ ...a, [i.numero_item]: { ...v, fator: e.target.value, erro: undefined } }))}
                          />
                        </div>
                        <Botao
                          icone="link"
                          className="mb-[1.25rem]"
                          disabled={!v.peca || paraNumero(v.fator) <= 0 || !fornecedorId}
                          ocupado={vinculo.isPending && vinculo.variables?.item.numero_item === i.numero_item}
                          rotuloOcupado={t('Vinculando…')}
                          onClick={() => vinculo.mutate({ item: i, v })}
                        >
                          {t('Vincular e memorizar')}
                        </Botao>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Modal>
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
