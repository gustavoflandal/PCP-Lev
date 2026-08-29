import { create } from 'zustand';
import { cn } from '@/lib/cn';
import { icones } from './icones';

export type TomToast = 'done' | 'pending';

interface ItemToast {
  id: number;
  mensagem: string;
  tom: TomToast;
}

interface EstadoToasts {
  itens: ItemToast[];
  /** Mensagem no verbo passado, espelhando o botao acionado. */
  mostrar: (mensagem: string, tom?: TomToast) => void;
  remover: (id: number) => void;
}

const DURACAO_MS = 4000;

let proximoId = 1;

export const useToasts = create<EstadoToasts>((set, get) => ({
  itens: [],

  mostrar: (mensagem, tom = 'done') => {
    const id = proximoId++;
    set((estado) => ({ itens: [...estado.itens, { id, mensagem, tom }] }));
    setTimeout(() => get().remover(id), DURACAO_MS);
  },

  remover: (id) => set((estado) => ({ itens: estado.itens.filter((item) => item.id !== id) })),
}));

const tons: Record<TomToast, string> = {
  done: 'border-estado-done bg-estado-done-bg text-estado-done',
  pending: 'border-estado-pending bg-estado-pending-bg text-estado-pending',
};

const iconesPorTom: Record<TomToast, 'check-circle-2' | 'alert-triangle'> = {
  done: 'check-circle-2',
  pending: 'alert-triangle',
};

/**
 * Regiao de avisos, no canto inferior direito. Usa `role="status"`, que anuncia
 * sem interromper: o operador nao pode perder o foco do campo por causa de uma
 * confirmacao.
 */
export function Toasts() {
  const itens = useToasts((estado) => estado.itens);

  if (itens.length === 0) {
    return null;
  }

  return (
    <ul
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[min(360px,92vw)] flex-col gap-2"
    >
      {itens.map((item) => {
        const Icone = icones[iconesPorTom[item.tom]];
        return (
          <li
            key={item.id}
            className={cn(
              'flex items-center gap-2 rounded-cartao border px-3 py-2 text-body shadow-elevado',
              tons[item.tom],
            )}
          >
            <Icone size={16} aria-hidden="true" className="shrink-0" />
            {item.mensagem}
          </li>
        );
      })}
    </ul>
  );
}
