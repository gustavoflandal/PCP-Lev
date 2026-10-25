import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { CaixaMarcacao } from '@/componentes/ui/CaixaMarcacao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { useFornecedoresAtivos } from '@/hooks/useFornecedoresAtivos';
import { LEAD_TIME_PADRAO_FALLBACK, useLeadTimePadrao } from '@/hooks/useParametrosNegocio';
import type { PartePeca } from '@/tipos/cadastros';

/**
 * Validacao de forma, nao de regra: o dominio no backend e a autoridade sobre
 * unicidade de codigo e regras de estoque. Aqui so evitamos o ida-e-volta obvio.
 */
const esquema = z.object({
  codigo: z.string().trim().min(1, 'Informe o código'),
  descricao: z.string().trim().min(5, 'A descrição precisa de ao menos 5 caracteres'),
  unidade_medida: z.string().trim().min(1, 'Informe a unidade de medida'),
  estoque_minimo: z.coerce.number().int().min(0, 'O estoque mínimo não pode ser negativo'),
  estoque_maximo: z.coerce.number().int().positive('O estoque máximo deve ser maior que zero'),
  lead_time_compra: z.coerce.number().int().positive('O lead time deve ser maior que zero'),
  fornecedor_padrao_id: z.string().default(''),
  ativo: z.enum(['true', 'false']),
  // Flags de controle do item (4.1.1). Validade so com lote: a tela impede a
  // combinacao, e o backend tambem (400).
  controla_numero_serie: z.boolean().default(false),
  controla_lote: z.boolean().default(false),
  controla_validade: z.boolean().default(false),
  item_critico: z.boolean().default(false),
  exige_certificado: z.boolean().default(false),
  validade_minima_dias: z.coerce
    .number({ invalid_type_error: 'Informe a validade mínima em dias' })
    .int('Use um número inteiro de dias')
    .min(0, 'A validade mínima vai de 0 a 3650 dias')
    .max(3650, 'A validade mínima vai de 0 a 3650 dias'),
  mascara_serie: z.string().trim().max(120, 'A máscara aceita até 120 caracteres').default(''),
});

type Formulario = z.input<typeof esquema>;

export interface CorpoPeca {
  codigo: string;
  descricao: string;
  unidade_medida: string;
  estoque_minimo: number;
  estoque_maximo: number;
  lead_time_compra: number;
  fornecedor_padrao_id: number | null;
  ativo: boolean;
  controla_numero_serie: boolean;
  controla_lote: boolean;
  controla_validade: boolean;
  item_critico: boolean;
  exige_certificado: boolean;
  validade_minima_dias: number;
  mascara_serie: string;
}

export interface FormularioPecaProps {
  inicial?: PartePeca;
  ocupado: boolean;
  /** Mensagem da API que nao aponta para um campo (regra de dominio, 409). */
  erroGeral: string | null;
  /** Erros por campo vindos do `detalhes` do 400. */
  errosPorCampo: Record<string, string>;
  aoEnviar: (corpo: CorpoPeca) => void;
  aoCancelar: () => void;
}

const SITUACAO = [
  { valor: 'true', rotulo: 'Ativo' },
  { valor: 'false', rotulo: 'Inativo' },
];

export function FormularioPeca({
  inicial,
  ocupado,
  erroGeral,
  errosPorCampo,
  aoEnviar,
  aoCancelar,
}: FormularioPecaProps) {
  const { opcoes: opcoesFornecedor } = useFornecedoresAtivos();

  const {
    register,
    handleSubmit,
    setValue,
    getFieldState,
    watch,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      codigo: inicial?.codigo ?? '',
      descricao: inicial?.descricao ?? '',
      unidade_medida: inicial?.unidade_medida ?? '',
      estoque_minimo: inicial?.estoque_minimo ?? 0,
      estoque_maximo: inicial?.estoque_maximo ?? 1,
      lead_time_compra: inicial?.lead_time_compra ?? LEAD_TIME_PADRAO_FALLBACK,
      fornecedor_padrao_id: inicial?.fornecedor_padrao_id ? String(inicial.fornecedor_padrao_id) : '',
      ativo: inicial ? (String(inicial.ativo) as 'true' | 'false') : 'true',
      controla_numero_serie: inicial?.controla_numero_serie ?? false,
      controla_lote: inicial?.controla_lote ?? false,
      controla_validade: inicial?.controla_validade ?? false,
      item_critico: inicial?.item_critico ?? false,
      exige_certificado: inicial?.exige_certificado ?? false,
      validade_minima_dias: inicial?.validade_minima_dias ?? 0,
      mascara_serie: inicial?.mascara_serie ?? '',
    },
  });

  const controlaSerie = watch('controla_numero_serie');
  const controlaLote = watch('controla_lote');
  const controlaValidade = watch('controla_validade');

  // Cadastro novo nasce com o lead time padrao dos Parametros de negocio. O
  // GET pode responder depois da montagem: so troca o valor enquanto a pessoa
  // ainda nao mexeu no campo, e nunca na edicao de um cadastro existente.
  const leadTimePadrao = useLeadTimePadrao();
  useEffect(() => {
    if (!inicial && !getFieldState('lead_time_compra').isDirty) {
      setValue('lead_time_compra', leadTimePadrao);
    }
  }, [inicial, leadTimePadrao, getFieldState, setValue]);

  /** O erro do formulario vence o da API: e o mais recente que a pessoa viu. */
  const erroDe = (campo: keyof Formulario): string | undefined =>
    errors[campo]?.message ?? errosPorCampo[campo];

  return (
    <form
      onSubmit={handleSubmit((valores) => {
        const lote = valores.controla_lote ?? false;
        const validade = lote && (valores.controla_validade ?? false);
        const serie = valores.controla_numero_serie ?? false;
        aoEnviar({
          codigo: valores.codigo,
          descricao: valores.descricao,
          unidade_medida: valores.unidade_medida,
          estoque_minimo: Number(valores.estoque_minimo),
          estoque_maximo: Number(valores.estoque_maximo),
          lead_time_compra: Number(valores.lead_time_compra),
          fornecedor_padrao_id:
            (valores.fornecedor_padrao_id ?? '') === '' ? null : Number(valores.fornecedor_padrao_id),
          ativo: valores.ativo === 'true',
          controla_numero_serie: serie,
          controla_lote: lote,
          controla_validade: validade,
          item_critico: valores.item_critico ?? false,
          exige_certificado: valores.exige_certificado ?? false,
          // Sem validade/serie os campos nao valem nada: vao zerados.
          validade_minima_dias: validade ? Number(valores.validade_minima_dias) : 0,
          mascara_serie: serie ? (valores.mascara_serie ?? '').trim() : '',
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

      <div className="grid gap-4 md:grid-cols-2">
        <Campo
          rotulo="Código"
          obrigatorio
          tipoDado="codigo"
          erro={erroDe('codigo')}
          {...register('codigo')}
        />
        <Campo rotulo="Unidade" obrigatorio erro={erroDe('unidade_medida')} {...register('unidade_medida')} />
      </div>

      <Campo rotulo="Descrição" obrigatorio erro={erroDe('descricao')} {...register('descricao')} />

      <div className="grid gap-4 md:grid-cols-3">
        <Campo
          rotulo="Estoque mínimo"
          obrigatorio
          tipoDado="quantidade"
          erro={erroDe('estoque_minimo')}
          {...register('estoque_minimo')}
        />
        <Campo
          rotulo="Estoque máximo"
          obrigatorio
          tipoDado="quantidade"
          erro={erroDe('estoque_maximo')}
          {...register('estoque_maximo')}
        />
        <Campo
          rotulo="Lead time de compra (dias)"
          obrigatorio
          tipoDado="quantidade"
          erro={erroDe('lead_time_compra')}
          {...register('lead_time_compra')}
        />
      </div>

      <div className="w-full md:w-1/2">
        <Selecao
          rotulo="Fornecedor padrão"
          placeholder="Sem fornecedor padrão"
          opcoes={opcoesFornecedor}
          {...register('fornecedor_padrao_id')}
        />
      </div>

      <fieldset className="flex flex-col gap-3 rounded-cartao border border-borda-subtle p-4">
        <legend className="px-1 text-label text-texto-secondary">Controle do item</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <CaixaMarcacao
            rotulo="Controla número de série"
            ajuda="Cada unidade recebida e consumida é identificada pela série."
            {...register('controla_numero_serie')}
          />
          <CaixaMarcacao
            rotulo="Controla lote"
            ajuda="O recebimento exige o lote; o consumo segue o lote."
            {...register('controla_lote', {
              onChange: (evento: { target: { checked: boolean } }) => {
                if (!evento.target.checked) {
                  setValue('controla_validade', false);
                }
              },
            })}
          />
          <CaixaMarcacao
            rotulo="Controla validade"
            ajuda={controlaLote ? 'O recebimento exige a validade de cada lote.' : 'Marque "Controla lote" antes: validade é do lote.'}
            disabled={!controlaLote}
            {...register('controla_validade')}
          />
          <CaixaMarcacao
            rotulo="Item crítico (exige foto principal)"
            ajuda="A foto principal passa a ser obrigatória e aparece na separação."
            {...register('item_critico')}
          />
          <CaixaMarcacao
            rotulo="Exige certificado no recebimento"
            ajuda="O recebimento só é concluído com o certificado anexado."
            {...register('exige_certificado')}
          />
        </div>

        {(controlaLote && controlaValidade) || controlaSerie ? (
          <div className="grid gap-4 md:grid-cols-2">
            {controlaLote && controlaValidade && (
              <Campo
                rotulo="Validade mínima no recebimento (dias)"
                tipoDado="quantidade"
                min={0}
                max={3650}
                ajuda="Lote com menos dias de validade restante é recusado. 0 = sem mínimo."
                erro={erroDe('validade_minima_dias')}
                {...register('validade_minima_dias')}
              />
            )}
            {controlaSerie && (
              <Campo
                rotulo="Máscara do número de série"
                // Sem tipoDado="codigo": expressao regular diferencia maiusculas.
                className="font-mono"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                // Atributo JSX literal: a barra invertida chega a tela como esta.
                ajuda="Expressão regular, opcional. Ex.: SN-\d{6} — não use ^ nem $: a série inteira precisa casar."
                erro={erroDe('mascara_serie')}
                {...register('mascara_serie')}
              />
            )}
          </div>
        ) : null}
      </fieldset>

      {inicial && (
        // So faz sentido escolher a situacao ao editar: e a unica forma de
        // reativar uma peca. Ao criar, o registro sempre nasce ativo, e
        // mostrar o campo aqui so adicionaria uma decisao sem sentido.
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
