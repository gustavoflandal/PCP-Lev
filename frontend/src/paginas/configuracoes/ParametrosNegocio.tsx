import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { useParametrosNegocio } from '@/hooks/useParametrosNegocio';
import { separarErro } from '@/lib/errosDeFormulario';
import { atualizarParametrosNegocio, chaveParametrosNegocio } from '@/servicos/negocio';
import type { ConfiguracaoNegocio, DadosNegocio, MetodoCusteio } from '@/tipos/negocio';
import { PERMISSOES, usePode } from '@/lib/permissoes';

const OPCOES_CUSTEIO: { valor: MetodoCusteio; rotulo: string }[] = [
  { valor: 'CMP', rotulo: 'Custo Médio Ponderado' },
  { valor: 'PEPS', rotulo: 'PEPS (primeiro que entra, primeiro que sai)' },
  { valor: 'UPC', rotulo: 'Último Preço de Compra' },
];

const OPCOES_DIVERGENCIA = [
  { valor: 'BLOQUEAR', rotulo: 'Bloquear a efetivação da nota' },
  { valor: 'APROVAR', rotulo: 'Exigir aprovação (permissão "Aprovar divergência de preço")' },
];

const OPCOES_ALCADA = [
  { valor: 'sem-limite', rotulo: 'Sem limite — o Gestor emite qualquer valor' },
  { valor: 'limitado', rotulo: 'Limitar ao valor abaixo — acima dele, só o Administrador' },
];

const CLASSE_AVISO =
  'rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending';

/** No máximo duas casas decimais (o backend recusa mais, para não arredondar
 * dinheiro nem porcentagem em silêncio). */
const duasCasas = (n: number) => Math.round(n * 100) === Number((n * 100).toFixed(6));

/**
 * Validação de forma; os intervalos são os mesmos do domínio (negocio.Dados.
 * Validar), que continua sendo a autoridade.
 */
const esquema = z
  .object({
    metodo_custeio: z.enum(['CMP', 'PEPS', 'UPC']),
    tolerancia_excesso_recebimento_pct: z.coerce
      .number({ invalid_type_error: 'Informe a tolerância (0 a 100)' })
      .min(0, 'A tolerância vai de 0% a 100%')
      .max(100, 'A tolerância vai de 0% a 100%')
      .refine(duasCasas, 'Use no máximo duas casas decimais'),
    tolerancia_preco_pct: z.coerce
      .number({ invalid_type_error: 'Informe a tolerância (0 a 100)' })
      .min(0, 'A tolerância vai de 0% a 100%')
      .max(100, 'A tolerância vai de 0% a 100%')
      .refine(duasCasas, 'Use no máximo duas casas decimais'),
    divergencia_preco_acao: z.enum(['BLOQUEAR', 'APROVAR']),
    lead_time_padrao_dias: z.coerce
      .number({ invalid_type_error: 'Informe o lead time em dias' })
      .int('Use um número inteiro de dias')
      .min(1, 'Entre 1 e 365 dias')
      .max(365, 'Entre 1 e 365 dias'),
    alcada: z.enum(['sem-limite', 'limitado']),
    limite_emissao_gestor: z.string(),
    cotacoes_minimas: z.coerce
      .number({ invalid_type_error: 'Informe de 0 a 10' })
      .int('Use um número inteiro')
      .min(0, 'De 0 a 10 cotações')
      .max(10, 'De 0 a 10 cotações'),
    valor_exige_cotacoes: z.coerce
      .number({ invalid_type_error: 'Informe o valor' })
      .min(0, 'O valor não pode ser negativo')
      .refine(duasCasas, 'Use no máximo duas casas decimais'),
  })
  .superRefine((valores, ctx) => {
    if (valores.alcada !== 'limitado') return;
    const limite = Number(valores.limite_emissao_gestor);
    if (valores.limite_emissao_gestor.trim() === '' || Number.isNaN(limite) || limite < 0 || !duasCasas(limite)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['limite_emissao_gestor'],
        message: 'Informe o valor máximo (com até duas casas decimais)',
      });
    }
  });

type Formulario = z.infer<typeof esquema>;

function paraFormulario(cfg: ConfiguracaoNegocio): Formulario {
  return {
    metodo_custeio: cfg.metodo_custeio,
    tolerancia_excesso_recebimento_pct: cfg.tolerancia_excesso_recebimento_pct,
    // Configuracao anterior a v1.2 nao traz os campos: 0% e BLOQUEAR (padrao do backend).
    tolerancia_preco_pct: cfg.tolerancia_preco_pct ?? 0,
    divergencia_preco_acao: cfg.divergencia_preco_acao === 'APROVAR' ? 'APROVAR' : 'BLOQUEAR',
    lead_time_padrao_dias: cfg.lead_time_padrao_dias,
    alcada: cfg.limite_emissao_gestor === null ? 'sem-limite' : 'limitado',
    limite_emissao_gestor: cfg.limite_emissao_gestor === null ? '' : String(cfg.limite_emissao_gestor),
    cotacoes_minimas: cfg.cotacoes_minimas,
    valor_exige_cotacoes: cfg.valor_exige_cotacoes,
  };
}

function paraCorpo(valores: Formulario): DadosNegocio {
  return {
    metodo_custeio: valores.metodo_custeio,
    tolerancia_excesso_recebimento_pct: valores.tolerancia_excesso_recebimento_pct,
    lead_time_padrao_dias: valores.lead_time_padrao_dias,
    limite_emissao_gestor: valores.alcada === 'limitado' ? Number(valores.limite_emissao_gestor) : null,
    cotacoes_minimas: valores.cotacoes_minimas,
    valor_exige_cotacoes: valores.valor_exige_cotacoes,
    tolerancia_preco_pct: valores.tolerancia_preco_pct,
    divergencia_preco_acao: valores.divergencia_preco_acao,
  };
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <section
      aria-label={titulo}
      className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6"
    >
      <div>
        <h2 className="text-subtitle text-texto-primary">{titulo}</h2>
        <p className="text-label text-texto-secondary">{descricao}</p>
      </div>
      {children}
    </section>
  );
}

function FormularioNegocio({ atual }: { atual: ConfiguracaoNegocio }) {
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Formulario>({ resolver: zodResolver(esquema), defaultValues: paraFormulario(atual) });

  const mutacao = useMutation({
    mutationFn: atualizarParametrosNegocio,
    onSuccess: (atualizada) => {
      queryClient.setQueryData(chaveParametrosNegocio, atualizada);
      mostrarToast('Parâmetros de negócio salvos');
    },
    onError: (erro) => {
      mostrarToast(separarErro(erro).geral ?? 'Não foi possível salvar os parâmetros de negócio.', 'pending');
    },
  });

  const limitado = watch('alcada') === 'limitado';

  return (
    <form
      aria-label="Parâmetros de negócio"
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((valores) => mutacao.mutate(paraCorpo(valores)))}
    >
      <Secao titulo="Estoque" descricao="Como o estoque é valorizado e controlado.">
        <Selecao
          rotulo="Método de custeio"
          opcoes={OPCOES_CUSTEIO}
          ajuda="Usado no custo real das ordens de produção, quando o módulo de Produção entrar."
          {...register('metodo_custeio')}
        />
        <div>
          <p className="text-label text-texto-secondary">Saldo negativo</p>
          <p className="text-body text-texto-primary">Bloqueado — o estoque nunca fica abaixo de zero.</p>
        </div>
      </Secao>

      <Secao titulo="Recebimento" descricao="Regras ao conferir e efetivar a nota fiscal de entrada.">
        <Campo
          rotulo="Tolerância de excesso na quantidade recebida (%)"
          type="number"
          step="0.01"
          min={0}
          max={100}
          ajuda="Ex.: com 5%, um item pedido com 100 unidades aceita receber até 105. Com 0%, nada além do pedido."
          erro={errors.tolerancia_excesso_recebimento_pct?.message}
          {...register('tolerancia_excesso_recebimento_pct')}
        />
        <Campo
          rotulo="Tolerância de divergência de preço (%)"
          type="number"
          step="0.01"
          min={0}
          max={100}
          ajuda="Diferença aceita entre o preço unitário da nota (por unidade de consumo) e o do pedido. Ex.: 2% aceita até R$ 51,00 num item pedido a R$ 50,00."
          erro={errors.tolerancia_preco_pct?.message}
          {...register('tolerancia_preco_pct')}
        />
        <Selecao
          rotulo="Acima da tolerância"
          opcoes={OPCOES_DIVERGENCIA}
          ajuda="Bloquear impede efetivar a nota até corrigir; exigir aprovação deixa efetivar só quem tem a permissão — e registra quem aprovou."
          {...register('divergencia_preco_acao')}
        />
      </Secao>

      <Secao titulo="Compras" descricao="Padrões e aprovações de compra.">
        <Campo
          rotulo="Lead time padrão (dias)"
          type="number"
          min={1}
          max={365}
          ajuda="Valor inicial do lead time ao cadastrar um fornecedor ou uma parte/peça nova."
          erro={errors.lead_time_padrao_dias?.message}
          {...register('lead_time_padrao_dias')}
        />
        <Selecao rotulo="Alçada do Gestor para emitir pedido de compra" opcoes={OPCOES_ALCADA} {...register('alcada')} />
        {/* Oculto (nao desabilitado) sem limite: no react-hook-form, um input
            com disabled nativo e enviado como undefined. */}
        {limitado && (
          <Campo
            rotulo="Valor máximo que o Gestor emite (R$)"
            type="number"
            step="0.01"
            min={0}
            ajuda="Pedidos acima deste valor total só podem ser emitidos por um Administrador."
            erro={errors.limite_emissao_gestor?.message}
            {...register('limite_emissao_gestor')}
          />
        )}
        <Campo
          rotulo="Mínimo de cotações por peça"
          type="number"
          min={0}
          max={10}
          ajuda="Fornecedores diferentes com cotação respondida nos últimos 90 dias. 0 desliga a regra."
          erro={errors.cotacoes_minimas?.message}
          {...register('cotacoes_minimas')}
        />
        <Campo
          rotulo="Exigir as cotações a partir do valor total de (R$)"
          type="number"
          step="0.01"
          min={0}
          ajuda="Pedidos com valor total a partir deste exigem o mínimo de cotações acima. 0 = todos os pedidos."
          erro={errors.valor_exige_cotacoes?.message}
          {...register('valor_exige_cotacoes')}
        />
      </Secao>

      <div>
        <Botao type="submit" ocupado={mutacao.isPending} rotuloOcupado="Salvando…">
          Salvar
        </Botao>
      </div>
    </form>
  );
}

export function ParametrosNegocio() {
  const autorizado = usePode(PERMISSOES.configNegocio);
  const consulta = useParametrosNegocio(autorizado, { sempreAtualizar: true });

  let conteudo: ReactNode;
  if (!autorizado) {
    conteudo = (
      <p role="alert" className={CLASSE_AVISO}>
        Acesso restrito: seu perfil não tem permissão para esta tela.
      </p>
    );
  } else if (consulta.isPending || (!consulta.isError && !consulta.isFetchedAfterMount)) {
    // Com dado em cache (de um formulario de cadastro aberto antes), so
    // mostra o formulario depois da busca nova: ele nasce do valor carregado
    // e nao se atualiza depois.
    conteudo = <p className="text-body text-texto-secondary">Carregando parâmetros de negócio…</p>;
  } else if (consulta.isError) {
    // O PUT grava a configuracao inteira -- mostrar o formulario com valores
    // inventados depois de uma falha deixaria "Salvar" sobrescrever a real.
    conteudo = (
      <p role="alert" className={CLASSE_AVISO}>
        Não foi possível carregar os parâmetros de negócio. Recarregue a página para tentar de novo.
      </p>
    );
  } else {
    conteudo = <FormularioNegocio atual={consulta.data} />;
  }

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Parâmetros de negócio</h1>
        <p className="text-body text-texto-secondary">
          Regras de estoque, recebimento e compras — valem para todos os usuários.
        </p>
      </div>
      {conteudo}
    </div>
  );
}
