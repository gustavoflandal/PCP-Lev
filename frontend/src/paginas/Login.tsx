import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Ajuda } from '@/componentes/layout/Ajuda';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { LogoFabrica } from '@/componentes/marca/LogoFabrica';
import { icones } from '@/componentes/ui/icones';
import { useLogoEmpresa } from '@/hooks/useLogoEmpresa';
import { ErroApi } from '@/servicos/api';
import { autenticar } from '@/servicos/autenticacaoServico';
import { MINUTOS_INATIVIDADE } from '@/hooks/useInatividade';
import { useAutenticacao, type MotivoSaida } from '@/store/autenticacao';

const esquema = z.object({
  username: z.string().trim().min(1, 'Informe o usuário'),
  password: z.string().min(1, 'Informe a senha'),
});

type Formulario = z.infer<typeof esquema>;

/** Explica ao usuario por que ele voltou para esta tela. */
const AVISO_POR_MOTIVO: Record<Exclude<MotivoSaida, null>, string> = {
  inatividade: `Sessão encerrada após ${MINUTOS_INATIVIDADE} minutos de inatividade. Entre novamente.`,
  expirada: 'Sua sessão expirou. Entre novamente para continuar.',
  desativado: 'Seu acesso foi bloqueado ou desativado. Procure o administrador do sistema.',
  encerrada: 'Sua sessão foi encerrada porque a senha foi alterada ou o acesso foi revisto pelo administrador. Entre novamente.',
};

export function Login() {
  const entrar = useAutenticacao((estado) => estado.entrar);
  const autenticado = useAutenticacao((estado) => estado.autenticado);
  const motivoSaida = useAutenticacao((estado) => estado.motivoSaida);
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const { temLogo, url: urlLogo, nomeExibido } = useLogoEmpresa();

  const navegar = useNavigate();
  const local = useLocation();
  // RotaProtegida guarda em `state.de` a tela que o usuario tentou abrir.
  const destino = (local.state as { de?: string } | null)?.de ?? '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { username: '', password: '' },
  });

  const login = useMutation({
    mutationFn: autenticar,
    onSuccess: (resposta) => {
      entrar(resposta);
      // `replace` evita que o botao voltar do navegador retorne ao login.
      navegar(destino, { replace: true });
    },
  });

  const mensagemDeErro =
    login.error instanceof ErroApi
      ? login.error.message
      : login.error
        ? 'Não foi possível entrar. Tente novamente.'
        : null;

  // Sessao ja aberta (aba duplicada, ou volta ao /login pelo historico):
  // nao faz sentido pedir credencial de novo.
  if (autenticado) {
    return <Navigate to={destino} replace />;
  }

  const OlhoIcone = senhaVisivel ? icones['eye-off'] : icones.eye;
  const AlertaIcone = icones['alert-triangle'];

  return (
    <main className="min-h-screen bg-surface-base lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <PainelMarca />

      <section className="relative flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
        <div className="absolute right-4 top-4">
          <Ajuda />
        </div>

        <div className="w-full max-w-[400px]">
          <header className="mb-6">
            {/* Em tela estreita o painel some: a marca vem para o topo do formulario. */}
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <span className="flex h-12 w-12 items-center justify-center rounded-cartao bg-brand text-white">
                <LogoFabrica tamanho={26} />
              </span>
              <span className="text-subtitle text-texto-primary">PCP-Lev</span>
            </div>
            {temLogo && <img src={urlLogo} alt={nomeExibido} className="mb-4 h-10 w-auto" />}
            <h1 className="text-title text-texto-primary">Entrar</h1>
            <p className="text-body text-texto-secondary">
              {temLogo || nomeExibido === 'Sistema PCP'
                ? 'Use o usuário e a senha fornecidos pelo administrador.'
                : `${nomeExibido} · use o usuário e a senha fornecidos pelo administrador.`}
            </p>
          </header>

          {motivoSaida && (
            <p
              role="status"
              className="mb-4 rounded-campo border border-borda-subtle bg-estado-warning-bg px-3 py-2 text-label text-estado-warning"
            >
              {AVISO_POR_MOTIVO[motivoSaida]}
            </p>
          )}

          <form
            noValidate
            onSubmit={handleSubmit((dados) => login.mutate(dados))}
            className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6 shadow-elevado"
          >
            <Campo
              rotulo="Usuário"
              autoComplete="username"
              autoFocus
              erro={errors.username?.message}
              {...register('username')}
            />

            <div className="relative">
              <Campo
                rotulo="Senha"
                type={senhaVisivel ? 'text' : 'password'}
                autoComplete="current-password"
                className="pr-12"
                erro={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setSenhaVisivel((visivel) => !visivel)}
                aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-1 top-[22px] flex h-[40px] w-[40px] items-center justify-center rounded-campo text-texto-secondary hover:bg-surface-sunken"
              >
                <OlhoIcone size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Erro de API em alerta persistente, com a mensagem legivel do doc 3. */}
            {mensagemDeErro && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-label text-estado-pending"
              >
                <AlertaIcone size={16} aria-hidden="true" className="mt-px shrink-0" />
                {mensagemDeErro}
              </p>
            )}

            <Botao
              type="submit"
              icone="log-in"
              ocupado={login.isPending}
              rotuloOcupado="Entrando…"
              className="w-full"
            >
              Entrar
            </Botao>
          </form>

          <p className="mt-6 text-center text-label text-texto-secondary">
            Esqueceu a senha ou a conta foi bloqueada? Procure o administrador do sistema.
          </p>
        </div>
      </section>
    </main>
  );
}

/** Etapas do fluxo que o sistema acompanha -- a trilha e a assinatura visual do produto. */
const ETAPAS_DA_MARCA = [
  { icone: 'shopping-cart', rotulo: 'Compra' },
  { icone: 'file-input', rotulo: 'Recebimento' },
  { icone: 'factory', rotulo: 'Produção' },
  { icone: 'package-check', rotulo: 'Expedição' },
] as const;

/**
 * Painel de identidade da tela de entrada (so em telas largas): azul
 * industrial com a silhueta da fabrica em marca d'agua e a trilha das
 * etapas que o sistema acompanha. Decorativo -- nada aqui e interativo.
 */
function PainelMarca() {
  return (
    <aside
      aria-label="PCP-Lev"
      className="painel-marca relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between"
    >
      {/* Fabrica em marca d'agua, sangrando pelo canto inferior direito. */}
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-[2rem] -right-[6rem] text-white/[0.05]">
        <LogoFabrica tamanho={560} />
      </div>

      <div className="relative flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-cartao bg-white/10 ring-1 ring-white/20">
          <LogoFabrica tamanho={28} />
        </span>
        <span className="flex flex-col">
          <span className="text-subtitle">PCP-Lev</span>
          <span className="text-label text-white/70">Planejamento e controle da produção</span>
        </span>
      </div>

      <div className="relative">
        <h2 className="max-w-lg text-[2.5rem] font-semibold leading-[1.1] tracking-tight">
          PCP-Lev - Sistema de controle de produção.
        </h2>
        <p className="mt-4 max-w-md text-body text-white/75">
          Pedidos, ordens de produção, estoque e rastreabilidade de cada série — num só lugar, para toda a
          fábrica.
        </p>

        <p className="mt-8 text-label text-white/70">
          Projeto e desenvolvimento: Gustavo Frederico Landal. E-mail:{' '}
          <a href="mailto:gustavoflandal@gmail.com" className="text-white underline-offset-2 hover:underline">
            gustavoflandal@gmail.com
          </a>
        </p>

        <ol aria-label="Etapas acompanhadas" className="mt-3 flex items-center">
          {ETAPAS_DA_MARCA.map((etapa, i) => {
            const Icone = icones[etapa.icone];
            return (
              <li key={etapa.rotulo} className="flex items-center">
                {i > 0 && <span aria-hidden="true" className="mx-2 h-px w-4 bg-white/30 xl:w-8" />}
                <span className="flex items-center gap-2 rounded-campo bg-white/[0.08] px-3 py-2 text-label ring-1 ring-white/15">
                  <Icone size={16} aria-hidden="true" />
                  {etapa.rotulo}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}
