import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { OPCOES_ETAPA, ROTULO_ETAPA, type CentroTrabalho, type EtapaProducao } from '@/tipos/cadastros';

const ETAPAS = Object.keys(ROTULO_ETAPA) as [EtapaProducao, ...EtapaProducao[]];

/**
 * Validacao de forma: o backend continua a autoridade sobre o formato do
 * codigo e a faixa da capacidade. A capacidade aceita virgula decimal porque
 * e assim que se digita "7,5" no Brasil.
 */
const esquema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,20}$/, 'Use de 2 a 20 caracteres: letras, números, "_" ou "-"'),
  nome: z.string().trim().min(1, 'Informe o nome').max(100, 'Use até 100 caracteres'),
  etapa: z.enum(ETAPAS, { errorMap: () => ({ message: 'Escolha a etapa' }) }),
  capacidade_horas_dia: z
    .string()
    .trim()
    .default('')
    .refine((v) => {
      if (v === '') return true;
      // Uma casa decimal, no máximo (o banco arredondaria o resto sem aviso).
      if (!/^\d{1,2}([.,]\d)?$/.test(v)) return false;
      const n = Number(v.replace(',', '.'));
      return n > 0 && n <= 24;
    }, 'Informe um valor maior que 0 e até 24 horas, com até uma casa decimal, ou deixe em branco'),
  custo_hora: z
    .string()
    .trim()
    .default('')
    .refine((v) => {
      if (v === '') return true;
      // Até duas casas decimais: é dinheiro.
      if (!/^\d{1,8}([.,]\d{1,2})?$/.test(v)) return false;
      return Number(v.replace(',', '.')) >= 0;
    }, 'Informe um valor maior ou igual a zero, com até duas casas decimais, ou deixe em branco'),
  descricao: z.string().trim().max(255, 'Use até 255 caracteres').default(''),
  ativo: z.enum(['true', 'false']),
});

type Formulario = z.input<typeof esquema>;

export interface CorpoCentroTrabalho {
  codigo: string;
  nome: string;
  etapa: EtapaProducao;
  /** null quando nao informada. */
  capacidade_horas_dia: number | null;
  /**
   * Custo por hora em R$; null quando nao informado. Ausente quando quem
   * edita nao tem producao.custos: o backend preserva o valor atual.
   */
  custo_hora?: number | null;
  descricao: string;
  ativo: boolean;
}

export interface FormularioCentroTrabalhoProps {
  inicial?: CentroTrabalho;
  ocupado: boolean;
  erroGeral: string | null;
  errosPorCampo: Record<string, string>;
  aoEnviar: (corpo: CorpoCentroTrabalho) => void;
  aoCancelar: () => void;
}

const SITUACAO = [
  { valor: 'true', rotulo: 'Ativo' },
  { valor: 'false', rotulo: 'Inativo' },
];

function capacidadeParaTexto(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '' : String(valor).replace('.', ',');
}

export function FormularioCentroTrabalho({
  inicial,
  ocupado,
  erroGeral,
  errosPorCampo,
  aoEnviar,
  aoCancelar,
}: FormularioCentroTrabalhoProps) {
  // Custo/hora e dado de custo: so quem ve custos (producao.custos) o ve e edita.
  const podeVerCustos = usePode(PERMISSOES.producaoCustos);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      codigo: inicial?.codigo ?? '',
      nome: inicial?.nome ?? '',
      etapa: inicial?.etapa ?? ('' as EtapaProducao),
      capacidade_horas_dia: capacidadeParaTexto(inicial?.capacidade_horas_dia),
      custo_hora: capacidadeParaTexto(inicial?.custo_hora),
      descricao: inicial?.descricao ?? '',
      ativo: inicial ? (String(inicial.ativo) as 'true' | 'false') : 'true',
    },
  });

  const erroDe = (campo: keyof Formulario): string | undefined =>
    errors[campo]?.message ?? errosPorCampo[campo];

  return (
    <form
      onSubmit={handleSubmit((valores) => {
        const capacidade = (valores.capacidade_horas_dia ?? '').trim();
        const custoHora = (valores.custo_hora ?? '').trim();
        aoEnviar({
          codigo: inicial ? inicial.codigo : valores.codigo.trim().toUpperCase(),
          nome: valores.nome,
          etapa: valores.etapa,
          capacidade_horas_dia: capacidade === '' ? null : Number(capacidade.replace(',', '.')),
          ...(podeVerCustos ? { custo_hora: custoHora === '' ? null : Number(custoHora.replace(',', '.')) } : {}),
          descricao: valores.descricao ?? '',
          ativo: valores.ativo === 'true',
        });
      })}
      noValidate
      className="flex flex-col gap-4"
    >
      {erroGeral && (
        <p
          role="alert"
          className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending"
        >
          {erroGeral}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        {inicial ? (
          // O codigo identifica o centro nas ordens de producao: nao muda.
          // Fica fora do register para o valor nao depender do campo desabilitado.
          <Campo
            rotulo="Código"
            obrigatorio
            tipoDado="codigo"
            disabled
            value={inicial.codigo}
            readOnly
            ajuda="O código não pode ser alterado"
          />
        ) : (
          <Campo
            rotulo="Código"
            obrigatorio
            tipoDado="codigo"
            ajuda="Ex.: MONT-01"
            erro={erroDe('codigo')}
            {...register('codigo')}
          />
        )}
        <Campo rotulo="Nome" obrigatorio erro={erroDe('nome')} {...register('nome')} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Selecao
          rotulo="Etapa"
          obrigatorio
          placeholder="Selecione"
          opcoes={OPCOES_ETAPA}
          erro={erroDe('etapa')}
          {...register('etapa')}
        />
        <Campo
          rotulo="Capacidade (horas/dia)"
          tipoDado="quantidade"
          inputMode="decimal"
          ajuda="Opcional, até 24"
          erro={erroDe('capacidade_horas_dia')}
          {...register('capacidade_horas_dia')}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {podeVerCustos && (
          <Campo
            rotulo="Custo por hora (R$)"
            tipoDado="quantidade"
            inputMode="decimal"
            ajuda="Opcional — entra no custo real das ordens de produção"
            erro={erroDe('custo_hora')}
            {...register('custo_hora')}
          />
        )}
        <Campo rotulo="Descrição" erro={erroDe('descricao')} {...register('descricao')} />
      </div>

      {inicial && (
        <div className="w-[200px]">
          <Selecao rotulo="Situação" opcoes={SITUACAO} {...register('ativo')} />
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Botao variante="secundaria" onClick={aoCancelar} disabled={ocupado}>
          Cancelar
        </Botao>
        <Botao type="submit" icone="save" ocupado={ocupado} rotuloOcupado="Salvando…">
          Salvar
        </Botao>
      </div>
    </form>
  );
}
