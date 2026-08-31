import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface OpcaoSelecao {
  valor: string;
  rotulo: string;
}

export interface SelecaoProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'required'> {
  /** Rotulo exibido acima do controle. */
  rotulo: string;
  /** Mensagem de erro: diga o que fazer, nao o que aconteceu. */
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  opcoes: OpcaoSelecao[];
  /** Primeira opcao, vazia, para "nao informado". */
  placeholder?: string;
}

export const Selecao = forwardRef<HTMLSelectElement, SelecaoProps>(function Selecao(
  { rotulo, erro, ajuda, obrigatorio, opcoes, placeholder, className, id, ...resto },
  ref,
) {
  const idGerado = useId();
  const idCampo = id ?? idGerado;
  const idDescricao = `${idCampo}-descricao`;
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

      <select
        ref={ref}
        id={idCampo}
        required={obrigatorio}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao ? idDescricao : undefined}
        className={cn(
          'h-[40px] w-full rounded-campo border bg-surface-raised px-3 text-body',
          'text-texto-primary',
          erro ? 'border-estado-pending' : 'border-borda-strong',
          'disabled:bg-surface-sunken disabled:text-texto-disabled',
          className,
        )}
        {...resto}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>

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
