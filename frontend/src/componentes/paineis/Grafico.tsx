import { useId, useState, type ReactElement } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Botao } from '@/componentes/ui/Botao';
import { icones } from '@/componentes/ui/icones';
import { t, td } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatarValor, formatarValorEixo, type FormatoValor } from '@/lib/paineis';
import { useModoTV } from '@/store/modoTV';
import type { Ponto } from '@/tipos/paineis';

/** Uma serie do grafico: nome (legenda e coluna da tabela) e os pontos. */
export interface SerieGrafico {
  nome: string;
  pontos: Ponto[];
}

/**
 * Paleta categorica -- so tokens (--grafico-N, com variante no tema escuro).
 * Sao cores de categoria: estado (verde/vermelho = ok/problema) nunca entra
 * aqui sem rotulo.
 */
const CORES_SERIES = Array.from({ length: 8 }, (_, i) => `var(--grafico-${i + 1})`);

/**
 * Cor de cada barra. Com uma serie so, cada categoria (mes, fornecedor,
 * situacao) ganha uma cor da paleta; com varias, a cor identifica a serie
 * (e a legenda a explica), entao todas as barras dela levam a mesma.
 */
const corDaBarra = (serie: number, categoria: number, series: number) =>
  CORES_SERIES[(series > 1 ? serie : categoria) % CORES_SERIES.length];

/**
 * Linha e area de uma serie so nao tem categorias para colorir: cada grafico
 * pega uma cor da paleta pelo titulo (estavel entre renderizacoes), em vez
 * de todos ficarem na mesma.
 */
function corDaLinha(serie: number, series: number, titulo: string): string {
  if (series > 1) return CORES_SERIES[serie % CORES_SERIES.length];
  let hash = 0;
  for (const c of titulo) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return CORES_SERIES[hash % CORES_SERIES.length];
}

const COR_TEXTO_EIXO = 'var(--text-secondary)';
const COR_GRADE = 'var(--border-subtle)';
const ESTILO_DICA = {
  backgroundColor: 'var(--surface-raised)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
};
const TICK = { fill: COR_TEXTO_EIXO, fontSize: '0.75rem' };

type TipoGrafico = 'barras' | 'linha' | 'area' | 'barras-horizontais';

export interface GraficoProps {
  titulo: string;
  series: SerieGrafico[];
  /** Como os valores sao escritos (eixo, dica e tabela). */
  formato?: FormatoValor;
  /** Converte o rotulo bruto da API no de exibicao ("2026-10" -> "out/26"). */
  formatarRotulo?: (rotulo: string) => string;
  /** Cabecalho da coluna de rotulos na tabela "Ver dados" (ex.: "Mês", "Fornecedor"). */
  rotuloCategoria: string;
  /** Frase do estado vazio: diz o que falta. */
  vazio: string;
  carregando?: boolean;
  /** Mensagem de erro; com ela, o grafico da lugar ao aviso. */
  erro?: string | null;
  aoTentarDeNovo?: () => void;
}

interface Linha {
  rotulo: string;
  exibicao: string;
  /** Um valor por serie, na ordem de `series`. */
  valores: (number | undefined)[];
}

/** Chave de dado da serie `i` para o recharts. */
const valorDa = (i: number) => (linha: Linha) => linha.valores[i];

function montarLinhas(series: SerieGrafico[], formatarRotulo: (r: string) => string): Linha[] {
  const linhas = new Map<string, Linha>();
  series.forEach((serie, indice) => {
    for (const ponto of serie.pontos) {
      const linha = linhas.get(ponto.rotulo) ?? { rotulo: ponto.rotulo, exibicao: formatarRotulo(ponto.rotulo), valores: [] };
      linha.valores[indice] = ponto.valor;
      linhas.set(ponto.rotulo, linha);
    }
  });
  return [...linhas.values()];
}

const identidade = (r: string) => td(r);

/** Nome longo (fornecedor, produto) cortado no eixo; a tabela mostra inteiro. */
function encurtar(texto: string, limite = 22): string {
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
}

function Grafico({
  tipo,
  titulo,
  series,
  formato = 'numero',
  formatarRotulo = identidade,
  rotuloCategoria,
  vazio,
  carregando,
  erro,
  aoTentarDeNovo,
}: GraficoProps & { tipo: TipoGrafico }) {
  const idTitulo = useId();
  const idTabela = useId();
  const [verDados, setVerDados] = useState(false);

  const linhas = montarLinhas(series, formatarRotulo);
  // Serie cheia de zeros (meses sem compra) tambem e "sem dado": um eixo
  // reto no zero nao informa nada. Percentual e excecao: 0% de entregas no
  // prazo e um resultado (o backend nem manda o mes sem entrega).
  const tudoZero = formato !== 'percentual' && series.every((s) => s.pontos.every((p) => p.valor === 0));
  const semDados = linhas.length === 0 || tudoZero;
  const estado = erro ? 'erro' : carregando ? 'carregando' : semDados ? 'vazio' : 'dados';

  const formatarEixo = (v: unknown) => formatarValorEixo(Number(v), formato);
  const formatarCompleto = (v: unknown) => formatarValor(Number(v), formato);
  // No modo TV o grafico ocupa a celula da grade (que reparte a altura da tela
  // entre as linhas) em vez de ter altura fixa: assim todos cabem na tela.
  const modoTV = useModoTV((estado) => estado.ativo);
  const legenda = series.length > 1;
  const comRotulosNasBarras = tipo === 'barras-horizontais' || (tipo === 'barras' && linhas.length <= 8);

  // Barras horizontais crescem com a quantidade de itens (top N).
  const altura = tipo === 'barras-horizontais' ? `${Math.max(linhas.length, 3) * 2.25 + 2}rem` : '16rem';

  function desenhar(): ReactElement {
    const comum = { data: linhas, accessibilityLayer: false, margin: { top: 16, right: 24, bottom: 4, left: 4 } };
    const grade = <CartesianGrid stroke={COR_GRADE} strokeDasharray="3 3" vertical={tipo === 'barras-horizontais'} horizontal={tipo !== 'barras-horizontais'} />;
    const dica = (
      <Tooltip
        formatter={(v: unknown) => formatarCompleto(v)}
        contentStyle={ESTILO_DICA}
        labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
        cursor={{ fill: 'var(--surface-sunken)' }}
      />
    );
    const legendaEl = legenda ? <Legend wrapperStyle={{ color: COR_TEXTO_EIXO, fontSize: '0.75rem' }} /> : null;

    if (tipo === 'barras-horizontais') {
      return (
        <BarChart {...comum} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 4 }}>
          {grade}
          <XAxis type="number" tick={TICK} tickFormatter={formatarEixo} stroke={COR_GRADE} allowDecimals={formato !== 'numero'} />
          <YAxis
            type="category"
            dataKey="exibicao"
            tick={TICK}
            interval={0}
            width={168}
            tickFormatter={(v: unknown) => encurtar(String(v))}
            stroke={COR_GRADE}
          />
          {dica}
          {legendaEl}
          {series.map((s, i) => (
            <Bar key={s.nome} dataKey={valorDa(i)} name={td(s.nome)} fill={corDaBarra(i, 0, series.length)} isAnimationActive={false}>
              {linhas.map((linha, j) => (
                <Cell key={linha.rotulo} fill={corDaBarra(i, j, series.length)} />
              ))}
              <LabelList dataKey={valorDa(i)} position="right" fill="var(--text-primary)" fontSize="0.75rem" formatter={(v) => formatarCompleto(v)} />
            </Bar>
          ))}
        </BarChart>
      );
    }

    const eixos = (
      <>
        <XAxis dataKey="exibicao" tick={TICK} stroke={COR_GRADE} interval="preserveStartEnd" />
        {/* Contagem (OPs, pedidos, lotes) so tem marcas inteiras no eixo. */}
        <YAxis tick={TICK} tickFormatter={formatarEixo} stroke={COR_GRADE} width={formato === 'moeda' ? 92 : 72} allowDecimals={formato !== 'numero'} />
      </>
    );

    if (tipo === 'barras') {
      return (
        <BarChart {...comum}>
          {grade}
          {eixos}
          {dica}
          {legendaEl}
          {series.map((s, i) => (
            <Bar key={s.nome} dataKey={valorDa(i)} name={td(s.nome)} fill={corDaBarra(i, 0, series.length)} isAnimationActive={false}>
              {linhas.map((linha, j) => (
                <Cell key={linha.rotulo} fill={corDaBarra(i, j, series.length)} />
              ))}
              {comRotulosNasBarras && (
                <LabelList dataKey={valorDa(i)} position="top" fill="var(--text-primary)" fontSize="0.75rem" formatter={(v) => formatarCompleto(v)} />
              )}
            </Bar>
          ))}
        </BarChart>
      );
    }

    if (tipo === 'area') {
      return (
        <AreaChart {...comum}>
          {grade}
          {eixos}
          {dica}
          {legendaEl}
          {series.map((s, i) => {
            const cor = corDaLinha(i, series.length, titulo);
            return (
              <Area
                key={s.nome}
                type="monotone"
                dataKey={valorDa(i)}
                name={td(s.nome)}
                stroke={cor}
                strokeWidth={2}
                fill={cor}
                fillOpacity={0.15}
                isAnimationActive={false}
              />
            );
          })}
        </AreaChart>
      );
    }

    return (
      <LineChart {...comum}>
        {grade}
        {eixos}
        {dica}
        {legendaEl}
        {series.map((s, i) => (
          <Line
            key={s.nome}
            type="monotone"
            dataKey={valorDa(i)}
            name={td(s.nome)}
            stroke={corDaLinha(i, series.length, titulo)}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    );
  }

  const IconeFalha = icones['alert-triangle'];

  return (
    <section
      aria-labelledby={idTitulo}
      aria-busy={estado === 'carregando' || undefined}
      className={cn(
        'flex flex-col gap-3 rounded-cartao border border-borda-subtle bg-surface-raised p-4',
        modoTV && 'h-full min-h-0 gap-2',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={idTitulo} className="text-subtitle text-texto-primary">
          {titulo}
        </h2>
        {estado === 'dados' && !modoTV && (
          <Botao
            variante="fantasma"
            icone={verDados ? 'eye-off' : 'eye'}
            aria-expanded={verDados}
            aria-controls={idTabela}
            onClick={() => setVerDados((v) => !v)}
          >
            {verDados ? t('Ocultar dados') : t('Ver dados')}
          </Botao>
        )}
      </div>

      {estado === 'erro' && (
        <div role="alert" className="flex flex-col items-start gap-2 py-6">
          <p className="flex items-center gap-2 text-body text-estado-pending">
            <IconeFalha size={16} aria-hidden="true" />
            {erro}
          </p>
          {aoTentarDeNovo && (
            <Botao variante="secundaria" icone="refresh-cw" onClick={aoTentarDeNovo}>
              {t('Tentar de novo')}
            </Botao>
          )}
        </div>
      )}

      {estado === 'carregando' && (
        <div
          data-testid="esqueleto-grafico"
          className={cn('w-full rounded-campo bg-surface-sunken', modoTV && 'min-h-0 flex-1')}
          style={modoTV ? undefined : { height: altura }}
        />
      )}

      {estado === 'vazio' && (
        <p data-grafico-vazio className="py-6 text-body text-texto-secondary">
          {vazio}
        </p>
      )}

      {estado === 'dados' && (
        <>
          {/* O desenho e so visual: a mesma informacao esta na tabela "Ver dados". */}
          <div
            aria-hidden="true"
            data-grafico-desenho
            className={cn('w-full', modoTV && 'relative min-h-0 flex-1')}
            style={modoTV ? undefined : { height: altura }}
          >
            {/* No modo TV a area e preenchida por posicionamento absoluto: o
                ResponsiveContainer so mede bem dentro de uma caixa de tamanho definido. */}
            <div className={modoTV ? 'absolute inset-0' : 'h-full w-full'}>
              <ResponsiveContainer width="100%" height="100%">
                {desenhar()}
              </ResponsiveContainer>
            </div>
          </div>

          <div id={idTabela} hidden={!verDados || modoTV} className="overflow-x-auto border border-borda-subtle">
            <table className="w-full border-collapse">
              <caption className="sr-only">{titulo}</caption>
              <thead>
                <tr className="bg-surface-sunken">
                  <th scope="col" className="border-b border-borda-subtle px-3 py-2 text-left text-label text-texto-secondary">
                    {rotuloCategoria}
                  </th>
                  {series.map((s) => (
                    <th
                      key={s.nome}
                      scope="col"
                      className="border-b border-borda-subtle px-3 py-2 text-right text-label text-texto-secondary"
                    >
                      {td(s.nome)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.rotulo}>
                    <th scope="row" className="border-b border-borda-subtle px-3 py-2 text-left text-body font-normal text-texto-primary">
                      {linha.exibicao}
                    </th>
                    {series.map((s, i) => (
                      <td
                        key={s.nome}
                        className={cn('border-b border-borda-subtle px-3 py-2 text-right text-body text-texto-primary tabular')}
                      >
                        {formatarValor(linha.valores[i], formato)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

type PropsPublicas = GraficoProps;

/** Barras verticais: contagem por categoria (situação, etapa) ou por semana. */
export function GraficoBarras(props: PropsPublicas) {
  return <Grafico tipo="barras" {...props} />;
}

/** Linha (percentuais ao longo do tempo) ou area (`area`: valores acumulaveis, como R$ por mes). */
export function GraficoLinha({ area, ...props }: PropsPublicas & { area?: boolean }) {
  return <Grafico tipo={area ? 'area' : 'linha'} {...props} />;
}

/** Barras horizontais: top N (fornecedores, produtos, clientes), com o valor na ponta. */
export function GraficoBarrasHorizontais(props: PropsPublicas) {
  return <Grafico tipo="barras-horizontais" {...props} />;
}
