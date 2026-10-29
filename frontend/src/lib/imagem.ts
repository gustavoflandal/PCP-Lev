import { t } from '@/i18n';

/**
 * Gira a imagem 90 graus no sentido horario num canvas e devolve o novo
 * conteudo, no mesmo tipo (JPEG, PNG ou WebP). E a unica edicao feita antes
 * do envio (spec v1.2: recorte fica de fora). O navegador ja aplica a
 * orientacao EXIF ao decodificar, entao o resultado e o que a pessoa ve.
 */
export async function girar90(imagem: Blob): Promise<Blob> {
  const origem = await carregar(imagem);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = origem.altura;
    canvas.height = origem.largura;
    const contexto = canvas.getContext('2d');
    if (!contexto) {
      throw new Error(t('Este navegador não consegue girar a imagem. Gire no computador e envie de novo.'));
    }
    contexto.translate(canvas.width, 0);
    contexto.rotate(Math.PI / 2);
    contexto.drawImage(origem.elemento, 0, 0);
    const tipo = imagem.type || 'image/jpeg';
    return await new Promise<Blob>((resolver, rejeitar) => {
      canvas.toBlob(
        (resultado) =>
          resultado ? resolver(resultado) : rejeitar(new Error(t('Não foi possível girar a imagem.'))),
        tipo,
        0.92,
      );
    });
  } finally {
    origem.liberar();
  }
}

interface ImagemCarregada {
  elemento: HTMLImageElement;
  largura: number;
  altura: number;
  liberar: () => void;
}

function carregar(imagem: Blob): Promise<ImagemCarregada> {
  const url = URL.createObjectURL(imagem);
  return new Promise((resolver, rejeitar) => {
    const elemento = new Image();
    elemento.onload = () =>
      resolver({
        elemento,
        largura: elemento.naturalWidth,
        altura: elemento.naturalHeight,
        liberar: () => URL.revokeObjectURL(url),
      });
    elemento.onerror = () => {
      URL.revokeObjectURL(url);
      rejeitar(new Error(t('Não foi possível ler a imagem. Confira se o arquivo é JPG, PNG ou WebP.')));
    };
    elemento.src = url;
  });
}
