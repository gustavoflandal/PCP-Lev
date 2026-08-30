import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import type { ProdutoAcabado } from '@/tipos/cadastros';

/**
 * Validacao de forma, nao de regra: o dominio no backend e a autoridade sobre
 * unicidade de codigo e casas decimais do preco. Aqui so evitamos o ida-e-volta obvio.
 */
const esquema = z.object({
  codigo: z.string().trim().min(1, 'Informe o código'),
  descricao: z.string().trim().min(5, 'A descrição precisa de ao menos 5 caracteres'),
  unidade_medida: z.string().trim().min(1, 'Informe a unidade de medida'),
  preco_venda: z.coerce.number().positive('O preço de venda deve ser maior que zero'),
  lead_time_producao: z.coerce.number().int().positive('O lead time deve ser maior que zero'),
  ativo: z.enum(['true', 'false']),
});

type Formulario = z.input<typeof esquema>;

export interface CorpoProduto {
  codigo: string;
  descricao: string;
  unidade_medida: string;
  preco_venda: number;
  lead_time_producao: number;
  ativo: boolean;
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

const SITUACAO = [
  { valor: 'true', rotulo: 'Ativo' },
  { valor: 'false', rotulo: 'Inativo' },
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
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      codigo: inicial?.codigo ?? '',
      descricao: inicial?.descricao ?? '',
      unidade_medida: inicial?.unidade_medida ?? '',
      preco_venda: inicial?.preco_venda ?? 0,
      lead_time_producao: inicial?.lead_time_producao ?? 7,
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
          preco_venda: Number(valores.preco_venda),
          lead_time_producao: Number(valores.lead_time_producao),
          ativo: valores.ativo === 'true',
        }),
      )}
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

      <div className="grid gap-4 md:grid-cols-2">
        <Campo
          rotulo="Preço de venda"
          obrigatorio
          tipoDado="quantidade"
          step="0.01"
          erro={erroDe('preco_venda')}
          {...register('preco_venda')}
        />
        <Campo
          rotulo="Lead time de produção (dias)"
          obrigatorio
          tipoDado="quantidade"
          erro={erroDe('lead_time_producao')}
          {...register('lead_time_producao')}
        />
      </div>

      <div className="w-[200px]">
        <Selecao rotulo="Situação" opcoes={SITUACAO} {...register('ativo')} />
      </div>

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
