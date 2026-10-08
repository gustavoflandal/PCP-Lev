import { cn } from '@/lib/cn';
import { icones } from './icones';

export type EstadoEtapa = 'concluida' | 'pendente-acionavel' | 'pendente-futura' | 'bloqueada';

export interface Etapa {
  chave: string;
  nome: string;
  estado: EstadoEtapa;
  /** "HH:MM" ou data — so faz sentido para etapas concluidas. */
  timestamp?: string;
  /** Nome de quem executou — so para etapas concluidas. */
  executante?: string;
  /** Chamado ao acionar a etapa. Ignorado em pendente-futura (inerte). */
  aoAcionar?: () => void;
}

export interface TrilhaEtapasProps {
  /** Nome acessivel da trilha inteira. */
  rotulo: string;
  etapas: Etapa[];
}

/**
 * Assinatura visual do sistema (design system §5): serve cotacao, pedido de
 * compra e, mais adiante, ordem de producao/kanban — sem variacao por tipo.
 */
export function TrilhaEtapas({ rotulo, etapas }: TrilhaEtapasProps) {
  return (
    <ol role="list" aria-label={rotulo} className="flex flex-col gap-3 md:flex-row md:gap-4">
      {etapas.map((etapa) => (
        <li
          key={etapa.chave}
          role="listitem"
          aria-disabled={etapa.estado === 'pendente-futura' ? true : undefined}
          className="flex-1"
        >
          <ItemEtapa etapa={etapa} />
        </li>
      ))}
    </ol>
  );
}

function ItemEtapa({ etapa }: { etapa: Etapa }) {
  const conteudo = <ConteudoEtapa etapa={etapa} />;
  // Pendente-acionavel e sempre a etapa clicavel por definicao (e o proximo
  // passo da operacao); concluida/bloqueada so viram botao quando o
  // consumidor oferece uma consulta (aoAcionar); pendente-futura nunca.
  const clicavel =
    etapa.estado === 'pendente-acionavel' || (etapa.aoAcionar && etapa.estado !== 'pendente-futura');

  const classeBase = cn(
    'flex w-full flex-col gap-1 rounded-cartao border px-3 py-2 text-left',
    corDoEstado(etapa.estado),
  );

  if (!clicavel) {
    return <div className={classeBase}>{conteudo}</div>;
  }

  return (
    <button
      type="button"
      onClick={etapa.aoAcionar}
      aria-current={etapa.estado === 'pendente-acionavel' ? 'step' : undefined}
      className={cn(classeBase, 'hover:brightness-95')}
    >
      {conteudo}
    </button>
  );
}

function corDoEstado(estado: EstadoEtapa): string {
  switch (estado) {
    case 'concluida':
      return 'border-borda-subtle bg-estado-done-bg text-estado-done';
    case 'pendente-acionavel':
      return 'border-2 border-estado-pending bg-estado-pending-bg text-estado-pending';
    case 'pendente-futura':
      return 'border-borda-subtle bg-estado-pending-bg text-estado-pending opacity-45';
    case 'bloqueada':
      return 'border-borda-subtle bg-estado-blocked-bg text-estado-blocked';
  }
}

const ICONE_DO_ESTADO = {
  concluida: 'check-circle-2',
  'pendente-acionavel': 'circle-dot',
  'pendente-futura': 'circle',
  bloqueada: 'shield-alert',
} as const;

function rotuloDoEstado(etapa: Etapa): string {
  switch (etapa.estado) {
    case 'concluida':
      return etapa.timestamp ? `Concluída · ${etapa.timestamp}` : 'Concluída';
    case 'pendente-acionavel':
      return 'Pendente · iniciar';
    case 'pendente-futura':
      return 'Aguardando etapa anterior';
    case 'bloqueada':
      return 'Bloqueada · aguardando aprovação';
  }
}

function ConteudoEtapa({ etapa }: { etapa: Etapa }) {
  const Icone = icones[ICONE_DO_ESTADO[etapa.estado]];

  return (
    <>
      <span className="flex items-center gap-2 text-body font-medium">
        <Icone size={16} aria-hidden="true" className="shrink-0" />
        {etapa.nome}
      </span>
      <span className="text-label">{rotuloDoEstado(etapa)}</span>
      {etapa.estado === 'concluida' && etapa.executante && (
        <span className="text-label text-texto-secondary">{etapa.executante}</span>
      )}
    </>
  );
}
