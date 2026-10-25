import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToasts } from '@/componentes/ui/Toast';
import { atualizar, criar, excluir } from '@/servicos/cadastros';
import type { Recurso } from '@/tipos/cadastros';

export interface MensagensCadastro {
  /** "Fornecedor cadastrado", "Peca cadastrada" — a concordancia de genero
   *  fica com quem chama, porque nao sai de um molde unico em portugues. */
  criado: string;
  atualizado: string;
  inativado: string;
}

export interface AtualizacaoCadastro {
  id: number;
  corpo: unknown;
}

/**
 * Escrita dos cadastros base. Cada sucesso invalida a lista e avisa com o
 * verbo no passado do botao acionado. O erro nao vira toast: ele volta para o
 * formulario, que sabe marcar o campo certo.
 */
export function useMutacoesCadastro(recurso: Recurso, mensagens: MensagensCadastro) {
  const clienteQuery = useQueryClient();
  const mostrar = useToasts((estado) => estado.mostrar);

  const invalidarLista = () => clienteQuery.invalidateQueries({ queryKey: [recurso] });

  return {
    criar: useMutation({
      mutationFn: (corpo: unknown) => criar(recurso, corpo),
      onSuccess: () => {
        void invalidarLista();
        mostrar(mensagens.criado);
      },
    }),

    atualizar: useMutation({
      mutationFn: ({ id, corpo }: AtualizacaoCadastro) => atualizar(recurso, id, corpo),
      onSuccess: () => {
        void invalidarLista();
        mostrar(mensagens.atualizado);
      },
    }),

    inativar: useMutation({
      mutationFn: (id: number) => excluir(recurso, id),
      onSuccess: () => {
        void invalidarLista();
        mostrar(mensagens.inativado);
      },
    }),
  };
}
