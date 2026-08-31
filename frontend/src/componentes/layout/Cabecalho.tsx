import { useNavigate } from 'react-router-dom';
import { Botao } from '@/componentes/ui/Botao';
import { icones } from '@/componentes/ui/icones';
import { useLogoEmpresa } from '@/hooks/useLogoEmpresa';
import { useAutenticacao, type Perfil } from '@/store/autenticacao';
import { Ajuda } from './Ajuda';

/** Rotulo de exibicao do perfil — sentence case, conforme §7 do design. */
const ROTULO_PERFIL: Record<Perfil, string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  OPERADOR: 'Operador',
};

export function Cabecalho() {
  const usuario = useAutenticacao((estado) => estado.usuario);
  const sair = useAutenticacao((estado) => estado.sair);
  const navegar = useNavigate();
  const IconeFabrica = icones.factory;

  const { temLogo, url: urlLogo, nomeExibido } = useLogoEmpresa();

  return (
    <header className="flex h-[3.5rem] items-center justify-between gap-4 border-b border-borda-subtle bg-surface-raised px-4">
      <div className="flex items-center gap-2">
        {temLogo ? (
          <img src={urlLogo} alt="" className="h-8 w-auto" />
        ) : (
          <IconeFabrica size={20} aria-hidden="true" className="text-brand" />
        )}
        <span className="text-subtitle text-texto-primary">{nomeExibido}</span>
      </div>

      <div className="flex items-center gap-4">
        {usuario && (
          <div className="text-right">
            <p className="text-body text-texto-primary">{usuario.nome}</p>
            <p className="text-label text-texto-secondary">{ROTULO_PERFIL[usuario.perfil]}</p>
          </div>
        )}
        <Botao variante="secundaria" icone="settings" onClick={() => navegar('/preferencias')}>
          Preferências
        </Botao>
        <Ajuda />
        <Botao variante="secundaria" icone="log-out" onClick={() => sair()}>
          Sair
        </Botao>
      </div>
    </header>
  );
}
