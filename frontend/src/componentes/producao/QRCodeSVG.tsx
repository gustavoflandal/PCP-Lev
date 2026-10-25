import QRCode from 'qrcode';
import { useMemo } from 'react';

export interface QRCodeSVGProps {
  /** Texto codificado (a URL da ficha). */
  valor: string;
  /** Lado em px. */
  tamanho?: number;
  /** Nome acessivel da imagem. */
  rotulo: string;
}

/**
 * QR Code desenhado como SVG pelo proprio React a partir da matriz gerada pela
 * lib `qrcode` (QRCode.create, sincrono) -- sem innerHTML nem canvas, entao
 * imprime nitido e funciona no jsdom dos testes. Margem de 4 modulos (zona
 * de silencio exigida pela norma) e cores fixas preto/branco: leitor de QR
 * nao le o tema escuro invertido.
 */
export function QRCodeSVG({ valor, tamanho = 160, rotulo }: QRCodeSVGProps) {
  const caminho = useMemo(() => {
    const { modules } = QRCode.create(valor, { errorCorrectionLevel: 'M' });
    const partes: string[] = [];
    for (let linha = 0; linha < modules.size; linha++) {
      for (let coluna = 0; coluna < modules.size; coluna++) {
        if (modules.get(linha, coluna)) partes.push(`M${coluna + 4} ${linha + 4}h1v1h-1z`);
      }
    }
    return { d: partes.join(''), lado: modules.size + 8 };
  }, [valor]);

  return (
    <svg
      role="img"
      aria-label={rotulo}
      width={tamanho}
      height={tamanho}
      viewBox={`0 0 ${caminho.lado} ${caminho.lado}`}
      shapeRendering="crispEdges"
    >
      <rect width={caminho.lado} height={caminho.lado} fill="#FFFFFF" />
      <path d={caminho.d} fill="#000000" />
    </svg>
  );
}
