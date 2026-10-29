import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { useToasts } from '@/componentes/ui/Toast';
import { marcar, t, td } from '@/i18n';
import { separarErro } from '@/lib/errosDeFormulario';
import {
  atualizarConfiguracaoSMTP,
  buscarConfiguracaoSMTP,
  chaveConfiguracaoSMTP,
  enviarEmailDeTeste,
} from '@/servicos/email';
import type { ConfiguracaoSMTP, CorpoAtualizarSMTP } from '@/tipos/email';
import { PERMISSOES, usePode } from '@/lib/permissoes';

const opcoesHabilitado = () => [
  { valor: 'true', rotulo: t('Habilitado — o sistema pode enviar e-mails') },
  { valor: 'false', rotulo: t('Desabilitado') },
];

const opcoesCriptografia = () => [
  { valor: 'STARTTLS', rotulo: t('STARTTLS (normalmente porta 587)') },
  { valor: 'TLS', rotulo: t('TLS/SSL (normalmente porta 465)') },
  { valor: 'NENHUMA', rotulo: t('Nenhuma — só servidor interno, sem usuário e senha') },
];

const CLASSE_AVISO =
  'rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending';

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Forma; o domínio (email.Dados.Validar) continua sendo a autoridade. */
const esquema = z
  .object({
    habilitado: z.enum(['true', 'false']),
    host: z.string().trim(),
    porta: z.coerce
      .number({ invalid_type_error: marcar('Informe a porta') })
      .int(marcar('Use um número inteiro'))
      .min(1, marcar('Porta entre 1 e 65535'))
      .max(65535, marcar('Porta entre 1 e 65535')),
    criptografia: z.enum(['NENHUMA', 'STARTTLS', 'TLS']),
    usuario: z.string().trim(),
    senha: z.string(),
    remetente_email: z.string().trim(),
    remetente_nome: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.remetente_email !== '' && !EMAIL.test(v.remetente_email)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['remetente_email'], message: marcar('Informe um e-mail válido') });
    }
    if (v.criptografia === 'NENHUMA' && (v.usuario !== '' || v.senha !== '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['usuario'],
        message: marcar('Usuário e senha exigem STARTTLS ou TLS'),
      });
    }
    if (v.habilitado === 'true') {
      if (v.host === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['host'], message: marcar('Informe o servidor para habilitar o envio') });
      }
      if (v.remetente_email === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['remetente_email'], message: marcar('Informe o e-mail do remetente') });
      }
    }
  });

type Formulario = z.infer<typeof esquema>;

function paraFormulario(cfg: ConfiguracaoSMTP): Formulario {
  return {
    habilitado: cfg.habilitado ? 'true' : 'false',
    host: cfg.host,
    porta: cfg.porta,
    criptografia: cfg.criptografia,
    usuario: cfg.usuario,
    senha: '',
    remetente_email: cfg.remetente_email,
    remetente_nome: cfg.remetente_nome,
  };
}

function paraCorpo(v: Formulario, removerSenha: boolean): CorpoAtualizarSMTP {
  return {
    habilitado: v.habilitado === 'true',
    host: v.host,
    porta: v.porta,
    criptografia: v.criptografia,
    usuario: v.usuario,
    senha: removerSenha ? '' : v.senha,
    remover_senha: removerSenha,
    remetente_email: v.remetente_email,
    remetente_nome: v.remetente_nome,
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

function FormularioSMTP({ atual }: { atual: ConfiguracaoSMTP }) {
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Formulario>({ resolver: zodResolver(esquema), defaultValues: paraFormulario(atual) });

  const [confirmandoRemocao, definirConfirmandoRemocao] = useState(false);

  const mutacao = useMutation({
    mutationFn: atualizarConfiguracaoSMTP,
    onSuccess: (salva, corpo) => {
      queryClient.setQueryData(chaveConfiguracaoSMTP, salva);
      // A senha digitada nunca fica no formulario depois de gravada.
      setValue('senha', '');
      mostrarToast(corpo.remover_senha ? t('Senha removida') : t('Servidor de e-mail salvo'));
    },
    onError: (erro) => {
      mostrarToast(separarErro(erro).geral ?? t('Não foi possível salvar o servidor de e-mail.'), 'pending');
    },
    // O corpo enviado (com a senha) fica em mutacao.variables ate o fim do
    // gcTime -- e visivel no Devtools do React Query. Limpar ao terminar.
    onSettled: () => {
      definirConfirmandoRemocao(false);
      mutacao.reset();
    },
  });

  return (
    <form
      aria-label={t('Servidor de e-mail')}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((v) => mutacao.mutate(paraCorpo(v, false)))}
    >
      <Selecao rotulo={t('Envio de e-mail')} opcoes={opcoesHabilitado()} {...register('habilitado')} />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Campo
          rotulo={t('Servidor (host)')}
          placeholder="smtp.empresa.com.br"
          autoComplete="off"
          erro={td(errors.host?.message) || undefined}
          {...register('host')}
        />
        <Campo rotulo={t('Porta')} type="number" min={1} max={65535} erro={td(errors.porta?.message) || undefined} {...register('porta')} />
      </div>
      <Selecao rotulo={t('Criptografia')} opcoes={opcoesCriptografia()} {...register('criptografia')} />
      <Campo
        rotulo={t('Usuário')}
        autoComplete="off"
        ajuda={t('Deixe em branco se o servidor não exige autenticação.')}
        erro={td(errors.usuario?.message) || undefined}
        {...register('usuario')}
      />
      <Campo
        rotulo={t('Senha')}
        type="password"
        autoComplete="new-password"
        ajuda={
          atual.senha_definida
            ? t('Já existe uma senha gravada (cifrada). Deixe em branco para mantê-la — ao trocar servidor, porta ou usuário, digite-a de novo.')
            : t('Gravada cifrada no servidor e nunca exibida de novo.')
        }
        {...register('senha')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo={t('E-mail do remetente')}
          type="email"
          placeholder="pcp@empresa.com.br"
          erro={td(errors.remetente_email?.message) || undefined}
          {...register('remetente_email')}
        />
        <Campo rotulo={t('Nome do remetente')} placeholder="Sistema PCP" {...register('remetente_nome')} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" ocupado={mutacao.isPending} rotuloOcupado={t('Salvando…')}>
          {t('Salvar')}
        </Botao>
        {atual.senha_definida && (
          <Botao
            type="button"
            variante="secundaria"
            disabled={mutacao.isPending}
            onClick={() => definirConfirmandoRemocao(true)}
          >
            {t('Remover senha gravada')}
          </Botao>
        )}
      </div>

      {/* Remove a partir do que esta GRAVADO, nao do formulario: nao depende
          de o formulario estar valido e nao salva junto edicoes pela metade. */}
      <Confirmacao
        aberto={confirmandoRemocao}
        titulo={t('Remover senha gravada')}
        mensagem={t('O servidor de e-mail passa a ser usado sem senha. Continuar?')}
        rotuloConfirmar={t('Remover senha')}
        rotuloOcupado={t('Removendo…')}
        ocupado={mutacao.isPending}
        aoConfirmar={() => mutacao.mutate(paraCorpo(paraFormulario(atual), true))}
        aoCancelar={() => definirConfirmandoRemocao(false)}
      />
    </form>
  );
}

function EnvioDeTeste() {
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const [destinatario, definirDestinatario] = useState('');
  const [erro, definirErro] = useState<string | undefined>();

  const mutacao = useMutation({
    mutationFn: enviarEmailDeTeste,
    onSuccess: () => mostrarToast(t('E-mail de teste enviado para {destinatario}', { destinatario: destinatario.trim() })),
    onError: (e) => mostrarToast(separarErro(e).geral ?? t('Não foi possível enviar o e-mail de teste.'), 'pending'),
  });

  return (
    <form
      aria-label={t('Enviar e-mail de teste')}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (!EMAIL.test(destinatario.trim())) {
          definirErro(t('Informe um e-mail válido'));
          return;
        }
        definirErro(undefined);
        mutacao.mutate(destinatario.trim());
      }}
    >
      <Campo
        rotulo={t('Enviar para')}
        type="email"
        placeholder="voce@empresa.com.br"
        value={destinatario}
        erro={erro}
        onChange={(evento) => definirDestinatario(evento.target.value)}
      />
      <div>
        <Botao type="submit" variante="secundaria" icone="mail" ocupado={mutacao.isPending} rotuloOcupado={t('Enviando…')}>
          {t('Enviar e-mail de teste')}
        </Botao>
      </div>
    </form>
  );
}

export function Integracoes() {
  const autorizado = usePode(PERMISSOES.configIntegracoes);
  const consulta = useQuery({
    queryKey: chaveConfiguracaoSMTP,
    queryFn: buscarConfiguracaoSMTP,
    enabled: autorizado,
    // O PUT grava a configuracao inteira: sempre editar sobre o valor atual.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  let conteudo: ReactNode;
  if (!autorizado) {
    conteudo = (
      <p role="alert" className={CLASSE_AVISO}>
        {t('Acesso restrito: seu perfil não tem permissão para esta tela.')}
      </p>
    );
  } else if (consulta.isPending || (!consulta.isError && !consulta.isFetchedAfterMount)) {
    conteudo = <p className="text-body text-texto-secondary">{t('Carregando integrações…')}</p>;
  } else if (consulta.isError) {
    conteudo = (
      <p role="alert" className={CLASSE_AVISO}>
        {t('Não foi possível carregar a configuração do servidor de e-mail. Recarregue a página para tentar de novo.')}
      </p>
    );
  } else {
    conteudo = (
      <>
        <Secao
          titulo={t('Servidor de e-mail (SMTP)')}
          descricao={t('Usado pelo sistema para enviar e-mails. A senha é gravada cifrada e nunca exibida.')}
        >
          <FormularioSMTP atual={consulta.data} />
        </Secao>
        <Secao
          titulo={t('Testar envio')}
          descricao={t('Usa a configuração salva — salve as alterações antes de testar.')}
        >
          <EnvioDeTeste />
        </Secao>
      </>
    );
  }

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Integrações')}</h1>
        <p className="text-body text-texto-secondary">{t('Serviços externos usados pelo sistema.')}</p>
      </div>
      {conteudo}
    </div>
  );
}
