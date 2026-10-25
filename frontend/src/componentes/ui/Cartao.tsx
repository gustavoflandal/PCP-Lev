import { useId, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CartaoProps extends HTMLAttributes<HTMLElement> {
  titulo?: string;
  /** Acoes alinhadas a direita do titulo (ex.: "Ver todos"). */
  acoes?: ReactNode;
}

/**
 * Painel de conteudo. Sem sombra difusa e sem gradiente: apenas borda e a
 * elevacao minima do sistema.
 */
export function Cartao({ titulo, acoes, className, children, ...resto }: CartaoProps) {
  const idTitulo = useId();

  return (
    <section
      // Sem titulo nao ha nome acessivel, entao nao ha regiao a anunciar.
      aria-labelledby={titulo ? idTitulo : undefined}
      className={cn(
        'rounded-cartao border border-borda-subtle bg-surface-raised p-4',
        className,
      )}
      {...resto}
    >
      {/* div, nao header: o cabecalho do cartao nao e um landmark de pagina —
          quem carrega a estrutura aqui e o h2. */}
      {titulo && (
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id={idTitulo} className="text-subtitle text-texto-primary">
            {titulo}
          </h2>
          {acoes}
        </div>
      )}
      {children}
    </section>
  );
}
