import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { separarErro } from '@/lib/errosDeFormulario';
import { criarEstrutura, listarEstruturasPorProduto, versionarEstrutura } from '@/servicos/estrutura';

const itemEsquema = z.object({
  parte_peca_id: z.string().trim().min(1, 'Selecione a peça'),
  quantidade: z.coerce.number().int().positive('A quantidade deve ser maior que zero'),
});

const esquema = z.object({
  data_vigencia_inicio: z.string().trim().min(1, 'Informe a vigência'),
  itens: z
    .array(itemEsquema)
    .min(1, 'Informe ao menos um item')
    .superRefine((itens, ctx) => {
      const vistas = new Set<string>();
      itens.forEach((item, indice) => {
        if (!item.parte_peca_id) return;
        if (vistas.has(item.parte_peca_id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Esta peça já foi adicionada',
            path: [indice, 'parte_peca_id'],
          });
          return;
        }
        vistas.add(item.parte_peca_id);
      });
    }),
});

type Formulario = {
  data_vigencia_inicio: string;
  itens: { parte_peca_id: string; quantidade: string }[];
};

const ITEM_VAZIO = { parte_peca_id: '', quantidade: '1' };

export function NovaEstruturaProduto() {
  const { produtoId } = useParams<{ produtoId: string }>();
  const id = Number(produtoId);
  const navegar = useNavigate();
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const { opcoes: opcoesPeca } = usePartesPecasAtivas();

  const historicoQuery = useQuery({
    queryKey: ['estruturas', id],
    queryFn: () => listarEstruturasPorProduto(id),
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { data_vigencia_inicio: '', itens: [ITEM_VAZIO] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'itens' });

  const ativa = historicoQuery.data?.find((e) => e.ativo);

  const mutacao = useMutation({
    mutationFn: (valores: Formulario) => {
      const corpo = {
        data_vigencia_inicio: valores.data_vigencia_inicio,
        itens: valores.itens.map((item) => ({
          parte_peca_id: Number(item.parte_peca_id),
          quantidade: Number(item.quantidade),
        })),
      };
      return ativa ? versionarEstrutura(ativa.id, corpo) : criarEstrutura({ ...corpo, produto_acabado_id: id });
    },
    onSuccess: () => {
      void clienteQuery.invalidateQueries({ queryKey: ['estruturas', id] });
      void clienteQuery.invalidateQueries({ queryKey: ['produtos-acabados'] });
      mostrarToast(ativa ? 'Nova versão criada' : 'Estrutura cadastrada');
      navegar(`/estrutura-produtos/${id}`);
    },
  });

  const { geral: erroGeral } = separarErro(mutacao.error);

  if (historicoQuery.isPending) {
    return <p className="text-body text-texto-secondary">Carregando…</p>;
  }
  if (historicoQuery.isError) {
    return <p className="text-body text-estado-pending">Não foi possível carregar o histórico da estrutura.</p>;
  }

  return (
    <div className="mx-auto flex max-w-[800px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{ativa ? 'Nova versão da estrutura' : 'Criar estrutura'}</h1>
        <p className="text-body text-texto-secondary">Componentes necessários para montar 1 unidade do produto.</p>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit((valores) => mutacao.mutate(valores))}
        className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6"
      >
        {erroGeral && (
          <p
            role="alert"
            className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
          >
            {erroGeral}
          </p>
        )}

        <Campo
          rotulo="Vigência a partir de"
          obrigatorio
          ajuda="Formato AAAA-MM-DD"
          erro={errors.data_vigencia_inicio?.message}
          {...register('data_vigencia_inicio')}
        />

        <div className="flex flex-col gap-3">
          <h2 className="text-subtitle text-texto-primary">Itens</h2>

          {fields.map((campo, indice) => (
            <div key={campo.id} className="grid gap-3 rounded-campo border border-borda-subtle p-3 md:grid-cols-[2fr_1fr_auto]">
              <Selecao
                rotulo="Parte/peça"
                obrigatorio
                opcoes={opcoesPeca}
                placeholder="Selecione"
                erro={errors.itens?.[indice]?.parte_peca_id?.message}
                {...register(`itens.${indice}.parte_peca_id` as const)}
              />
              <Campo
                rotulo="Quantidade"
                obrigatorio
                tipoDado="quantidade"
                erro={errors.itens?.[indice]?.quantidade?.message}
                {...register(`itens.${indice}.quantidade` as const)}
              />
              {fields.length > 1 && (
                <Botao variante="fantasma" icone="trash-2" className="self-end" onClick={() => remove(indice)}>
                  Remover item
                </Botao>
              )}
            </div>
          ))}

          <Botao variante="secundaria" icone="plus" onClick={() => append(ITEM_VAZIO)} className="self-start">
            Adicionar item
          </Botao>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Botao variante="secundaria" onClick={() => navegar(`/estrutura-produtos/${id}`)} disabled={mutacao.isPending}>
            Cancelar
          </Botao>
          <Botao type="submit" icone="save" ocupado={mutacao.isPending} rotuloOcupado="Salvando…">
            Salvar
          </Botao>
        </div>
      </form>
    </div>
  );
}
