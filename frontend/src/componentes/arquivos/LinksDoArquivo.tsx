import { cn } from '@/lib/cn';
import { icones } from '@/componentes/ui/icones';
import type { Anexo } from '@/tipos/arquivos';
import { t } from '@/i18n';

/** Mesmo desenho do Botao secundario: o link precisa parecer acao, nao texto. */
const ESTILO_LINK_ACAO =
  'inline-flex h-[2.5rem] items-center gap-2 rounded-campo border border-borda-strong bg-surface-raised px-4 text-body font-medium text-texto-primary hover:bg-surface-sunken';

/**
 * Link "Abrir": a URL assinada (5 min) abre o arquivo em nova aba — o PDF no
 * visualizador do navegador, a imagem em tamanho real.
 */
export function LinkAbrir({ anexo, rotulo }: { anexo: Anexo; rotulo: string }) {
  const Icone = icones['external-link'];
  if (!anexo.url) return null;
  return (
    <a href={anexo.url} target="_blank" rel="noopener noreferrer" aria-label={rotulo} className={cn(ESTILO_LINK_ACAO, 'print:hidden')}>
      <Icone size={16} aria-hidden="true" />
      {t('Abrir')}
    </a>
  );
}

/**
 * Link "Baixar": a mesma URL assinada, com `download` e o nome original do
 * arquivo (a URL e da mesma origem, entao o navegador respeita o nome).
 */
export function LinkBaixar({ anexo, rotulo }: { anexo: Anexo; rotulo: string }) {
  const Icone = icones.download;
  if (!anexo.url) return null;
  return (
    <a href={anexo.url} download={anexo.arquivo.nome_original} aria-label={rotulo} className={cn(ESTILO_LINK_ACAO, 'print:hidden')}>
      <Icone size={16} aria-hidden="true" />
      {t('Baixar')}
    </a>
  );
}
