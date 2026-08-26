import { Botao } from '@/componentes/ui/Botao';
import { icones } from '@/componentes/ui/icones';
import { useAutenticacao, type Perfil } from '@/store/autenticacao';

/** Rotulo de exibicao do perfil — sentence case, conforme §7 do design. */
const ROTULO_PERFIL: Record<Perfil, string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  OPERADOR: 'Operador',
};

export function Cabecalho() {
  const usuario = useAutenticacao((estado) => estado.usuario);
  const sair = useAutenticacao((estado) => estado.sair);
  const IconeFabrica = icones.factory;

  return (
    <header className="flex h-[56px] items-center justify-between gap-4 border-b border-borda-subtle bg-surface-raised px-4">
      <div className="flex items-center gap-2">
        <IconeFabrica size={20} aria-hidden="true" className="text-brand" />
        <span className="text-subtitle text-texto-primary">Sistema PCP</span>
      </div>

      <div className="flex items-center gap-4">
        {usuario && (
          <div className="text-right">
            <p className="text-body text-texto-primary">{usuario.nome}</p>
            <p className="text-label text-texto-secondary">{ROTULO_PERFIL[usuario.perfil]}</p>
          </div>
        )}
        <Botao variante="secundaria" icone="log-out" onClick={() => sair()}>
          Sair
        </Botao>
      </div>
    </header>
  );
}
