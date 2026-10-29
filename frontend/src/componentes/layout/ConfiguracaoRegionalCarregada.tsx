import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { useConfiguracaoRegionalServidor } from '@/hooks/useConfiguracaoRegionalServidor';

/**
 * Segura o conteudo das telas internas ate a configuracao regional chegar.
 * Sem isso, numa carga a frio (F5, link direto) uma tabela cujo GET volte
 * antes do GET regional seria desenhada no formato padrao e ficaria assim
 * ate o usuario navegar. Se a busca falhar, segue com os defaults da store
 * (os mesmos da migration 011) em vez de bloquear o sistema.
 */
export function ConfiguracaoRegionalCarregada({ children }: { children: ReactNode }) {
  const { isPending } = useConfiguracaoRegionalServidor();

  if (isPending) {
    return <p className="text-body text-texto-secondary">{t('Carregando…')}</p>;
  }
  return children;
}
