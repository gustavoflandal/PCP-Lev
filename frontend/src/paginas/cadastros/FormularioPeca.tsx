import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { useFornecedoresAtivos } from '@/hooks/useFornecedoresAtivos';
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
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      codigo: inicial?.codigo ?? '',
      descricao: inicial?.descricao ?? '',
      unidade_medida: inicial?.unidade_medida ?? '',
      estoque_minimo: inicial?.estoque_minimo ?? 0,
      estoque_maximo: inicial?.estoque_maximo ?? 1,
      lead_time_compra: inicial?.lead_time_compra ?? 7,
      fornecedor_padrao_id: inicial?.fornecedor_padrao_id ? String(inicial.fornecedor_padrao_id) : '',
      ativo: inicial ? (String(inicial.ativo) as 'true' | 'false') : 'true',
    },
  });

  /** O erro do formulario vence o da API: e o mais recente que a pessoa viu. */
  const erroDe = (campo: keyof Formulario): string | undefined =>
    errors[campo]?.message ?? errosPorCampo[campo];

  return (
    <form
      onSubmit={handleSubmit((valores) =>
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
