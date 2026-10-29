import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { t } from '@/i18n';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { useClientesAtivos, useProdutosAcabadosAtivos } from '@/hooks/useOpcoesProducao';
import { separarErro } from '@/lib/errosDeFormulario';
import { formatarMoeda } from '@/lib/formato';
import { atualizarPedidoVenda, criarPedidoVenda, obterPedidoVenda } from '@/servicos/producao';
import { hojeAAAAMMDD, pedidoEditavel, type CorpoPedidoVenda, type PedidoVenda } from '@/tipos/producao';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const PRECO = /^\d{1,10}([.,]\d{1,2})?$/;

const criarEsquema = () => {
  const itemEsquema = z.object({
    produto_acabado_id: z.string().trim().min(1, t('Selecione o produto')),
    quantidade: z.coerce.number().int(t('Use um número inteiro')).positive(t('A quantidade deve ser maior que zero')),
    preco_unitario: z
      .string()
      .trim()
      .refine((v) => PRECO.test(v) && Number(v.replace(',', '.')) > 0, t('Informe um preço maior que zero, com até duas casas')),
  });

  return z
    .object({
      numero_pedido: z.string().trim().min(1, t('Informe o número do pedido')).max(50, t('Use até 50 caracteres')),
      cliente_id: z.string().trim().min(1, t('Selecione o cliente')),
      data_pedido: z.string().trim().regex(DATA, t('Informe a data no formato AAAA-MM-DD')),
      data_entrega_prometida: z.string().trim().regex(DATA, t('Informe a data no formato AAAA-MM-DD')),
      observacoes: z.string().trim().max(1000, t('Use até 1000 caracteres')).default(''),
      itens: z.array(itemEsquema).min(1, t('Informe ao menos um item')),
    })
    .refine((v) => v.data_entrega_prometida > v.data_pedido, {
      path: ['data_entrega_prometida'],
      message: t('A entrega prometida precisa ser depois da data do pedido'),
    })
    .refine((v) => new Set(v.itens.map((i) => i.produto_acabado_id)).size === v.itens.length, {
      path: ['itens'],
      message: t('O mesmo produto aparece em mais de um item — some as quantidades'),
    });
};

type Formulario = {
  numero_pedido: string;
  cliente_id: string;
  data_pedido: string;
  data_entrega_prometida: string;
  observacoes: string;
  itens: { produto_acabado_id: string; quantidade: string; preco_unitario: string }[];
};

const ITEM_VAZIO = { produto_acabado_id: '', quantidade: '1', preco_unitario: '' };

/** 15000 -> "15000.00": o preco vai como texto, sem erro de ponto flutuante. */
function precoParaTexto(valor: number): string {
  return valor.toFixed(2);
}

function paraCorpo(v: Formulario): CorpoPedidoVenda {
  return {
    numero_pedido: v.numero_pedido.trim(),
    cliente_id: Number(v.cliente_id),
    data_pedido: v.data_pedido.trim(),
    data_entrega_prometida: v.data_entrega_prometida.trim(),
    observacoes: (v.observacoes ?? '').trim(),
    itens: v.itens.map((i) => ({
      produto_acabado_id: Number(i.produto_acabado_id),
      quantidade: Number(i.quantidade),
      preco_unitario: Number(i.preco_unitario.replace(',', '.')).toFixed(2),
    })),
  };
}

/** Novo pedido (/pedidos-venda/novo) e edicao (/pedidos-venda/:id/editar). */
export function FormularioPedidoVenda() {
  const { id } = useParams<{ id: string }>();
  const pedidoId = id ? Number(id) : null;
  const consulta = useQuery({
    queryKey: ['pedidos-venda', pedidoId],
    queryFn: () => obterPedidoVenda(pedidoId!),
    enabled: pedidoId !== null,
  });

  if (pedidoId !== null) {
    if (consulta.isPending) return <p className="text-body text-texto-secondary">{t('Carregando…')}</p>;
    if (consulta.isError || !consulta.data) {
      return <p className="text-body text-estado-pending">{t('Não foi possível carregar o pedido de venda.')}</p>;
    }
    if (!pedidoEditavel(consulta.data)) {
      return (
        <div className="mx-auto flex max-w-[800px] flex-col gap-2">
          <p role="alert" className="rounded-campo border border-estado-warning bg-estado-warning-bg px-3 py-2 text-body text-estado-warning">
            {t('Este pedido não pode mais ser editado: só pedidos Abertos e sem ordem de produção ativa.')}
          </p>
          <Link to={`/pedidos-venda/${pedidoId}`} className="text-body text-brand hover:underline">
            {t('Voltar ao pedido')}
          </Link>
        </div>
      );
    }
    return <FormularioPedido inicial={consulta.data} />;
  }
  return <FormularioPedido />;
}

function FormularioPedido({ inicial }: { inicial?: PedidoVenda }) {
  const navegar = useNavigate();
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const { opcoes: opcoesCliente } = useClientesAtivos();
  const { opcoes: opcoesProduto, porId: produtoPorId } = useProdutosAcabadosAtivos();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    setError,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: (valores, contexto, opcoes) => zodResolver(criarEsquema())(valores, contexto, opcoes),
    defaultValues: inicial
      ? {
          numero_pedido: inicial.numero_pedido,
          cliente_id: String(inicial.cliente_id),
          data_pedido: inicial.data_pedido,
          data_entrega_prometida: inicial.data_entrega_prometida,
          observacoes: inicial.observacoes ?? '',
          itens: (inicial.itens ?? []).map((i) => ({
            produto_acabado_id: String(i.produto_acabado_id),
            quantidade: String(i.quantidade),
            preco_unitario: precoParaTexto(i.preco_unitario),
          })),
        }
      : {
          numero_pedido: '',
          cliente_id: '',
          data_pedido: hojeAAAAMMDD(),
          data_entrega_prometida: '',
          observacoes: '',
          itens: [ITEM_VAZIO],
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' });
  const itensObservados = watch('itens');

  // Escolheu o produto e o preco esta vazio: traz o preco de venda do cadastro.
  const produtosEscolhidos = itensObservados.map((i) => i.produto_acabado_id).join('|');
  useEffect(() => {
    getValues('itens').forEach((item, indice) => {
      const produto = produtoPorId.get(Number(item.produto_acabado_id));
      if (produto && item.preco_unitario.trim() === '') {
        setValue(`itens.${indice}.preco_unitario`, precoParaTexto(produto.preco_venda));
      }
    });
  }, [produtosEscolhidos, produtoPorId, getValues, setValue]);

  const mutacao = useMutation({
    mutationFn: (corpo: CorpoPedidoVenda) =>
      inicial ? atualizarPedidoVenda(inicial.id, corpo) : criarPedidoVenda(corpo),
    onSuccess: (salvo) => {
      void clienteQuery.invalidateQueries({ queryKey: ['pedidos-venda'] });
      mostrarToast(inicial ? t('Pedido de venda atualizado') : t('Pedido de venda cadastrado'));
      navegar(`/pedidos-venda/${salvo.id}`);
    },
    onError: (erro) => {
      const { porCampo } = separarErro(erro);
      for (const [campo, mensagem] of Object.entries(porCampo)) {
        setError(campo as keyof Formulario, { message: mensagem });
      }
    },
  });

  const { geral: erroGeral } = separarErro(mutacao.error);

  const total = itensObservados.reduce(
    (soma, i) => soma + (Number(i.quantidade) || 0) * (Number(String(i.preco_unitario).replace(',', '.')) || 0),
    0,
  );

  const titulo = inicial ? t('Editar pedido {numero}', { numero: inicial.numero_pedido }) : t('Novo pedido de venda');

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{titulo}</h1>
        <p className="text-body text-texto-secondary">
          {t('Informe o cliente, a entrega prometida e os produtos. Depois de salvar, gere a ordem de produção de cada item.')}
        </p>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit((valores) => mutacao.mutate(paraCorpo(valores)))}
        className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6"
      >
        {erroGeral && (
          <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
            {erroGeral}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            rotulo={t('Número do pedido')}
            obrigatorio
            tipoDado="codigo"
            ajuda={t('Ex.: PV-2026-001 (o número do cliente ou o interno)')}
            erro={errors.numero_pedido?.message}
            {...register('numero_pedido')}
          />
          <Selecao
            rotulo={t('Cliente')}
            obrigatorio
            opcoes={opcoesCliente}
            placeholder={t('Selecione')}
            erro={errors.cliente_id?.message}
            {...register('cliente_id')}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            rotulo={t('Data do pedido')}
            obrigatorio
            ajuda={t('Formato AAAA-MM-DD')}
            erro={errors.data_pedido?.message}
            {...register('data_pedido')}
          />
          <Campo
            rotulo={t('Entrega prometida')}
            obrigatorio
            ajuda={t('Formato AAAA-MM-DD')}
            erro={errors.data_entrega_prometida?.message}
            {...register('data_entrega_prometida')}
          />
        </div>

        <Campo rotulo={t('Observações')} erro={errors.observacoes?.message} {...register('observacoes')} />

        <div className="flex flex-col gap-3">
          <h2 className="text-subtitle text-texto-primary">{t('Itens')}</h2>
          {errors.itens?.message && (
            <p role="alert" className="text-label text-estado-pending">
              {errors.itens.message}
            </p>
          )}
          {errors.itens?.root?.message && (
            <p role="alert" className="text-label text-estado-pending">
              {errors.itens.root.message}
            </p>
          )}

          {fields.map((campo, indice) => (
            <div key={campo.id} className="grid gap-3 rounded-campo border border-borda-subtle p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
              <Selecao
                rotulo={t('Produto acabado')}
                obrigatorio
                opcoes={opcoesProduto}
                placeholder={t('Selecione')}
                erro={errors.itens?.[indice]?.produto_acabado_id?.message}
                {...register(`itens.${indice}.produto_acabado_id` as const)}
              />
              <Campo
                rotulo={t('Quantidade')}
                obrigatorio
                tipoDado="quantidade"
                erro={errors.itens?.[indice]?.quantidade?.message}
                {...register(`itens.${indice}.quantidade` as const)}
              />
              <Campo
                rotulo={t('Preço unitário (R$)')}
                obrigatorio
                tipoDado="quantidade"
                inputMode="decimal"
                erro={errors.itens?.[indice]?.preco_unitario?.message}
                {...register(`itens.${indice}.preco_unitario` as const)}
              />
              {fields.length > 1 && (
                <Botao variante="fantasma" icone="trash-2" className="self-end" onClick={() => remove(indice)}>
                  {t('Remover item')}
                </Botao>
              )}
            </div>
          ))}

          <Botao variante="secundaria" icone="plus" onClick={() => append(ITEM_VAZIO)} className="self-start">
            {t('Adicionar item')}
          </Botao>

          <p className="text-right text-body text-texto-secondary">
            {t('Total:')} <span className="font-mono tabular text-texto-primary">{formatarMoeda(total)}</span>
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Botao
            variante="secundaria"
            onClick={() => navegar(inicial ? `/pedidos-venda/${inicial.id}` : '/pedidos-venda')}
            disabled={mutacao.isPending}
          >
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
