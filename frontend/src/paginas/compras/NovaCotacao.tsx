import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
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
  itens: z.array(itemEsquema).min(1, 'Informe ao menos um item'),
});

type Formulario = {
  numero_cotacao: string;
  fornecedor_id: string;
  data_validade: string;
  itens: { parte_peca_id: string; quantidade: string; preco_unitario: string }[];
};

const ITEM_VAZIO = { parte_peca_id: '', quantidade: '1', preco_unitario: '0' };

/** Estado de navegacao opcional vindo da tela de Necessidade de compra
 * (botao "Gerar cotação") -- fornecedor e itens ja escolhidos, so falta o
 * preco, que a API nao sabe nesse ponto do fluxo. */
interface PreenchimentoNecessidadeCompra {
  fornecedorId: number | null;
  itens: { parte_peca_id: number; quantidade: number }[];
}

export function NovaCotacao() {
  const navegar = useNavigate();
  const localizacao = useLocation();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const { opcoes: opcoesFornecedor } = useFornecedoresAtivos();
  const { opcoes: opcoesPeca } = usePartesPecasAtivas();

  const preenchimento = localizacao.state as PreenchimentoNecessidadeCompra | null;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      numero_cotacao: '',
      fornecedor_id: '',
      data_validade: '',
      itens: [ITEM_VAZIO],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'itens' });
  const itensObservados = watch('itens');

  // O <select> so aceita um value cujo <option> ja existe no DOM -- as
  // opcoes de fornecedor/peca carregam async (useQuery), entao aplicar o
  // preenchimento nos defaultValues do useForm nao funciona (o <select>
  // nasce sem nenhum <option> ainda). Aplicado via setValue/replace so
  // depois que as duas listas de opcoes chegarem, uma unica vez.
  //
  // O gate so espera as listas carregarem (length > 0), nao que os ids que
  // interessam estejam nelas -- por isso todo id e checado contra o
  // conjunto real antes de aplicar: um fornecedor inativado depois do
  // cadastro da peca, ou uma peca fora das 200 primeiras que
  // usePartesPecasAtivas carrega, nao pode virar um id "fantasma" preso no
  // estado do formulario enquanto o <select> mostra em branco.
  const preenchimentoAplicado = useRef(false);
  useEffect(() => {
    if (!preenchimento || preenchimentoAplicado.current) return;
    if (opcoesFornecedor.length === 0 || opcoesPeca.length === 0) return;
    preenchimentoAplicado.current = true;

    const idsFornecedor = new Set(opcoesFornecedor.map((o) => o.valor));
    const idsPeca = new Set(opcoesPeca.map((o) => o.valor));

    const fornecedorValido =
      preenchimento.fornecedorId !== null && idsFornecedor.has(String(preenchimento.fornecedorId));
    if (fornecedorValido) {
      setValue('fornecedor_id', String(preenchimento.fornecedorId));
    }

    const itensValidos = preenchimento.itens.filter((item) => idsPeca.has(String(item.parte_peca_id)));
    if (itensValidos.length > 0) {
      replace(
        itensValidos.map((item) => ({
          parte_peca_id: String(item.parte_peca_id),
          quantidade: String(item.quantidade),
          preco_unitario: '',
        })),
      );
    }

    if (!fornecedorValido || itensValidos.length < preenchimento.itens.length) {
      mostrarToast('Alguns dados não puderam ser pré-preenchidos automaticamente — confira o formulário antes de salvar.');
    }
  }, [preenchimento, opcoesFornecedor, opcoesPeca, setValue, replace, mostrarToast]);

  const mutacao = useMutation({
    mutationFn: (valores: Formulario) =>
      criarCompra<Cotacao>('cotacoes', {
        numero_cotacao: valores.numero_cotacao,
        fornecedor_id: Number(valores.fornecedor_id),
        data_validade: valores.data_validade,
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
