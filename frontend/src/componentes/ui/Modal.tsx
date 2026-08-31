import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, type ReactNode } from 'react';
import { icones } from './icones';

export interface ModalProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  /** Texto de apoio abaixo do titulo. */
  descricao?: string;
  children: ReactNode;
  /** Acoes do rodape, alinhadas a direita. */
  rodape?: ReactNode;
}

/**
 * Dialogo modal sobre a tela. O Radix cuida de prender o foco, devolver o
 * foco ao gatilho e fechar no Esc — comportamentos que um modal caseiro
 * costuma errar.
 */
export function Modal({ aberto, aoFechar, titulo, descricao, children, rodape }: ModalProps) {
  const IconeFechar = icones.x;
  const corpoRef = useRef<HTMLDivElement>(null);
  const gatilhoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Guardamos quem tinha foco ao abrir porque este dialogo e controlado
    // por estado externo, sem <Dialog.Trigger>: o retorno automatico do
    // Radix nao tem um gatilho proprio para mirar ao fechar.
    if (aberto) {
      gatilhoRef.current = document.activeElement as HTMLElement | null;
    }
  }, [aberto]);

  return (
    <Dialog.Root open={aberto} onOpenChange={(estaAberto) => !estaAberto && aoFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-texto-primary/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 max-h-[90vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-cartao border border-borda-subtle bg-surface-raised shadow-elevado"
          onOpenAutoFocus={(evento) => {
            // O padrao do Radix foca o primeiro elemento tabulavel do
            // dialogo, que e o botao Fechar no cabecalho: quem digita rapido
            // aperta espaco e fecha o modal sem querer. Focar o corpo poe o
            // cursor no primeiro campo do formulario, como se espera.
            const primeiroCampo = corpoRef.current?.querySelector<HTMLElement>(
              'input, select, textarea, button',
            );
            if (primeiroCampo) {
              evento.preventDefault();
              primeiroCampo.focus();
            }
          }}
          onCloseAutoFocus={(evento) => {
            if (gatilhoRef.current) {
              evento.preventDefault();
              gatilhoRef.current.focus();
            }
          }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-borda-subtle p-4">
            <div>
              <Dialog.Title className="text-subtitle text-texto-primary">{titulo}</Dialog.Title>
              {descricao ? (
                <Dialog.Description className="mt-1 text-label text-texto-secondary">
                  {descricao}
                </Dialog.Description>
              ) : (
                // O Radix avisa no console quando falta descricao; o vazio
                // explicito silencia o aviso sem inventar texto na tela.
                <Dialog.Description className="sr-only">{titulo}</Dialog.Description>
              )}
            </div>

            <Dialog.Close
              aria-label="Fechar"
              className="rounded-campo p-1 text-texto-secondary hover:bg-surface-sunken"
            >
              <IconeFechar size={16} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div ref={corpoRef} className="p-4">
            {children}
          </div>

          {rodape && (
            <div className="flex items-center justify-end gap-2 border-t border-borda-subtle p-4">
              {rodape}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
