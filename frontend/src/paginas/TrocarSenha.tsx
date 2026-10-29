import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { icones } from '@/componentes/ui/icones';
import { t } from '@/i18n';
import { separarErro } from '@/lib/errosDeFormulario';
import { trocarSenha } from '@/servicos/autenticacaoServico';
import { useAutenticacao } from '@/store/autenticacao';

// Funcao (nao constante): as mensagens saem no idioma vigente na renderizacao.
const criarEsquema = () =>
  z
    .object({
      senha_atual: z.string().min(1, t('Informe a senha atual')),
      nova_senha: z.string().min(10, t('A nova senha deve ter ao menos 10 caracteres')),
      confirmacao: z.string(),
    })
    .refine((d) => d.nova_senha === d.confirmacao, { path: ['confirmacao'], message: t('Repita exatamente a nova senha') })
    .refine((d) => d.nova_senha !== d.senha_atual, { path: ['nova_senha'], message: t('Escolha uma senha diferente da atual') });

type Formulario = z.infer<ReturnType<typeof criarEsquema>>;

/**
 * Troca da propria senha. Fora do Shell de proposito: com a troca
 * obrigatoria pendente (senha inicial ou redefinida pelo Administrador) a
 * API recusa todo o resto, entao a tela nao pode depender de menu, painel
 * nem configuracoes carregadas.
 */
export function TrocarSenha() {
  const usuario = useAutenticacao((estado) => estado.usuario);
  const definirTrocaDeSenha = useAutenticacao((estado) => estado.definirTrocaDeSenha);
  const renovarToken = useAutenticacao((estado) => estado.renovarToken);
  const sair = useAutenticacao((estado) => estado.sair);
  const queryClient = useQueryClient();
  const navegar = useNavigate();
  const obrigatoria = usuario?.deve_trocar_senha ?? false;

  const esquema = useMemo(criarEsquema, []);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { senha_atual: '', nova_senha: '', confirmacao: '' },
  });

  const troca = useMutation({
    mutationFn: (dados: Formulario) => trocarSenha({ senha_atual: dados.senha_atual, nova_senha: dados.nova_senha }),
    onSuccess: (token) => {
      renovarToken(token);
      definirTrocaDeSenha(false);
      // Com a troca pendente, /auth/eu trouxe a sessao sem permissoes e com
      // deve_trocar_senha: descarta (nao so invalida) -- o Shell, ao montar,
      // reaplicaria o dado antigo e mandaria de volta para esta tela.
      queryClient.removeQueries({ queryKey: ['auth', 'eu'] });
      navegar('/', { replace: true });
    },
  });

  const erro = troca.error ? (separarErro(troca.error).geral ?? t('Não foi possível trocar a senha.')) : null;
  const AlertaIcone = icones['alert-triangle'];

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base p-6">
      <div className="w-full max-w-[420px]">
        <header className="mb-6">
          <h1 className="text-title text-texto-primary">{obrigatoria ? t('Crie a sua senha') : t('Alterar senha')}</h1>
          <p className="text-body text-texto-secondary">
            {obrigatoria
              ? t('Olá, {nome}. A senha que você recebeu é temporária: escolha uma senha só sua para continuar.', { nome: usuario?.nome ?? '' })
              : t('Informe a senha atual e escolha a nova.')}
          </p>
        </header>

        <form
          noValidate
          aria-label={t('Trocar senha')}
          onSubmit={handleSubmit((dados) => troca.mutate(dados))}
          className="flex flex-col gap-4 rounded-cartao border border-borda-subtle bg-surface-raised p-6"
        >
          <Campo
            rotulo={obrigatoria ? t('Senha temporária') : t('Senha atual')}
            type="password"
            autoComplete="current-password"
            autoFocus
            erro={errors.senha_atual?.message}
            {...register('senha_atual')}
          />
          <Campo
            rotulo={t('Nova senha')}
            type="password"
            autoComplete="new-password"
            ajuda={t('Ao menos 10 caracteres, sem o seu login e fora das senhas óbvias (1234567890, senha12345…).')}
            erro={errors.nova_senha?.message}
            {...register('nova_senha')}
          />
          <Campo
            rotulo={t('Repita a nova senha')}
            type="password"
            autoComplete="new-password"
            erro={errors.confirmacao?.message}
            {...register('confirmacao')}
          />

          {erro && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-label text-estado-pending"
            >
              <AlertaIcone size={16} aria-hidden="true" className="mt-px shrink-0" />
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2">
            {obrigatoria ? (
              <Botao type="button" variante="secundaria" icone="log-out" onClick={() => sair()}>
                {t('Sair')}
              </Botao>
            ) : (
              <Botao type="button" variante="secundaria" onClick={() => navegar(-1)}>
                {t('Cancelar')}
              </Botao>
            )}
            <Botao type="submit" icone="save" ocupado={troca.isPending} rotuloOcupado={t('Salvando…')}>
              {t('Salvar nova senha')}
            </Botao>
          </div>
        </form>
      </div>
    </main>
  );
}
