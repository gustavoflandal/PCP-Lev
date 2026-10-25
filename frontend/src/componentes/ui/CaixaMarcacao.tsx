import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CaixaMarcacaoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Rotulo clicavel, a direita da caixa. */
  rotulo: string;
  /** Explicacao curta do efeito de marcar (lida tambem pelo leitor de tela). */
  ajuda?: string;
}

/**
 * Caixa de marcacao com rotulo e ajuda. A linha inteira e alvo do clique, e a
 * ajuda fica ligada por aria-describedby — quem marca precisa saber o que a
 * flag passa a exigir.
 */
export const CaixaMarcacao = forwardRef<HTMLInputElement, CaixaMarcacaoProps>(function CaixaMarcacao(
  { rotulo, ajuda, className, id, disabled, ...resto },
  ref,
) {
  const idGerado = useId();
  const idCampo = id ?? idGerado;
  const idAjuda = `${idCampo}-ajuda`;

  return (
    <div className={cn('flex items-start gap-2', className)}>
      <input
        ref={ref}
        id={idCampo}
        type="checkbox"
        disabled={disabled}
        aria-describedby={ajuda ? idAjuda : undefined}
        className="mt-[2px] h-4 w-4 shrink-0 accent-brand disabled:cursor-not-allowed"
        {...resto}
      />
      <div className="flex flex-col">
        <label
          htmlFor={idCampo}
          className={cn('text-body', disabled ? 'text-texto-disabled' : 'text-texto-primary')}
        >
          {rotulo}
        </label>
        {ajuda && (
          <span id={idAjuda} className="text-label text-texto-secondary">
            {ajuda}
          </span>
        )}
      </div>
    </div>
  );
});
