import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { useFornecedoresAtivos } from '@/hooks/useFornecedoresAtivos';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { separarErro } from '@/lib/errosDeFormulario';
import { formatarMoeda } from '@/lib/formato';
import { criarCompra } from '@/servicos/compras';
import type { Cotacao } from '@/tipos/compras';

const itemEsquema = z.object({
  parte_peca_id: z.string().trim().min(1, 'Selecione a peça'),
  quantidade: z.coerce.number().int().positive('A quantidade deve ser maior que zero'),
  preco_unitario: z.coerce.number().positive('O preço deve ser maior que zero'),
});

const esquema = z.object({
  numero_cotacao: z.string().trim().min(1, 'Informe o número'),
  fornecedor_id: z.string().trim().min(1, 'Selecione o fornecedor'),
  data_validade: z.string().trim().min(1, 'Informe a validade'),
  observacoes: z.string().trim().max(1000).default(''),
  itens: z.array(itemEsquema).min(1, 'Informe ao menos um item'),
});

type Formulario = {
  numero_cotacao: string;
  fornecedor_id: string;
  data_validade: string;
  observacoes: string;
  itens: { parte_peca_id: string; quantidade: string; preco_unitario: string }[];
};

const ITEM_VAZIO = { parte_peca_id: '', quantidade: '1', preco_unitario: '0' };

export function NovaCotacao() {
  const navegar = useNavigate();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const { opcoes: opcoesFornecedor } = useFornecedoresAtivos();
  const { opcoes: opcoesPeca } = usePartesPecasAtivas();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      numero_cotacao: '',
      fornecedor_id: '',
      data_validade: '',
      observacoes: '',
      itens: [ITEM_VAZIO],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' });
  const itensObservados = watch('itens');

  const mutacao = useMutation({
    mutationFn: (valores: Formulario) =>
      criarCompra<Cotacao>('cotacoes', {
        numero_cotacao: valores.numero_cotacao,
        fornecedor_id: Number(valores.fornecedor_id),
        data_validade: valores.data_validade,
        observacoes: valores.observacoes,
        itens: valores.itens.map((item) => ({
          parte_peca_id: Number(item.parte_peca_id),
          quantidade: Number(item.quantidade),
          preco_unitario: Number(item.preco_unitario),
        })),
      }),
    onSuccess: (criada) => {
      mostrarToast('Cotação cadastrada');
      navegar(`/cotacoes/${criada.id}`);
    },
  });

  const { geral: erroGeral } = separarErro(mutacao.error);

  const totalGeral = itensObservados.reduce((soma, item) => {
    const quantidade = Number(item.quantidade) || 0;
    const preco = Number(item.preco_unitario) || 0;
    return soma + quantidade * preco;
  }, 0);

  return (
    <div className="mx-auto flex max-w-[800px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Nova cotação</h1>
        <p className="text-body text-texto-secondary">Registre o pedido de preço para um fornecedor.</p>
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

        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            rotulo="Número"
            obrigatorio
            tipoDado="codigo"
            ajuda="Ex.: COT-2026-001"
            erro={errors.numero_cotacao?.message}
            {...register('numero_cotacao')}
          />
          <Selecao
            rotulo="Fornecedor"
            obrigatorio
            opcoes={opcoesFornecedor}
            placeholder="Selecione"
            erro={errors.fornecedor_id?.message}
            {...register('fornecedor_id')}
          />
        </div>

        <Campo
          rotulo="Validade"
          obrigatorio
          ajuda="Formato AAAA-MM-DD"
          erro={errors.data_validade?.message}
          {...register('data_validade')}
        />

        <Campo rotulo="Observações" {...register('observacoes')} />

        <div className="flex flex-col gap-3">
          <h2 className="text-subtitle text-texto-primary">Itens</h2>

          {fields.map((campo, indice) => (
            <div key={campo.id} className="grid gap-3 rounded-campo border border-borda-subtle p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
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
              <Campo
                rotulo="Preço unitário"
                obrigatorio
                tipoDado="quantidade"
                erro={errors.itens?.[indice]?.preco_unitario?.message}
                {...register(`itens.${indice}.preco_unitario` as const)}
              />
              {fields.length > 1 && (
                <Botao
                  variante="fantasma"
                  icone="trash-2"
                  className="self-end"
                  onClick={() => remove(indice)}
                >
                  Remover item
                </Botao>
              )}
            </div>
          ))}

          <Botao variante="secundaria" icone="plus" onClick={() => append(ITEM_VAZIO)} className="self-start">
            Adicionar item
          </Botao>

          <p className="text-right text-body text-texto-secondary">
            Total: <span className="font-mono text-texto-primary">{formatarMoeda(totalGeral)}</span>
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Botao variante="secundaria" onClick={() => navegar('/cotacoes')} disabled={mutacao.isPending}>
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
