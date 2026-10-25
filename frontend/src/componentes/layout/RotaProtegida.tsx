import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useInatividade } from '@/hooks/useInatividade';
import { useAutenticacao } from '@/store/autenticacao';
import { useModoTV } from '@/store/modoTV';

/** Unica tela liberada enquanto a troca de senha estiver pendente. */
export const ROTA_TROCAR_SENHA = '/trocar-senha';

/**
 * Porta de entrada das telas internas: exige sessao, aplica o encerramento
 * por inatividade do RNF3 (suspenso no modo TV dos paineis) e, com senha inicial ou redefinida pelo
 * Administrador, leva a troca antes de qualquer outra tela.
 */
export function RotaProtegida() {
  const autenticado = useAutenticacao((estado) => estado.autenticado);
  const sair = useAutenticacao((estado) => estado.sair);
  const deveTrocarSenha = useAutenticacao((estado) => estado.usuario?.deve_trocar_senha ?? false);
  const local = useLocation();

  // Modo TV: painel em exibicao continua, sem ninguem tocar na tela, nao
  // derruba a sessao enquanto a aba estiver visivel.
  const modoTV = useModoTV((estado) => estado.ativo);

  useInatividade(() => sair('inatividade'), autenticado, modoTV);

  if (!autenticado) {
    // `state` guarda o destino para voltar a ele depois do login.
    return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  }

  if (deveTrocarSenha && local.pathname !== ROTA_TROCAR_SENHA) {
    return <Navigate to={ROTA_TROCAR_SENHA} replace />;
  }

  return <Outlet />;
}
