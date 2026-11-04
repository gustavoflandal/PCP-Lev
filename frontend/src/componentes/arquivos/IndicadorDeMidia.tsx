import { icones } from '@/componentes/ui/icones';
import { t } from '@/i18n';

export interface IndicadorDeMidiaProps {
  tipo: 'FOTO' | 'DOCUMENTO';
  /** Quantidade cadastrada; zero ou ausente mostra o icone de inexistente. */
  quantidade?: number;
  codigo: string;
  aoAbrir: () => void;
}

/**
 * Coluna "Foto"/"Documento" das listas de cadastro: check clicavel quando ha
 * midia (abre o mosaico) e icone de inexistente quando nao ha.
 */
export function IndicadorDeMidia({ tipo, quantidade, codigo, aoAbrir }: IndicadorDeMidiaProps) {
  const Icone = quantidade ? icones.check : icones.ban;
  if (!quantidade) {
    const rotuloNao = tipo === 'FOTO' ? t('Sem foto cadastrada') : t('Sem documento cadastrado');
    return (
      <span role="img" aria-label={rotuloNao} title={rotuloNao} className="inline-flex text-texto-disabled">
        <Icone size={18} aria-hidden="true" />
      </span>
    );
  }
  const rotulo = tipo === 'FOTO' ? t('Ver fotos de {codigo}', { codigo }) : t('Ver documentos de {codigo}', { codigo });
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      onClick={aoAbrir}
      className="inline-flex rounded-campo p-1 text-estado-done hover:bg-surface-sunken"
    >
      <Icone size={18} aria-hidden="true" />
    </button>
  );
}
