import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao } from '@/componentes/ui/Selecao';
import { OPCOES_TIPO_CLIENTE, ROTULO_TIPO_CLIENTE, type Cliente, type TipoCliente } from '@/tipos/cadastros';

const TIPOS = Object.keys(ROTULO_TIPO_CLIENTE) as [TipoCliente, ...TipoCliente[]];

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const OPCOES_UF = UFS.map((uf) => ({ valor: uf, rotulo: uf }));

/**
 * Validacao de forma, nao de regra: o dominio no backend e a autoridade sobre
 * CNPJ, e-mail e telefone validos. Aqui so evitamos o ida-e-volta obvio.
 */
/** AAAA-MM-DD (ano com 4 dígitos) ou vazio: o navegador aceita ano de 5 dígitos no campo de data. */
const DATA_OU_VAZIO = /^(\d{4}-\d{2}-\d{2})?$/;

const esquema = z
  .object({
    tipo: z.enum(TIPOS, { errorMap: () => ({ message: 'Escolha o tipo de cliente' }) }),
    razao_social: z.string().trim().min(1, 'Informe a razão social').max(255),
    nome_fantasia: z.string().trim().max(255).default(''),
    cnpj: z.string().trim().min(1, 'Informe o CNPJ'),
    inscricao_estadual: z.string().trim().max(30, 'Use até 30 caracteres').default(''),
    contato_nome: z.string().trim().max(100).default(''),
    contato_email: z.string().trim().max(100).default(''),
    contato_telefone: z.string().trim().max(20).default(''),
    endereco: z.string().trim().max(255).default(''),
    cidade: z.string().trim().max(100).default(''),
    uf: z.string().default(''),
    numero_contrato: z.string().trim().max(60, 'Use até 60 caracteres').default(''),
    vigencia_inicio: z.string().regex(DATA_OU_VAZIO, 'Informe uma data válida').default(''),
    vigencia_fim: z.string().regex(DATA_OU_VAZIO, 'Informe uma data válida').default(''),
    condicao_pagamento: z.string().trim().max(50).default(''),
    observacoes: z.string().trim().max(1000, 'Use até 1000 caracteres').default(''),
    ativo: z.enum(['true', 'false']),
  })
  // AAAA-MM-DD compara certo como texto.
  .refine((v) => !v.vigencia_inicio || !v.vigencia_fim || v.vigencia_fim >= v.vigencia_inicio, {
    path: ['vigencia_fim'],
    message: 'O fim da vigência não pode ser antes do início',
  });

type Formulario = z.input<typeof esquema>;

export interface CorpoCliente {
  tipo: TipoCliente;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual: string;
  contato_nome: string;
  contato_email: string;
  contato_telefone: string;
  endereco: string;
  cidade: string;
  uf: string;
  numero_contrato: string;
  /** null quando vazio: o backend nao aceita string vazia como data. */
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  condicao_pagamento: string;
  observacoes: string;
  ativo: boolean;
}

export interface FormularioClienteProps {
  inicial?: Cliente;
  ocupado: boolean;
  /** Mensagem da API que nao aponta para um campo (regra de dominio, 409). */
  erroGeral: string | null;
  /** Erros por campo vindos do `detalhes` do 400. */
  errosPorCampo: Record<string, string>;
  aoEnviar: (corpo: CorpoCliente) => void;
  aoCancelar: () => void;
}

const SITUACAO = [
  { valor: 'true', rotulo: 'Ativo' },
  { valor: 'false', rotulo: 'Inativo' },
];

export function FormularioCliente({
  inicial,
  ocupado,
  erroGeral,
  errosPorCampo,
  aoEnviar,
  aoCancelar,
}: FormularioClienteProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      // Sem tipo pre-escolhido: um padrao silencioso viraria dado errado.
      tipo: inicial?.tipo ?? ('' as TipoCliente),
      razao_social: inicial?.razao_social ?? '',
      nome_fantasia: inicial?.nome_fantasia ?? '',
      cnpj: inicial?.cnpj ?? '',
      inscricao_estadual: inicial?.inscricao_estadual ?? '',
      contato_nome: inicial?.contato_nome ?? '',
      contato_email: inicial?.contato_email ?? '',
      contato_telefone: inicial?.contato_telefone ?? '',
      endereco: inicial?.endereco ?? '',
      cidade: inicial?.cidade ?? '',
      uf: inicial?.uf ?? '',
      numero_contrato: inicial?.numero_contrato ?? '',
      vigencia_inicio: inicial?.vigencia_inicio?.slice(0, 10) ?? '',
      vigencia_fim: inicial?.vigencia_fim?.slice(0, 10) ?? '',
      condicao_pagamento: inicial?.condicao_pagamento ?? '',
      observacoes: inicial?.observacoes ?? '',
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
          tipo: valores.tipo,
          razao_social: valores.razao_social,
          nome_fantasia: valores.nome_fantasia ?? '',
          cnpj: valores.cnpj,
          inscricao_estadual: valores.inscricao_estadual ?? '',
          contato_nome: valores.contato_nome ?? '',
          contato_email: valores.contato_email ?? '',
          contato_telefone: valores.contato_telefone ?? '',
          endereco: valores.endereco ?? '',
          cidade: valores.cidade ?? '',
          uf: valores.uf ?? '',
          numero_contrato: valores.numero_contrato ?? '',
          vigencia_inicio: valores.vigencia_inicio || null,
          vigencia_fim: valores.vigencia_fim || null,
          condicao_pagamento: valores.condicao_pagamento ?? '',
          observacoes: valores.observacoes ?? '',
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

      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <Selecao
          rotulo="Tipo"
          obrigatorio
          placeholder="Selecione"
          opcoes={OPCOES_TIPO_CLIENTE}
          erro={erroDe('tipo')}
          {...register('tipo')}
        />
        <Campo rotulo="Razão social" obrigatorio erro={erroDe('razao_social')} {...register('razao_social')} />
      </div>

      <Campo rotulo="Nome fantasia" erro={erroDe('nome_fantasia')} {...register('nome_fantasia')} />

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
          rotulo="Inscrição estadual"
          tipoDado="codigo"
          erro={erroDe('inscricao_estadual')}
          {...register('inscricao_estadual')}
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

      <div className="grid gap-4 md:grid-cols-[1fr_120px]">
        <Campo rotulo="Cidade" erro={erroDe('cidade')} {...register('cidade')} />
        <Selecao rotulo="UF" placeholder="—" opcoes={OPCOES_UF} erro={erroDe('uf')} {...register('uf')} />
      </div>

      <Campo
        rotulo="Nº do contrato"
        tipoDado="codigo"
        ajuda="Contrato ou ata de registro de preços"
        erro={erroDe('numero_contrato')}
        {...register('numero_contrato')}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Campo rotulo="Início da vigência" type="date" erro={erroDe('vigencia_inicio')} {...register('vigencia_inicio')} />
        <Campo rotulo="Fim da vigência" type="date" erro={erroDe('vigencia_fim')} {...register('vigencia_fim')} />
      </div>

      <Campo rotulo="Observações" erro={erroDe('observacoes')} {...register('observacoes')} />

      {inicial && (
        // So faz sentido escolher a situacao ao editar: e a unica forma de
        // reativar um cliente. Ao criar, o registro sempre nasce ativo.
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
