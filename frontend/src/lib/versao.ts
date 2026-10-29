import { t } from '@/i18n';

/** Versao do sistema embutida no bundle (ver vite.config.ts). */
export interface InfoVersao {
  versao: string;
  /** Hash curto do commit publicado; vazio quando o build nao informou. */
  commit: string;
  /** Instante da publicacao (ISO 8601). */
  publicadoEm: string;
}

export const VERSAO_ATUAL: InfoVersao = {
  versao: __APP_VERSAO__,
  commit: __APP_COMMIT__,
  publicadoEm: __APP_PUBLICADO_EM__,
};

/** "29/10/2026 02:19" no fuso da fabrica, ou o texto original se nao for uma data. */
export function formatarPublicacao(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(data);
}

/** "Versão 1.1.0 (a125f59) · publicada em 29/10/2026, 02:19". */
export function descreverVersao({ versao, commit, publicadoEm }: InfoVersao): string {
  const id = commit ? ` (${commit})` : '';
  return t('Versão {versao}{id} · publicada em {data}', { versao, id, data: formatarPublicacao(publicadoEm) });
}
