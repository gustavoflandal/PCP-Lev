/**
 * Impressao das telas (botao "Imprimir / PDF" e Ctrl+P). Usa a impressao do
 * navegador -- "Salvar como PDF" e um dos destinos -- com o leiaute de
 * @media print (index.css): sem menu, botoes nem filtros, com o cabecalho de
 * impressao (CabecalhoImpressao).
 *
 * Os graficos (recharts) sao SVG desenhados na largura da tela; sem viewBox
 * eles nao se ajustam a folha e sairiam cortados. Antes de imprimir, cada um
 * ganha viewBox e largura 100% (altura mantida, proporcao preservada) -- e
 * volta ao normal depois.
 */

const ATRIBUTO_ORIGINAL = 'data-impressao-original';

export function prepararGraficos(raiz: ParentNode = document): void {
  raiz.querySelectorAll<SVGSVGElement>('svg.recharts-surface').forEach((svg) => {
    if (svg.hasAttribute(ATRIBUTO_ORIGINAL)) {
      return;
    }
    const largura = svg.getAttribute('width');
    const altura = svg.getAttribute('height');
    if (!largura || !altura) {
      return;
    }
    svg.setAttribute(ATRIBUTO_ORIGINAL, JSON.stringify({ largura, altura, viewBox: svg.getAttribute('viewBox') }));
    if (!svg.getAttribute('viewBox')) {
      svg.setAttribute('viewBox', `0 0 ${largura} ${altura}`);
    }
    // Largura do cartao, altura da tela: o viewBox encaixa o desenho sem
    // cortar nem distorcer.
    svg.setAttribute('width', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  });
}

export function restaurarGraficos(raiz: ParentNode = document): void {
  raiz.querySelectorAll<SVGSVGElement>(`svg[${ATRIBUTO_ORIGINAL}]`).forEach((svg) => {
    const original = JSON.parse(svg.getAttribute(ATRIBUTO_ORIGINAL) ?? '{}') as {
      largura?: string;
      altura?: string;
      viewBox?: string | null;
    };
    if (original.largura) svg.setAttribute('width', original.largura);
    if (original.altura) svg.setAttribute('height', original.altura);
    if (original.viewBox) {
      svg.setAttribute('viewBox', original.viewBox);
    } else {
      svg.removeAttribute('viewBox');
    }
    svg.removeAttribute('preserveAspectRatio');
    svg.removeAttribute(ATRIBUTO_ORIGINAL);
  });
}

/** Titulo da tela a imprimir: o do dialogo aberto, ou o h1 da tela. */
export function tituloDaTela(): string {
  const dialogo = document.querySelector('[role="dialog"] h2');
  const h1 = document.querySelector('main h1');
  return (dialogo?.textContent || h1?.textContent || 'Sistema PCP').trim();
}

/**
 * Nome sugerido do arquivo PDF: o navegador usa o document.title.
 * Ex.: "Pedidos de compra - 2026-10-24 21h05".
 */
export function nomeDoArquivo(titulo: string, quando: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const data = `${quando.getFullYear()}-${p(quando.getMonth() + 1)}-${p(quando.getDate())}`;
  return `${titulo} - ${data} ${p(quando.getHours())}h${p(quando.getMinutes())}`;
}

/** Abre a impressao do navegador (o resto acontece em beforeprint/afterprint). */
export function imprimirTela(): void {
  window.print();
}
