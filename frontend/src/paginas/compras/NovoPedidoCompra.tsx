import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import type { PedidoCompra } from '@/tipos/compras';

const itemEsquema = z.object({
  parte_peca_id: z.string().trim().min(1, 'Selecione a peça'),
  quantidade_solicitada: z.coerce.number().int().positive('A quantidade deve ser maior que zero'),
  preco_unitario: z.coerce.number().positive('O preço deve ser maior que zero'),
});

const esquema = z.object({
  numero_pc: z.string().trim().min(1, 'Informe o número'),
  fornecedor_id: z.string().trim().min(1, 'Selecione o fornecedor'),
  data_entrega_prevista: z.string().trim().min(1, 'Informe a data de entrega'),
  condicao_pagamento: z.string().trim().max(50).default(''),
  observacoes: z.string().trim().max(1000).default(''),
  itens: z.array(itemEsquema).min(1, 'Informe ao menos um item'),
});

type Formulario = {
  numero_pc: string;
  fornecedor_id: string;
  data_entrega_prevista: string;
  condicao_pagamento: string;
  observacoes: string;
  itens: { parte_peca_id: string; quantidade_solicitada: string; preco_unitario: string }[];
};

const ITEM_VAZIO = { parte_peca_id: '', quantidade_solicitada: '1', preco_unitario: '0' };

export function NovoPedidoCompra() {
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const cotacaoId = parametros.get('cotacao_id');
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
      numero_pc: '',
      fornecedor_id: '',
      data_entrega_prevista: '',
      condicao_pagamento: '',
      observacoes: '',
      itens: [ITEM_VAZIO],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' });
  const itensObservados = watch('itens');

  const mutacao = useMutation({
    mutationFn: (valores: Formulario) =>
      criarCompra<PedidoCompra>('pedidos-compra', {
        numero_pc: valores.numero_pc,
        cotacao_id: cotacaoId ? Number(cotacaoId) : undefined,
        fornecedor_id: Number(valores.fornecedor_id),
        data_entrega_prevista: valores.data_entrega_prevista,
        condicao_pagamento: valores.condicao_pagamento,
        observacoes: valores.observacoes,
        itens: valores.itens.map((item) => ({
          parte_peca_id: Number(item.parte_peca_id),
          quantidade_solicitada: Number(item.quantidade_solicitada),
          preco_unitario: Number(item.preco_unitario),
        })),
      }),
    onSuccess: (criado) => {
      mostrarToast('Pedido de compra cadastrado');
      navegar(`/pedidos-compra/${criado.id}`);
    },
  });

  const { geral: erroGeral } = separarErro(mutacao.error);

  const totalGeral = itensObservados.reduce((soma, item) => {
    const quantidade = Number(item.quantidade_solicitada) || 0;
    const preco = Number(item.preco_unitario) || 0;
    return soma + quantidade * preco;
  }, 0);

  return (
    <div className="mx-auto flex max-w-[800px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Novo pedido de compra</h1>
        <p className="text-body text-texto-secondary">
          Emita um pedido de compra manual ou complete os dados a partir de uma cotação.
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

        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            rotulo="Número"
            obrigatorio
            tipoDado="codigo"
            ajuda="Ex.: PC-2026-001"
            erro={errors.numero_pc?.message}
            {...register('numero_pc')}
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

        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            rotulo="Entrega prevista"
            obrigatorio
            ajuda="Formato AAAA-MM-DD"
            erro={errors.data_entrega_prevista?.message}
            {...register('data_entrega_prevista')}
          />
          <Campo rotulo="Condição de pagamento" {...register('condicao_pagamento')} />
        </div>

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
                erro={errors.itens?.[indice]?.quantidade_solicitada?.message}
                {...register(`itens.${indice}.quantidade_solicitada` as const)}
              />
              <Campo
                rotulo="Preço unitário"
                obrigatorio
                tipoDado="quantidade"
                erro={errors.itens?.[indice]?.preco_unitario?.message}
                {...register(`itens.${indice}.preco_unitario` as const)}
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

          <p className="text-right text-body text-texto-secondary">
            Total: <span className="font-mono text-texto-primary">{formatarMoeda(totalGeral)}</span>
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Botao variante="secundaria" onClick={() => navegar('/pedidos-compra')} disabled={mutacao.isPending}>
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
