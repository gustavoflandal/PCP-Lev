import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { icones, type NomeIcone } from './icones';

const estilos = cva(
  cn(
    'inline-flex items-center justify-center gap-2 rounded-campo border font-sans',
    'text-body font-medium transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-60',
  ),
  {
    variants: {
      variante: {
        // Acao principal da tela. No maximo uma por bloco de acoes.
        primaria: 'bg-brand text-white border-brand hover:bg-brand-hover hover:border-brand-hover',
        secundaria:
          'bg-surface-raised text-texto-primary border-borda-strong hover:bg-surface-sunken',
        // Acao destrutiva: usa o vermelho de estado pendente/bloqueio.
        perigo:
          'bg-estado-pending text-white border-estado-pending hover:brightness-90',
        fantasma:
          'bg-transparent text-texto-secondary border-transparent hover:bg-surface-sunken',
      },
      tamanho: {
        // Densidade de gestao (desktop).
        padrao: 'h-[2.5rem] px-4',
        // Densidade confortavel: tablet e telas de execucao, alvo de toque 44px+.
        confortavel: 'min-h-toque h-[3rem] px-6 text-subtitle',
      },
    },
    defaultVariants: { variante: 'primaria', tamanho: 'padrao' },
  },
);

export interface BotaoProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof estilos> {
  /** Icone Lucide exibido antes do rotulo. */
  icone?: NomeIcone;
  /** Acao em andamento: desabilita o botao e anuncia aria-busy. */
  ocupado?: boolean;
  /** Rotulo exibido enquanto ocupado ("Liberando…" para "Liberar pedido"). */
  rotuloOcupado?: string;
}

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  { className, variante, tamanho, icone, ocupado, rotuloOcupado, children, disabled, type, ...resto },
  ref,
) {
  const Icone = ocupado ? icones['loader-2'] : icone ? icones[icone] : undefined;
  const rotulo = ocupado && rotuloOcupado ? rotuloOcupado : children;

  return (
    <button
      ref={ref}
      // Sem type explicito o navegador assume "submit" e um botao de filtro
      // dentro de um formulario acabaria enviando o formulario.
      type={type ?? 'button'}
      disabled={disabled || ocupado}
      aria-busy={ocupado || undefined}
      className={cn(estilos({ variante, tamanho }), className)}
      {...resto}
    >
      {Icone && (
        <Icone
          size={16}
          aria-hidden="true"
          className={cn('shrink-0', ocupado && 'motion-safe:animate-spin')}
        />
      )}
      {rotulo}
    </button>
  );
});
