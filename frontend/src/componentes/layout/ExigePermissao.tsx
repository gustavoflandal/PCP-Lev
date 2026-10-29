import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { usePode, type Permissao } from '@/lib/permissoes';

/**
 * Guarda de rota: sem a permissao, mostra o aviso em vez da tela. Quem chega
 * por URL direta (favorito, link de outra pessoa) a uma tela que o perfil nao
 * acessa veria so um erro de carregamento -- a API responde 403 -- sem
 * entender o motivo.
 */
export function ExigePermissao({ permissao, children }: { permissao: Permissao; children: ReactNode }) {
  const pode = usePode(permissao);
  if (!pode) {
    return (
      <div className="mx-auto flex max-w-[600px] flex-col gap-4">
        <p
          role="alert"
          className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
        >
          {t('Acesso restrito: seu perfil não tem permissão para esta tela.')}
        </p>
      </div>
    );
  }
  return children;
}
