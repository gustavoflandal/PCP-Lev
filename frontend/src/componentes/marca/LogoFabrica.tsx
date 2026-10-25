import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface LogoFabricaProps {
  /** Lado do quadrado, em px. */
  tamanho?: number;
  className?: string;
  /** Com titulo, a logo e anunciada pelo leitor de tela; sem, e decorativa. */
  titulo?: string;
}

/**
 * Marca do Sistema PCP: silhueta de fabrica -- telhado em dente de serra (o
 * shed de galpao industrial), janelas vazadas e chamine com fumaca. Uma cor so
 * (currentColor), legivel de 20px (cabecalho) ate marca d'agua.
 */
export function LogoFabrica({ tamanho = 32, className, titulo }: LogoFabricaProps) {
  const idTitulo = useId();
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 64 64"
      fill="currentColor"
      className={cn('shrink-0', className)}
      role={titulo ? 'img' : undefined}
      aria-labelledby={titulo ? idTitulo : undefined}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      {titulo && <title id={idTitulo}>{titulo}</title>}
      {/* Galpao com tres sheds e a chamine; as janelas sao vazadas (evenodd). */}
      <path
        fillRule="evenodd"
        d="M4 58V33l12-8v8l12-8v8l12-8v8h5V12h9v46H4Zm6-16v6h6v-6h-6Zm12 0v6h6v-6h-6Zm12 0v6h6v-6h-6Z"
      />
      {/* Fumaca subindo da chamine. */}
      <circle cx="54" cy="7" r="3.2" />
      <circle cx="59.5" cy="3.5" r="2.2" />
      {/* Chao */}
      <rect x="2" y="59" width="60" height="3" rx="1" />
    </svg>
  );
}
