import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { icones } from '@/componentes/ui/icones';
import { t } from '@/i18n';
import { gerarFaixa, LIMITE_FAIXA, separarLista } from '@/lib/series';
import type { SerieItem } from '@/tipos/notasEntrada';

export interface EntradaSeriesProps {
  /** Nome do item (entra nos rotulos para o leitor de tela). */
  rotulo: string;
  series: SerieItem[];
  /** Quantas series sao esperadas (uma por unidade recebida/ajustada). */
  esperado: number;
  aoMudar: (series: SerieItem[]) => void;
  /** Numeros dos lotes da linha: com lote, cada serie aponta o seu. */
  lotes?: string[];
  desabilitado?: boolean;
  /** Foca o campo de bipagem ao montar (uma unica entrada por tela). */
  focarAoAbrir?: boolean;
}

/**
 * Entrada de numeros de serie pensada para o leitor de codigo de barras: o
 * leitor age como teclado + Enter, entao o campo adiciona a serie e se limpa
 * sem perder o foco -- a bipagem segue continua. Tambem aceita colar uma
 * lista e gerar uma faixa sequencial.
 */
export function EntradaSeries({ rotulo, series, esperado, aoMudar, lotes, desabilitado, focarAoAbrir }: EntradaSeriesProps) {
  const [bipada, definirBipada] = useState('');
  const [aviso, definirAviso] = useState<string | null>(null);
  const [painel, definirPainel] = useState<'colar' | 'faixa' | null>(null);
  const [colada, definirColada] = useState('');
  const [prefixo, definirPrefixo] = useState('');
  const [inicio, definirInicio] = useState('');
  const [fim, definirFim] = useState('');
  const [loteAtual, definirLoteAtual] = useState('');
  const campoRef = useRef<HTMLInputElement>(null);
  const idColar = useId();
  const IconeRemover = icones.x;
  const temLote = !!lotes && lotes.length > 0;
  const loteDasNovas = temLote ? (lotes.includes(loteAtual) ? loteAtual : lotes[0]) : undefined;

  function adicionar(numeros: string[]) {
    const existentes = new Set(series.map((s) => s.numero));
    const novas: SerieItem[] = [];
    const repetidas: string[] = [];
    for (const numero of numeros) {
      if (existentes.has(numero)) {
        repetidas.push(numero);
        continue;
      }
      existentes.add(numero);
      novas.push(loteDasNovas ? { numero, numero_lote: loteDasNovas } : { numero });
    }
    if (novas.length > 0) aoMudar([...series, ...novas]);
    definirAviso(
      repetidas.length === 0
        ? null
        : repetidas.length === 1
          ? t('Série {numero} já informada — ignorada.', { numero: repetidas[0] })
          : t('{n} séries repetidas ignoradas ({lista}).', {
              n: repetidas.length,
              lista: `${repetidas.slice(0, 3).join(', ')}${repetidas.length > 3 ? '…' : ''}`,
            }),
    );
    return novas.length;
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key !== 'Enter') return;
    // Enter do leitor nao pode enviar o formulario da nota.
    evento.preventDefault();
    const numero = bipada.trim();
    if (numero === '') return;
    adicionar([numero]);
    definirBipada('');
    campoRef.current?.focus();
  }

  function adicionarColada() {
    const lista = separarLista(colada);
    if (lista.length === 0) {
      definirAviso(t('Cole ao menos uma série (uma por linha).'));
      return;
    }
    adicionar(lista);
    definirColada('');
    definirPainel(null);
  }

  function adicionarFaixa() {
    const lista = gerarFaixa(prefixo.trim(), inicio.trim(), fim.trim());
    if (!lista) {
      definirAviso(t('Faixa inválida: início e fim só com dígitos, fim maior ou igual ao início, até {limite} séries.', { limite: LIMITE_FAIXA }));
      return;
    }
    adicionar(lista);
    definirPainel(null);
  }

  function remover(numero: string) {
    aoMudar(series.filter((s) => s.numero !== numero));
  }

  function mudarLote(numero: string, numeroLote: string) {
    aoMudar(series.map((s) => (s.numero === numero ? { ...s, numero_lote: numeroLote } : s)));
  }

  const informadas = series.length;
  const completo = informadas === esperado && esperado > 0;
  const excesso = informadas > esperado;

  return (
    <div className="flex flex-col gap-3 rounded-cartao border border-borda-subtle bg-surface-sunken p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label text-texto-secondary">{t('Números de série')}</p>
        <Badge
          tom={completo ? 'done' : excesso ? 'pending' : 'warning'}
          icone={completo ? 'check-circle-2' : 'alert-triangle'}
        >
          <span aria-live="polite">
            {t('{n} de {total} séries informadas', { n: informadas, total: esperado })}
          </span>
        </Badge>
      </div>

      {!desabilitado && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <Campo
                ref={campoRef}
                rotulo={t('Bipar ou digitar série — {rotulo}', { rotulo })}
                ajuda={t('Enter adiciona e limpa o campo para a próxima.')}
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                autoFocus={focarAoAbrir}
                value={bipada}
                onChange={(e) => definirBipada(e.target.value)}
                onKeyDown={aoTeclar}
              />
            </div>
            {temLote && (
              <div className="w-[200px]">
                <Selecao
                  rotulo={t('Lote das próximas séries')}
                  opcoes={lotes.map((l) => ({ valor: l, rotulo: l }))}
                  value={loteDasNovas}
                  onChange={(e) => definirLoteAtual(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao variante="secundaria" icone="clipboard-paste" onClick={() => definirPainel(painel === 'colar' ? null : 'colar')}>
              {t('Colar lista')}
            </Botao>
            <Botao variante="secundaria" icone="list-ordered" onClick={() => definirPainel(painel === 'faixa' ? null : 'faixa')}>
              {t('Gerar faixa')}
            </Botao>
            {informadas > 0 && (
              <Botao variante="fantasma" icone="trash-2" onClick={() => aoMudar([])}>
                {t('Limpar séries')}
              </Botao>
            )}
          </div>

          {painel === 'colar' && (
            <div className="flex flex-col gap-2">
              <label htmlFor={idColar} className="text-label text-texto-secondary">
                {t('Séries coladas (uma por linha)')}
              </label>
              <textarea
                id={idColar}
                rows={4}
                value={colada}
                onChange={(e) => definirColada(e.target.value)}
                className="w-full rounded-campo border border-borda-strong bg-surface-raised px-3 py-2 font-mono text-body text-texto-primary"
              />
              <div>
                <Botao icone="plus" onClick={adicionarColada}>
                  {t('Adicionar lista')}
                </Botao>
              </div>
            </div>
          )}

          {painel === 'faixa' && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-[120px]">
                <Campo rotulo={t('Prefixo')} className="font-mono" value={prefixo} onChange={(e) => definirPrefixo(e.target.value)} />
              </div>
              <div className="w-[120px]">
                <Campo rotulo={t('Início')} tipoDado="quantidade" value={inicio} onChange={(e) => definirInicio(e.target.value)} />
              </div>
              <div className="w-[120px]">
                <Campo rotulo={t('Fim')} tipoDado="quantidade" value={fim} onChange={(e) => definirFim(e.target.value)} />
              </div>
              <Botao icone="plus" onClick={adicionarFaixa}>
                {t('Adicionar faixa')}
              </Botao>
            </div>
          )}
        </>
      )}

      {aviso && (
        <p role="alert" className="text-label text-estado-warning">
          {aviso}
        </p>
      )}

      {informadas > 0 && (
        <ul aria-label={t('Séries informadas — {rotulo}', { rotulo })} className="flex max-h-[220px] flex-wrap gap-2 overflow-y-auto">
          {series.map((s) => (
            <li
              key={s.numero}
              className="inline-flex items-center gap-1 rounded-campo border border-borda-subtle bg-surface-raised px-2 py-1"
            >
              <span className="font-mono text-body tabular text-texto-primary">{s.numero}</span>
              {temLote && (
                <select
                  aria-label={t('Lote da série {numero}', { numero: s.numero })}
                  disabled={desabilitado}
                  value={s.numero_lote ?? ''}
                  onChange={(e) => mudarLote(s.numero, e.target.value)}
                  className="h-[1.75rem] rounded-campo border border-borda-strong bg-surface-raised px-1 text-label"
                >
                  <option value="">{t('sem lote')}</option>
                  {lotes.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
              {!desabilitado && (
                <button
                  type="button"
                  aria-label={t('Remover série {numero}', { numero: s.numero })}
                  onClick={() => remover(s.numero)}
                  className="rounded-campo p-1 text-texto-secondary hover:bg-surface-sunken"
                >
                  <IconeRemover size={12} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
