import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Selecao, type OpcaoSelecao } from '@/componentes/ui/Selecao';
import { marcar, t, td } from '@/i18n';
import { gerarSenhaTemporaria } from '@/servicos/usuarios';
import type { CorpoUsuario, Usuario } from '@/tipos/usuarios';

const esquema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,50}$/, marcar('De 3 a 50 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado')),
  nome: z.string().trim().min(1, marcar('Informe o nome')).max(100, marcar('Até 100 caracteres')),
  email: z.string().trim().email(marcar('Informe um e-mail válido')).max(100, marcar('Até 100 caracteres')),
  perfil: z.string().min(1, marcar('Escolha o perfil')),
  matricula: z.string().trim().max(30, marcar('Até 30 caracteres')),
  telefone: z.string().trim().max(30, marcar('Até 30 caracteres')),
  setor: z.string().trim().max(60, marcar('Até 60 caracteres')),
  data_admissao: z.string(),
  senha_temporaria: z.string(),
});

type Formulario = z.infer<typeof esquema>;

export interface FormularioUsuarioProps {
  inicial?: Usuario;
  perfis: OpcaoSelecao[];
  ocupado: boolean;
  erroGeral: string | null;
  errosPorCampo: Record<string, string>;
  aoEnviar: (corpo: CorpoUsuario) => void;
  aoCancelar: () => void;
}

/** Cadastro de usuario. O login nao muda depois de criado (e a identidade na auditoria). */
export function FormularioUsuario({ inicial, perfis, ocupado, erroGeral, errosPorCampo, aoEnviar, aoCancelar }: FormularioUsuarioProps) {
  const novo = !inicial;
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(
      novo
        ? esquema.refine((d) => d.senha_temporaria.length >= 10, {
            path: ['senha_temporaria'],
            message: marcar('A senha temporária deve ter ao menos 10 caracteres'),
          })
        : esquema,
    ),
    defaultValues: {
      username: inicial?.username ?? '',
      nome: inicial?.nome ?? '',
      email: inicial?.email ?? '',
      perfil: inicial?.perfil ?? '',
      matricula: inicial?.matricula ?? '',
      telefone: inicial?.telefone ?? '',
      setor: inicial?.setor ?? '',
      data_admissao: inicial?.data_admissao ?? '',
      senha_temporaria: novo ? gerarSenhaTemporaria() : '',
    },
  });

  useEffect(() => {
    for (const [campo, mensagem] of Object.entries(errosPorCampo)) {
      setError(campo as keyof Formulario, { message: mensagem });
    }
  }, [errosPorCampo, setError]);

  function enviar(d: Formulario) {
    aoEnviar({
      ...(novo ? { username: d.username, senha_temporaria: d.senha_temporaria } : {}),
      nome: d.nome,
      email: d.email,
      perfil: d.perfil,
      matricula: d.matricula || null,
      telefone: d.telefone,
      setor: d.setor,
      data_admissao: d.data_admissao || null,
    });
  }

  return (
    <form noValidate aria-label={novo ? t('Novo usuário') : t('Editar usuário')} className="flex flex-col gap-4" onSubmit={handleSubmit(enviar)}>
      {erroGeral && (
        <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
          {erroGeral}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo={t('Usuário (login)')}
          obrigatorio
          tipoDado="codigo"
          disabled={!novo}
          ajuda={novo ? t('Não muda depois. Ex.: maria.souza') : t('O login não muda.')}
          autoComplete="off"
          erro={td(errors.username?.message) || undefined}
          {...register('username')}
        />
        <Campo rotulo={t('Nome completo')} obrigatorio erro={td(errors.nome?.message) || undefined} {...register('nome')} />
        <Campo rotulo={t('E-mail')} obrigatorio type="email" erro={td(errors.email?.message) || undefined} {...register('email')} />
        <Selecao
          rotulo={t('Perfil')}
          obrigatorio
          placeholder={t('Escolha o perfil')}
          opcoes={perfis}
          erro={td(errors.perfil?.message) || undefined}
          {...register('perfil')}
        />
        <Campo rotulo={t('Matrícula')} tipoDado="codigo" erro={td(errors.matricula?.message) || undefined} {...register('matricula')} />
        <Campo rotulo={t('Telefone')} type="tel" erro={td(errors.telefone?.message) || undefined} {...register('telefone')} />
        <Campo rotulo={t('Setor')} erro={td(errors.setor?.message) || undefined} {...register('setor')} />
        <Campo rotulo={t('Data de admissão')} type="date" erro={td(errors.data_admissao?.message) || undefined} {...register('data_admissao')} />
      </div>

      {novo && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Campo
              rotulo={t('Senha temporária')}
              obrigatorio
              tipoDado="codigo"
              autoComplete="off"
              ajuda={t('Entregue ao usuário: ele cria a própria senha no primeiro acesso.')}
              erro={td(errors.senha_temporaria?.message) || undefined}
              {...register('senha_temporaria')}
            />
          </div>
          <Botao type="button" variante="secundaria" icone="refresh-cw" className="mb-6" onClick={() => setValue('senha_temporaria', gerarSenhaTemporaria())}>
            {t('Gerar outra')}
          </Botao>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Botao type="button" variante="secundaria" onClick={aoCancelar}>
          {t('Cancelar')}
        </Botao>
        <Botao type="submit" icone="save" ocupado={ocupado} rotuloOcupado="Salvando…">
          {novo ? t('Cadastrar usuário') : t('Salvar')}
        </Botao>
      </div>
    </form>
  );
}
