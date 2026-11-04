import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { separarErro } from '@/lib/errosDeFormulario';
import { criarEstrutura, listarEstruturasPorProduto, versionarEstrutura } from '@/servicos/estrutura';
import type { Estrutura } from '@/tipos/estrutura';
import { t, td, marcar } from '@/i18n';

const itemEsquema = z.object({
  parte_peca_id: z.string().trim().min(1, marcar('Selecione a peça')),
  quantidade: z.coerce.number().int().positive(marcar('A quantidade deve ser maior que zero')),
});

const esquema = z.object({
  data_vigencia_inicio: z.string().trim().min(1, marcar('Informe a vigência')),
  itens: z
    .array(itemEsquema)
    .min(1, marcar('Informe ao menos um item'))
    .superRefine((itens, ctx) => {
      const vistas = new Set<string>();
      itens.forEach((item, indice) => {
        if (!item.parte_peca_id) return;
        if (vistas.has(item.parte_peca_id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: marcar('Esta peça já foi adicionada'),
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
  /** `novo`: linha recem-adicionada, ainda com seletor e campo editaveis. */
  itens: { parte_peca_id: string; quantidade: string; novo?: boolean }[];
};

const ITEM_VAZIO = { parte_peca_id: '', quantidade: '1', novo: true };

/** Hoje no formato AAAA-MM-DD, no calendario local (nao em UTC). */
function hoje(): string {
  const agora = new Date();
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
}

export function NovaEstruturaProduto() {
  const { produtoId } = useParams<{ produtoId: string }>();
  const id = Number(produtoId);
  const [parametros] = useSearchParams();
  const idBase = Number(parametros.get('base')) || null;

  const historicoQuery = useQuery({
    queryKey: ['estruturas', id],
    queryFn: () => listarEstruturasPorProduto(id),
  });

  if (historicoQuery.isPending) {
    return <p className="text-body text-texto-secondary">{t('Carregando…')}</p>;
  }
  if (historicoQuery.isError) {
    return <p className="text-body text-estado-pending">{t('Não foi possível carregar o histórico da estrutura.')}</p>;
  }

  // A nova versao nasce como copia da versao de origem (por padrao a vigente;
  // sem vigente, a mais recente) e o usuario
  // acrescenta ou retira itens. O que ficar na tela e a nova versao.
  const historico = historicoQuery.data ?? [];
  const maisRecente = historico.reduce<Estrutura | undefined>((a, e) => (!a || e.versao > a.versao ? e : a), undefined);
  const origem = historico.find((e) => e.id === idBase) ?? historico.find((e) => e.ativo) ?? maisRecente;

  return <FormularioEstrutura produtoId={id} origem={origem} />;
}

function FormularioEstrutura({ produtoId, origem }: { produtoId: number; origem?: Estrutura }) {
  const navegar = useNavigate();
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const { opcoes: opcoesPeca } = usePartesPecasAtivas();

  const itensIniciais = origem?.itens?.length
    ? origem.itens.map((i) => ({ parte_peca_id: String(i.parte_peca_id), quantidade: String(i.quantidade), novo: false }))
    : [ITEM_VAZIO];

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { data_vigencia_inicio: hoje(), itens: itensIniciais },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'itens' });
  const rotuloPeca = new Map(opcoesPeca.map((o) => [o.valor, o.rotulo]));
  const itensRaiz = errors.itens?.root?.message ?? errors.itens?.message;

  const mutacao = useMutation({
    mutationFn: (valores: Formulario) => {
      const corpo = {
        data_vigencia_inicio: valores.data_vigencia_inicio,
        itens: valores.itens.map((item) => ({
          parte_peca_id: Number(item.parte_peca_id),
          quantidade: Number(item.quantidade),
        })),
      };
      return origem ? versionarEstrutura(origem.id, corpo) : criarEstrutura({ ...corpo, produto_acabado_id: produtoId });
    },
    onSuccess: () => {
      void clienteQuery.invalidateQueries({ queryKey: ['estruturas', produtoId] });
      void clienteQuery.invalidateQueries({ queryKey: ['produtos-acabados'] });
      mostrarToast(origem ? t('Nova versão criada') : t('Estrutura cadastrada'));
      navegar(`/estrutura-produtos/${produtoId}`);
    },
  });

  const { geral: erroGeral } = separarErro(mutacao.error);

  return (
    <div className="mx-auto flex max-w-[800px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{origem ? t('Nova versão da estrutura') : t('Criar estrutura')}</h1>
        <p className="text-body text-texto-secondary">
          {origem
            ? t('Parte da versão {versao}: adicione ou retire itens. Ao salvar, a nova versão terá exatamente os itens desta tela e passará a ser a vigente.', { versao: origem.versao })
            : t('Componentes necessários para montar 1 unidade do produto.')}
        </p>
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
          rotulo={t('Vigência a partir de')}
          obrigatorio
          ajuda={t('Formato AAAA-MM-DD')}
          erro={td(errors.data_vigencia_inicio?.message) || undefined}
          {...register('data_vigencia_inicio')}
        />

        <div className="flex flex-col gap-3">
          <h2 className="text-subtitle text-texto-primary">{t('Itens')}</h2>

          {fields.length > 0 && (
            <div className="overflow-x-auto border border-borda-subtle bg-surface-raised">
              <table className="w-full border-collapse" aria-label={t('Itens')}>
                <thead>
                  <tr className="bg-surface-sunken">
                    <th scope="col" className="border-b border-borda-subtle px-3 py-2 text-left text-label text-texto-secondary">
                      {t('Parte/peça')}
                    </th>
                    <th scope="col" className="w-32 border-b border-borda-subtle px-3 py-2 text-right text-label text-texto-secondary">
                      {t('Quantidade')}
                    </th>
                    <th scope="col" className="w-16 border-b border-borda-subtle px-3 py-2">
                      <span className="sr-only">{t('Ações')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((campo, indice) => {
                    const erroPeca = td(errors.itens?.[indice]?.parte_peca_id?.message) || undefined;
                    const erroQuantidade = td(errors.itens?.[indice]?.quantidade?.message) || undefined;
                    return (
                      <tr key={campo.id} className="min-h-linha">
                        <td className="border-b border-borda-subtle px-3 py-2 text-body text-texto-primary">
                          {campo.novo ? (
                            <Selecao
                              rotulo={t('Parte/peça')}
                              obrigatorio
                              opcoes={opcoesPeca}
                              placeholder={t('Selecione')}
                              erro={erroPeca}
                              {...register(`itens.${indice}.parte_peca_id` as const)}
                            />
                          ) : (
                            <span>{rotuloPeca.get(campo.parte_peca_id) ?? `#${campo.parte_peca_id}`}</span>
                          )}
                        </td>
                        <td className="border-b border-borda-subtle px-3 py-2 text-right text-body tabular text-texto-primary">
                          {campo.novo ? (
                            <Campo
                              rotulo={t('Quantidade')}
                              obrigatorio
                              tipoDado="quantidade"
                              erro={erroQuantidade}
                              {...register(`itens.${indice}.quantidade` as const)}
                            />
                          ) : (
                            <span>{campo.quantidade}</span>
                          )}
                        </td>
                        <td className="border-b border-borda-subtle px-3 py-2 text-right">
                          <Botao
                            variante="fantasma"
                            icone="trash-2"
                            aria-label={t('Remover item')}
                            title={t('Remover item')}
                            onClick={() => remove(indice)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {itensRaiz && (
            <p role="alert" className="text-body text-estado-pending">
              {td(itensRaiz)}
            </p>
          )}

          <Botao variante="secundaria" icone="plus" onClick={() => append(ITEM_VAZIO)} className="self-start">
            {t('Adicionar item')}
          </Botao>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Botao variante="secundaria" onClick={() => navegar(`/estrutura-produtos/${produtoId}`)} disabled={mutacao.isPending}>
            {t('Cancelar')}
          </Botao>
          <Botao type="submit" icone="save" ocupado={mutacao.isPending} rotuloOcupado={t('Salvando…')}>
            {t('Salvar')}
          </Botao>
        </div>
      </form>
    </div>
  );
}
