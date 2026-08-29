import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import type { Fornecedor } from '@/tipos/cadastros';

/**
 * Validacao de forma, nao de regra: o dominio no backend e a autoridade sobre
 * CNPJ valido e e-mail valido. Aqui so evitamos o ida-e-volta obvio.
 */
const esquema = z.object({
  razao_social: z.string().trim().min(1, 'Informe a razão social'),
  cnpj: z.string().trim().min(1, 'Informe o CNPJ'),
  lead_time_medio: z.coerce.number().int().positive('O lead time deve ser maior que zero'),
  contato_nome: z.string().trim().max(100).default(''),
  contato_email: z.string().trim().max(100).default(''),
  contato_telefone: z.string().trim().max(20).default(''),
  endereco: z.string().trim().max(255).default(''),
  condicao_pagamento: z.string().trim().max(50).default(''),
  ativo: z.enum(['true', 'false']),
});

type Formulario = z.input<typeof esquema>;

export interface CorpoFornecedor {
  razao_social: string;
  cnpj: string;
  contato_nome: string;
  contato_email: string;
  contato_telefone: string;
  endereco: string;
  lead_time_medio: number;
  condicao_pagamento: string;
  ativo: boolean;
}

export interface FormularioFornecedorProps {
  inicial?: Fornecedor;
  ocupado: boolean;
  /** Mensagem da API que nao aponta para um campo (regra de dominio, 409). */
  erroGeral: string | null;
  /** Erros por campo vindos do `detalhes` do 400. */
  errosPorCampo: Record<string, string>;
  aoEnviar: (corpo: CorpoFornecedor) => void;
  aoCancelar: () => void;
}

const SITUACAO = [
  { valor: 'true', rotulo: 'Ativo' },
  { valor: 'false', rotulo: 'Inativo' },
];

export function FormularioFornecedor({
  inicial,
  ocupado,
  erroGeral,
  errosPorCampo,
  aoEnviar,
  aoCancelar,
}: FormularioFornecedorProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      razao_social: inicial?.razao_social ?? '',
      cnpj: inicial?.cnpj ?? '',
      lead_time_medio: inicial?.lead_time_medio ?? 7,
      contato_nome: inicial?.contato_nome ?? '',
      contato_email: inicial?.contato_email ?? '',
      contato_telefone: inicial?.contato_telefone ?? '',
      endereco: inicial?.endereco ?? '',
      condicao_pagamento: inicial?.condicao_pagamento ?? '',
      ativo: inicial ? String(inicial.ativo) as 'true' | 'false' : 'true',
    },
  });

  /** O erro do formulario vence o da API: e o mais recente que a pessoa viu. */
  const erroDe = (campo: keyof Formulario): string | undefined =>
    errors[campo]?.message ?? errosPorCampo[campo];

  return (
    <form
      onSubmit={handleSubmit((valores) =>
        aoEnviar({
          razao_social: valores.razao_social,
          cnpj: valores.cnpj,
          contato_nome: valores.contato_nome ?? '',
          contato_email: valores.contato_email ?? '',
          contato_telefone: valores.contato_telefone ?? '',
          endereco: valores.endereco ?? '',
          lead_time_medio: Number(valores.lead_time_medio),
          condicao_pagamento: valores.condicao_pagamento ?? '',
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

      <Campo rotulo="Razão social" obrigatorio erro={erroDe('razao_social')} {...register('razao_social')} />

      <div className="grid gap-4 md:grid-cols-2">
        <Campo
          rotulo="CNPJ"
          obrigatorio
          tipoDado="codigo"
          ajuda="Com ou sem pontuação"
          erro={erroDe('cnpj')}
          {...register('cnpj')}
        />
        <Campo
          rotulo="Lead time médio (dias)"
          obrigatorio
          tipoDado="quantidade"
          erro={erroDe('lead_time_medio')}
          {...register('lead_time_medio')}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Campo rotulo="Nome do contato" erro={erroDe('contato_nome')} {...register('contato_nome')} />
        <Campo rotulo="E-mail do contato" type="email" erro={erroDe('contato_email')} {...register('contato_email')} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Campo rotulo="Telefone do contato" erro={erroDe('contato_telefone')} {...register('contato_telefone')} />
        <Campo rotulo="Condição de pagamento" erro={erroDe('condicao_pagamento')} {...register('condicao_pagamento')} />
      </div>

      <Campo rotulo="Endereço" erro={erroDe('endereco')} {...register('endereco')} />

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
