import { Fragment, type ReactNode } from 'react';
import { useIdioma } from '@/i18n';

/**
 * Remonta a arvore ao trocar o idioma: os textos sao lidos por `t()` na hora
 * de renderizar, e assim nenhum componente precisa assinar o idioma para se
 * atualizar. O estado do servidor (react-query) e a rota ficam intactos --
 * so a interface e redesenhada.
 */
export function ComIdioma({ children }: { children: ReactNode }) {
  const idioma = useIdioma();
  return <Fragment key={idioma}>{children}</Fragment>;
}
