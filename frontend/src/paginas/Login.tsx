import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { icones } from '@/componentes/ui/icones';
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
};

export function Login() {
  const entrar = useAutenticacao((estado) => estado.entrar);
  const autenticado = useAutenticacao((estado) => estado.autenticado);
  const motivoSaida = useAutenticacao((estado) => estado.motivoSaida);
  const [senhaVisivel, setSenhaVisivel] = useState(false);

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
    <main className="flex min-h-screen items-center justify-center bg-surface-base p-6">
      <div className="w-full max-w-[400px]">
        <header className="mb-6">
          <h1 className="text-display text-texto-primary">Sistema PCP</h1>
          <p className="text-body text-texto-secondary">
            Planejamento e controle da produção
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
          className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6"
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
      </div>
    </main>
  );
}
