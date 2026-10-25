import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Tipo do dado digitado. Ajusta fonte e teclado:
 * codigos sao conferidos digito a digito (mono, caixa alta) e quantidades
 * pedem teclado numerico no tablet do chao de fabrica.
 */
type TipoDado = 'texto' | 'codigo' | 'quantidade';

export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'required'> {
  /** Rotulo exibido acima do campo. Nunca use placeholder como rotulo. */
  rotulo: string;
  /** Mensagem de erro: diga o que fazer, nao o que aconteceu. */
  erro?: string;
  /** Texto de apoio exibido quando nao ha erro. */
  ajuda?: string;
  obrigatorio?: boolean;
  tipoDado?: TipoDado;
}

export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { rotulo, erro, ajuda, obrigatorio, tipoDado = 'texto', className, id, ...resto },
  ref,
) {
  const idGerado = useId();
  const idCampo = id ?? idGerado;
  const idDescricao = `${idCampo}-descricao`;
  // O erro substitui a ajuda: duas descricoes competindo confundem o leitor.
  const descricao = erro ?? ajuda;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idCampo} className="text-label text-texto-secondary">
        {rotulo}
        {obrigatorio && (
          <span aria-hidden="true" className="ml-1 text-estado-pending">
            *
          </span>
        )}
      </label>

      <input
        ref={ref}
        id={idCampo}
        required={obrigatorio}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao ? idDescricao : undefined}
        inputMode={tipoDado === 'quantidade' ? 'numeric' : undefined}
        autoCapitalize={tipoDado === 'codigo' ? 'characters' : undefined}
        autoCorrect={tipoDado === 'codigo' ? 'off' : undefined}
        spellCheck={tipoDado === 'codigo' ? false : undefined}
        className={cn(
          'h-[2.5rem] w-full rounded-campo border bg-surface-raised px-3 text-body',
          'text-texto-primary placeholder:text-texto-disabled',
          tipoDado === 'codigo' && 'font-mono uppercase',
          tipoDado === 'quantidade' && 'tabular text-right',
          erro ? 'border-estado-pending' : 'border-borda-strong',
          'disabled:bg-surface-sunken disabled:text-texto-disabled',
          className,
        )}
        {...resto}
      />

      {descricao && (
        <p
          id={idDescricao}
          role={erro ? 'alert' : undefined}
          className={cn('text-label', erro ? 'text-estado-pending' : 'text-texto-secondary')}
        >
          {descricao}
        </p>
      )}
    </div>
  );
});
