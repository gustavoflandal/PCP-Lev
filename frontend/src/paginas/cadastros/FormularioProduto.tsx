import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { CaixaMarcacao } from '@/componentes/ui/CaixaMarcacao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import type { ProdutoAcabado } from '@/tipos/cadastros';
import { t, td, marcar } from '@/i18n';

/**
 * Validacao de forma, nao de regra: o dominio no backend e a autoridade sobre
 * unicidade de codigo e casas decimais do preco. Aqui so evitamos o ida-e-volta obvio.
 */
const esquema = z.object({
  codigo: z.string().trim().min(1, marcar('Informe o código')),
  descricao: z.string().trim().min(5, marcar('A descrição precisa de ao menos 5 caracteres')),
  unidade_medida: z.string().trim().min(1, marcar('Informe a unidade de medida')),
  preco_venda: z.coerce.number().positive(marcar('O preço de venda deve ser maior que zero')),
  lead_time_producao: z.coerce.number().int().positive(marcar('O lead time deve ser maior que zero')),
  exige_metrologia: z.boolean().default(false),
  ativo: z.enum(['true', 'false']),
  // Flags de controle do item (4.1.1); validade so com lote (o backend devolve 400).
  controla_numero_serie: z.boolean().default(false),
  controla_lote: z.boolean().default(false),
  controla_validade: z.boolean().default(false),
  item_critico: z.boolean().default(false),
  exige_certificado: z.boolean().default(false),
  pode_ser_componente: z.boolean().default(false),
});

type Formulario = z.input<typeof esquema>;

export interface CorpoProduto {
  codigo: string;
  descricao: string;
  unidade_medida: string;
  preco_venda: number;
  lead_time_producao: number;
  /** Radar sujeito ao Inmetro: cada unidade precisa da verificação metrológica antes de sair de Testes. */
  exige_metrologia: boolean;
  ativo: boolean;
  controla_numero_serie: boolean;
  controla_lote: boolean;
  controla_validade: boolean;
  item_critico: boolean;
  exige_certificado: boolean;
  /** Produto pode compor a BOM de outro produto acabado; o sistema mantém um espelho em partes/peças. */
  pode_ser_componente: boolean;
}

export interface FormularioProdutoProps {
  inicial?: ProdutoAcabado;
  ocupado: boolean;
  /** Mensagem da API que nao aponta para um campo (regra de dominio, 409). */
  erroGeral: string | null;
  /** Erros por campo vindos do `detalhes` do 400. */
  errosPorCampo: Record<string, string>;
  aoEnviar: (corpo: CorpoProduto) => void;
  aoCancelar: () => void;
}

const opcoesSituacao = () => [
  { valor: 'true', rotulo: t('Ativo') },
  { valor: 'false', rotulo: t('Inativo') },
];

export function FormularioProduto({
  inicial,
  ocupado,
  erroGeral,
  errosPorCampo,
  aoEnviar,
  aoCancelar,
}: FormularioProdutoProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      codigo: inicial?.codigo ?? '',
      descricao: inicial?.descricao ?? '',
      unidade_medida: inicial?.unidade_medida ?? '',
      preco_venda: inicial?.preco_venda ?? 0,
      lead_time_producao: inicial?.lead_time_producao ?? 7,
      exige_metrologia: inicial?.exige_metrologia ?? false,
      ativo: inicial ? (String(inicial.ativo) as 'true' | 'false') : 'true',
      controla_numero_serie: inicial?.controla_numero_serie ?? false,
      controla_lote: inicial?.controla_lote ?? false,
      controla_validade: inicial?.controla_validade ?? false,
      item_critico: inicial?.item_critico ?? false,
      exige_certificado: inicial?.exige_certificado ?? false,
      pode_ser_componente: inicial?.pode_ser_componente ?? false,
    },
  });

  const controlaLote = watch('controla_lote');

  /** O erro do formulario vence o da API: e o mais recente que a pessoa viu. */
  const erroDe = (campo: keyof Formulario): string | undefined =>
    td(errors[campo]?.message ?? errosPorCampo[campo]) || undefined;

  return (
    <form
      onSubmit={handleSubmit((valores) =>
        aoEnviar({
          codigo: valores.codigo,
          descricao: valores.descricao,
          unidade_medida: valores.unidade_medida,
          preco_venda: Number(valores.preco_venda),
          lead_time_producao: Number(valores.lead_time_producao),
          exige_metrologia: valores.exige_metrologia ?? false,
          ativo: valores.ativo === 'true',
          controla_numero_serie: valores.controla_numero_serie ?? false,
          controla_lote: valores.controla_lote ?? false,
          controla_validade: (valores.controla_lote ?? false) && (valores.controla_validade ?? false),
          item_critico: valores.item_critico ?? false,
          exige_certificado: valores.exige_certificado ?? false,
          pode_ser_componente: valores.pode_ser_componente ?? false,
        }),
      )}
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
          rotulo={t('Código')}
          obrigatorio
          tipoDado="codigo"
          erro={erroDe('codigo')}
          {...register('codigo')}
        />
        <Campo rotulo={t('Unidade')} obrigatorio erro={erroDe('unidade_medida')} {...register('unidade_medida')} />
      </div>

      <Campo rotulo={t('Descrição')} obrigatorio erro={erroDe('descricao')} {...register('descricao')} />

      <div className="grid gap-4 md:grid-cols-2">
        <Campo
          rotulo={t('Preço de venda')}
          obrigatorio
          tipoDado="quantidade"
          step="0.01"
          erro={erroDe('preco_venda')}
          {...register('preco_venda')}
        />
        <Campo
          rotulo={t('Lead time de produção (dias)')}
          obrigatorio
          tipoDado="quantidade"
          erro={erroDe('lead_time_producao')}
          {...register('lead_time_producao')}
        />
      </div>

      <label className="flex min-h-linha items-center gap-2 text-body text-texto-primary">
        <input type="checkbox" className="h-4 w-4 accent-brand" {...register('exige_metrologia')} />
        {t('Exige metrologia (Inmetro)')}
        <span className="text-label text-texto-secondary">
          {t('— cada unidade precisa de aprovação de modelo, lacre e validade antes de sair de Testes')}
        </span>
      </label>

      <fieldset className="flex flex-col gap-3 rounded-cartao border border-borda-subtle p-4">
        <legend className="px-1 text-label text-texto-secondary">{t('Controle do item')}</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <CaixaMarcacao
            rotulo={t('Controla número de série')}
            ajuda={t('Cada unidade produzida é identificada pela série.')}
            {...register('controla_numero_serie')}
          />
          <CaixaMarcacao
            rotulo={t('Controla lote')}
            ajuda={t('A produção e a expedição registram o lote.')}
            {...register('controla_lote', {
              onChange: (evento: { target: { checked: boolean } }) => {
                if (!evento.target.checked) {
                  setValue('controla_validade', false);
                }
              },
            })}
          />
          <CaixaMarcacao
            rotulo={t('Controla validade')}
            ajuda={controlaLote ? t('Cada lote passa a ter validade.') : t('Marque "Controla lote" antes: validade é do lote.')}
            disabled={!controlaLote}
            {...register('controla_validade')}
          />
          <CaixaMarcacao
            rotulo={t('Item crítico (exige foto principal)')}
            ajuda={t('A foto principal passa a ser obrigatória.')}
            {...register('item_critico')}
          />
          <CaixaMarcacao
            rotulo={t('Exige certificado no recebimento')}
            ajuda={t('A entrada só é concluída com o certificado anexado.')}
            {...register('exige_certificado')}
          />
          <CaixaMarcacao
            rotulo={t('Pode ser componente de outro produto')}
            ajuda={t('O produto aparecerá na lista de partes/peças e poderá compor a estrutura de outro produto acabado.')}
            {...register('pode_ser_componente')}
          />
        </div>
      </fieldset>

      {inicial && (
        // So faz sentido escolher a situacao ao editar: e a unica forma de
        // reativar um produto. Ao criar, o registro sempre nasce ativo, e
        // mostrar o campo aqui so adicionaria uma decisao sem sentido.
        <div className="w-[200px]">
          <Selecao rotulo={t('Situação')} opcoes={opcoesSituacao()} {...register('ativo')} />
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Botao variante="secundaria" onClick={aoCancelar} disabled={ocupado}>
          {t('Cancelar')}
        </Botao>
        <Botao type="submit" icone="save" ocupado={ocupado} rotuloOcupado={t('Salvando…')}>
          {t('Salvar')}
        </Botao>
      </div>
    </form>
  );
}
