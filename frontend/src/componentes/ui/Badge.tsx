import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { icones, type NomeIcone } from './icones';

/** Tons semanticos do §2 do design system. Cada um tem um significado unico. */
export type TomBadge = 'done' | 'pending' | 'warning' | 'blocked' | 'neutral';

const tons: Record<TomBadge, string> = {
  done: 'bg-estado-done-bg text-estado-done',
  pending: 'bg-estado-pending-bg text-estado-pending',
  warning: 'bg-estado-warning-bg text-estado-warning',
  blocked: 'bg-estado-blocked-bg text-estado-blocked',
  neutral: 'bg-estado-neutral-bg text-estado-neutral',
};

export interface BadgeProps {
  tom: TomBadge;
  icone: NomeIcone;
  children: ReactNode;
  className?: string;
}

/**
 * Selo de estado. O texto e sempre obrigatorio: o design system proibe
 * comunicar estado apenas por cor, e a tela precisa sobreviver em escala de
 * cinza e para quem nao distingue verde de vermelho.
 */
export function Badge({ tom, icone, children, className }: BadgeProps) {
  const Icone = icones[icone];

  return (
    <span
      className={cn(
        'inline-flex h-[1.375rem] items-center gap-1 rounded-full px-2 text-label',
        tons[tom],
        className,
      )}
    >
      <Icone size={12} aria-hidden="true" className="shrink-0" />
      {children}
    </span>
  );
}

/** Situacao dos cadastros base. Inativo e neutro, nao vermelho: nao e falha. */
export function BadgeSituacao({ ativo }: { ativo: boolean }) {
  return ativo ? (
    <Badge tom="done" icone="check-circle-2">
      Ativo
    </Badge>
  ) : (
    <Badge tom="neutral" icone="circle">
      Inativo
    </Badge>
  );
}
