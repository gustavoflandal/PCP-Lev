import { Miniatura } from '@/componentes/arquivos/Miniatura';
import { CampoCertificado } from '@/componentes/recebimento/CampoCertificado';
import { EntradaSeries } from '@/componentes/recebimento/EntradaSeries';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { CaixaMarcacao } from '@/componentes/ui/CaixaMarcacao';
import { Campo } from '@/componentes/ui/Campo';
import { t } from '@/i18n';
import { formatarMoeda } from '@/lib/formato';
import {
  arredondar2,
  loteVazio,
  paraNumero,
  quantidadeEsperada,
  somaLotes,
  type FormItem,
  type FormLote,
} from './modeloNota';

export interface ItemDaNotaProps {
  item: FormItem;
  /** Posicao (1, 2, ...) -- a mesma "ordem" das pendencias da API. */
  ordem: number;
  aoMudar: (item: FormItem) => void;
  aoRemover: () => void;
  somenteLeitura: boolean;
}

const formatoQtd = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

/** Comparacao do preco unitario da NF (por unidade de consumo) com o do PC. */
function ComparacaoPreco({ item }: { item: FormItem }) {
  if (item.bonificacao || item.pc_preco_unitario === undefined) return null;
  const fator = paraNumero(item.fator_conversao) || 1;
  const precoNF = paraNumero(item.valor_unitario) / fator;
  const precoPC = item.pc_preco_unitario;
  const desvio = precoPC > 0 ? ((precoNF - precoPC) / precoPC) * 100 : 0;
  const igual = Math.abs(desvio) < 0.005;
  return (
    <p className="text-label text-texto-secondary">
      {t('Preço do pedido:')} <span className="tabular">{formatarMoeda(precoPC)}</span> · {t('na nota, por {unidade}:', { unidade: item.peca_unidade || t('unidade') })}{' '}
      <span className="tabular">{formatarMoeda(precoNF)}</span>{' '}
      {igual ? (
        <Badge tom="done" icone="check-circle-2">
          {t('Igual ao pedido')}
        </Badge>
      ) : (
        <Badge tom="warning" icone="alert-triangle">
          {t('Desvio de {valor}%', { valor: `${desvio > 0 ? '+' : ''}${formatoQtd.format(arredondar2(desvio))}` })}
        </Badge>
      )}
    </p>
  );
}

/** Uma linha da nota: quantidades, valores e, conforme as flags da peca, lotes, series e certificado. */
export function ItemDaNota({ item, ordem, aoMudar, aoRemover, somenteLeitura }: ItemDaNotaProps) {
  const rotulo = t('item {ordem} ({codigo})', { ordem, codigo: item.peca_codigo });
  const esperada = quantidadeEsperada(item);
  const recebida = paraNumero(item.quantidade_recebida);
  const diferenca = recebida - esperada;
  const { controla_lote: comLote, controla_validade: comValidade, controla_numero_serie: comSerie, exige_certificado: comCertificado } =
    item.controle;

  function mudar(parcial: Partial<FormItem>) {
    aoMudar({ ...item, ...parcial });
  }

  /** Quantidade ou unitario mudou: o total da linha acompanha (continua editavel). */
  function mudarValor(campo: 'quantidade_nf' | 'valor_unitario', valor: string) {
    const proximo = { ...item, [campo]: valor };
    const total = arredondar2(paraNumero(proximo.quantidade_nf) * paraNumero(proximo.valor_unitario));
    aoMudar({ ...proximo, valor_total: String(total) });
  }

  function mudarLote(chave: string, parcial: Partial<FormLote>) {
    mudar({ lotes: item.lotes.map((l) => (l.chave === chave ? { ...l, ...parcial } : l)) });
  }

  function removerLote(chave: string) {
    const removido = item.lotes.find((l) => l.chave === chave);
    mudar({
      lotes: item.lotes.filter((l) => l.chave !== chave),
      // A serie apontava o lote removido: fica sem lote (a conferencia acusa).
      series: item.series.map((s) => (removido && s.numero_lote === removido.numero_lote ? { numero: s.numero } : s)),
    });
  }

  const soma = somaLotes(item);
  const lotesInformados = item.lotes.map((l) => l.numero_lote.trim()).filter((n) => n !== '');

  return (
    <article
      aria-label={t('Item {ordem} — {codigo}', { ordem, codigo: item.peca_codigo })}
      className="flex flex-col gap-3 rounded-cartao border border-borda-subtle bg-surface-raised p-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Miniatura url={item.foto_url} alt={t('Foto da peça {codigo}', { codigo: item.peca_codigo })} tamanho="media" critico={item.controle.item_critico} />
          <div className="flex flex-col gap-1">
            <p className="text-label text-texto-secondary">{t('Item {n}', { n: ordem })}</p>
            <p className="text-subtitle text-texto-primary">
              <span className="font-mono">{item.peca_codigo}</span> {item.peca_descricao && `— ${item.peca_descricao}`}
            </p>
            <div className="flex flex-wrap gap-2">
              {item.bonificacao ? (
                <Badge tom="neutral" icone="package">
                  {t('Bonificação (sem pedido)')}
                </Badge>
              ) : item.numero_pc ? (
                <Badge tom="neutral" icone="shopping-cart">
                  {item.pc_quantidade_solicitada !== undefined
                    ? t('Pedido {numero} · recebido {recebido} de {solicitado}', {
                        numero: item.numero_pc,
                        recebido: item.pc_quantidade_recebida ?? 0,
                        solicitado: item.pc_quantidade_solicitada,
                      })
                    : t('Pedido {numero}', { numero: item.numero_pc })}
                </Badge>
              ) : null}
              {comLote && (
                <Badge tom="blocked" icone="layers">
                  {comValidade ? t('Lote e validade') : t('Lote')}
                </Badge>
              )}
              {comSerie && (
                <Badge tom="blocked" icone="scan-line">
                  {t('Número de série')}
                </Badge>
              )}
              {comCertificado && (
                <Badge tom="blocked" icone="file-text">
                  {t('Exige certificado')}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {!somenteLeitura && (
          <Botao variante="fantasma" icone="trash-2" aria-label={t('Remover {rotulo}', { rotulo })} onClick={aoRemover}>
            {t('Remover')}
          </Botao>
        )}
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <Campo
          rotulo={t('Código no fornecedor')}
          tipoDado="codigo"
          value={item.codigo_fornecedor}
          onChange={(e) => mudar({ codigo_fornecedor: e.target.value })}
        />
        <Campo rotulo={t('Unidade na nota')} value={item.unidade_nf} onChange={(e) => mudar({ unidade_nf: e.target.value })} />
        <Campo
          rotulo={t('Quantidade na nota — {rotulo}', { rotulo })}
          tipoDado="quantidade"
          value={item.quantidade_nf}
          onChange={(e) => mudarValor('quantidade_nf', e.target.value)}
        />
        <Campo
          rotulo={t('Fator de conversão')}
          tipoDado="quantidade"
          ajuda={`1 ${item.unidade_nf || t('un. da nota')} = ${formatoQtd.format(paraNumero(item.fator_conversao) || 1)} ${item.peca_unidade || t('un.')}`}
          value={item.fator_conversao}
          onChange={(e) => mudar({ fator_conversao: e.target.value })}
        />
        <Campo
          rotulo={t('Quantidade recebida (contada) — {rotulo}', { rotulo })}
          tipoDado="quantidade"
          ajuda={t('Em {unidade} de consumo. A nota declara {valor}.', {
            unidade: item.peca_unidade || t('unidades'),
            valor: formatoQtd.format(esperada),
          })}
          value={item.quantidade_recebida}
          onChange={(e) => mudar({ quantidade_recebida: e.target.value })}
        />
        {(
          <>
            <Campo
              rotulo={t('Valor unitário (R$)')}
              tipoDado="quantidade"
              value={item.valor_unitario}
              onChange={(e) => mudarValor('valor_unitario', e.target.value)}
            />
            <Campo
              rotulo={t('Valor total do item (R$)')}
              tipoDado="quantidade"
              value={item.valor_total}
              onChange={(e) => mudar({ valor_total: e.target.value })}
            />
          </>
        )}
        <div className="flex items-end">
          {item.quantidade_recebida.trim() === '' ? null : Math.abs(diferenca) < 1e-6 ? (
            <Badge tom="done" icone="check-circle-2">
              {t('Contado igual à nota')}
            </Badge>
          ) : (
            <Badge tom="warning" icone="alert-triangle">
              {t('Diferença: {valor} (pendente com o fornecedor)', { valor: `${diferenca > 0 ? '+' : ''}${formatoQtd.format(diferenca)}` })}
            </Badge>
          )}
        </div>
      </div>

      <ComparacaoPreco item={item} />

      {item.bonificacao && (
        <Campo
          rotulo={t('Justificativa da bonificação — {rotulo}', { rotulo })}
          obrigatorio
          ajuda={t('Ao menos 10 caracteres. Informe os valores como estão na nota: a bonificação entra com custo zero e não mexe no saldo do pedido.')}
          value={item.justificativa_bonificacao}
          onChange={(e) => mudar({ justificativa_bonificacao: e.target.value })}
        />
      )}
      {!somenteLeitura && !item.bonificacao && item.item_pedido_compra_id === null && (
        <CaixaMarcacao
          rotulo={t('Item sem pedido de compra: marcar como bonificação')}
          checked={item.bonificacao}
          onChange={(e) => mudar({ bonificacao: e.target.checked })}
        />
      )}

      {comLote && (
        <section aria-label={t('Lotes — {rotulo}', { rotulo })} className="flex flex-col gap-2 rounded-cartao border border-borda-subtle bg-surface-sunken p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-label text-texto-secondary">{t('Lotes do item')}</p>
            <Badge tom={soma === recebida && recebida > 0 ? 'done' : 'pending'} icone={soma === recebida && recebida > 0 ? 'check-circle-2' : 'alert-triangle'}>
              <span aria-live="polite">{t('Soma dos lotes: {soma} de {total}', { soma, total: formatoQtd.format(recebida) })}</span>
            </Badge>
          </div>
          {item.lotes.length === 0 && <p className="text-body text-texto-secondary">{t('Informe ao menos um lote: a soma precisa fechar com a quantidade recebida.')}</p>}
          {item.lotes.map((l, i) => (
            <div key={l.chave} className="grid items-end gap-2 rounded-campo border border-borda-subtle bg-surface-raised p-2 md:grid-cols-5">
              <Campo
                rotulo={t('Lote {n} — número', { n: i + 1 })}
                tipoDado="codigo"
                value={l.numero_lote}
                onChange={(e) => {
                  const anterior = l.numero_lote;
                  const novo = e.target.value;
                  mudar({
                    lotes: item.lotes.map((x) => (x.chave === l.chave ? { ...x, numero_lote: novo } : x)),
                    series: item.series.map((s) => (anterior !== '' && s.numero_lote === anterior ? { ...s, numero_lote: novo } : s)),
                  });
                }}
              />
              <Campo
                rotulo={t('Lote {n} — quantidade', { n: i + 1 })}
                tipoDado="quantidade"
                value={l.quantidade}
                onChange={(e) => mudarLote(l.chave, { quantidade: e.target.value })}
              />
              <Campo
                rotulo={t('Lote {n} — fabricação', { n: i + 1 })}
                type="date"
                value={l.data_fabricacao}
                onChange={(e) => mudarLote(l.chave, { data_fabricacao: e.target.value })}
              />
              {comValidade ? (
                <Campo
                  rotulo={t('Lote {n} — validade', { n: i + 1 })}
                  type="date"
                  obrigatorio
                  value={l.validade}
                  onChange={(e) => mudarLote(l.chave, { validade: e.target.value })}
                />
              ) : (
                <span />
              )}
              {!somenteLeitura && (
                <Botao variante="fantasma" icone="trash-2" aria-label={t('Remover lote {n} — {rotulo}', { n: i + 1, rotulo })} onClick={() => removerLote(l.chave)}>
                  {t('Remover lote')}
                </Botao>
              )}
              {comCertificado && (
                <div className="md:col-span-5">
                  <CampoCertificado
                    rotulo={t('lote {lote} — {rotulo}', { lote: l.numero_lote || i + 1, rotulo })}
                    arquivoId={l.certificado_arquivo_id}
                    aoMudar={(id) => mudarLote(l.chave, { certificado_arquivo_id: id })}
                    desabilitado={somenteLeitura}
                  />
                </div>
              )}
            </div>
          ))}
          {!somenteLeitura && (
            <div>
              <Botao variante="secundaria" icone="plus" onClick={() => mudar({ lotes: [...item.lotes, loteVazio()] })}>
                {t('Adicionar lote')}
              </Botao>
            </div>
          )}
        </section>
      )}

      {!comLote && comCertificado && (
        <CampoCertificado
          rotulo={rotulo}
          arquivoId={item.certificado_arquivo_id}
          aoMudar={(id) => mudar({ certificado_arquivo_id: id })}
          desabilitado={somenteLeitura}
        />
      )}

      {comSerie && (
        <EntradaSeries
          rotulo={rotulo}
          series={item.series}
          esperado={Math.max(0, Math.trunc(recebida))}
          lotes={comLote ? lotesInformados : undefined}
          aoMudar={(series) => mudar({ series })}
          desabilitado={somenteLeitura}
        />
      )}
    </article>
  );
}
