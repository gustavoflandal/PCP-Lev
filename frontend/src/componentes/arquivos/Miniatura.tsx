import { useState } from 'react';
import { Badge } from '@/componentes/ui/Badge';
import { icones } from '@/componentes/ui/icones';
import { cn } from '@/lib/cn';

export interface MiniaturaProps {
  /** URL assinada da miniatura (vida de 5 min); ausente sem foto. */
  url?: string;
  /** Texto alternativo: diga o que e a foto ("Foto da peça CON-001"). */
  alt: string;
  /** Item critico sem foto mostra o selo "Sem foto" ao lado. */
  critico?: boolean;
  tamanho?: 'pequena' | 'media';
  className?: string;
}

const LADO = { pequena: 'h-10 w-10', media: 'h-16 w-16' } as const;

/**
 * Foto principal nos pontos de decisao (listas, separacao, Kanban). Sem foto
 * — ou com a URL ja expirada no cache — cai num icone neutro, decorativo: a
 * informacao "falta foto" so importa (e so aparece, em texto) no item critico.
 */
export function Miniatura({ url, alt, critico, tamanho = 'pequena', className }: MiniaturaProps) {
  const [falhou, definirFalhou] = useState<string | null>(null);
  const IconeSemFoto = icones['image-off'];
  const temFoto = !!url && falhou !== url;

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {temFoto ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => definirFalhou(url)}
          className={cn(LADO[tamanho], 'shrink-0 rounded-campo border border-borda-subtle bg-surface-sunken object-cover')}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            LADO[tamanho],
            'inline-flex shrink-0 items-center justify-center rounded-campo border border-borda-subtle bg-surface-sunken text-texto-disabled',
          )}
        >
          <IconeSemFoto size={tamanho === 'media' ? 20 : 16} />
        </span>
      )}
      {critico && !url && (
        <Badge tom="warning" icone="alert-triangle">
          Sem foto
        </Badge>
      )}
    </span>
  );
}
