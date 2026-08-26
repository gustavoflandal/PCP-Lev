import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useInatividade } from '@/hooks/useInatividade';
import { useAutenticacao } from '@/store/autenticacao';

/**
 * Porta de entrada das telas internas: exige sessao e aplica o encerramento
 * por inatividade do RNF3.
 */
export function RotaProtegida() {
  const autenticado = useAutenticacao((estado) => estado.autenticado);
  const sair = useAutenticacao((estado) => estado.sair);
  const local = useLocation();

  useInatividade(() => sair('inatividade'), autenticado);

  if (!autenticado) {
    // `state` guarda o destino para voltar a ele depois do login.
    return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  }

  return <Outlet />;
}
