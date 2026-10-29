import { t, td } from '@/i18n';
import { Badge, type TomBadge } from '@/componentes/ui/Badge';
import type { NomeIcone } from '@/componentes/ui/icones';
import {
  ROTULO_ETAPA_OP,
  ROTULO_STATUS_OP,
  ROTULO_STATUS_PEDIDO_VENDA,
  ROTULO_STATUS_SERIE,
  type EtapaOP,
  type StatusOP,
  type StatusPedidoVenda,
  type StatusSerie,
} from '@/tipos/producao';

type Aparencia = { tom: TomBadge; icone: NomeIcone };

/**
 * Tons (design system §2): em andamento interno = "blocked" nao serve (nao
 * e espera de aprovacao); usamos neutral para o que ainda nao comecou,
 * warning para o que esta em curso e pede acompanhamento, done para o que
 * terminou bem e pending para reprovacao.
 */
const PEDIDO: Record<StatusPedidoVenda, Aparencia> = {
  Aberto: { tom: 'neutral', icone: 'circle' },
  'Em Producao': { tom: 'warning', icone: 'factory' },
  'Pronto para Envio': { tom: 'done', icone: 'package' },
  Entregue: { tom: 'done', icone: 'check-circle-2' },
  Cancelado: { tom: 'neutral', icone: 'x' },
};

const OP: Record<StatusOP, Aparencia> = {
  Aberta: { tom: 'neutral', icone: 'circle' },
  Liberada: { tom: 'warning', icone: 'factory' },
  Concluida: { tom: 'done', icone: 'check-circle-2' },
  Cancelada: { tom: 'neutral', icone: 'x' },
};

const SERIE: Record<StatusSerie, Aparencia> = {
  'Em Producao': { tom: 'neutral', icone: 'circle' },
  Aprovado: { tom: 'done', icone: 'check-circle-2' },
  Reprovado: { tom: 'pending', icone: 'alert-triangle' },
  'Em Estoque': { tom: 'done', icone: 'package' },
  Expedido: { tom: 'done', icone: 'check-circle-2' },
  Cancelado: { tom: 'neutral', icone: 'x' },
};

export function BadgeStatusPedidoVenda({ status }: { status: StatusPedidoVenda }) {
  const a = PEDIDO[status] ?? { tom: 'neutral', icone: 'circle' };
  return (
    <Badge tom={a.tom} icone={a.icone}>
      {td(ROTULO_STATUS_PEDIDO_VENDA[status] ?? status)}
    </Badge>
  );
}

export function BadgeStatusOP({ status }: { status: StatusOP }) {
  const a = OP[status] ?? { tom: 'neutral', icone: 'circle' };
  return (
    <Badge tom={a.tom} icone={a.icone}>
      {td(ROTULO_STATUS_OP[status] ?? status)}
    </Badge>
  );
}

export function BadgeStatusSerie({ status }: { status: StatusSerie }) {
  const a = SERIE[status] ?? { tom: 'neutral', icone: 'circle' };
  return (
    <Badge tom={a.tom} icone={a.icone}>
      {td(ROTULO_STATUS_SERIE[status] ?? status)}
    </Badge>
  );
}

/** Atraso e sempre warning (urgencia), nunca vermelho. */
export function SeloAtraso({ children }: { children?: string }) {
  return (
    <Badge tom="warning" icone="clock">
      {children ?? t('Atrasado')}
    </Badge>
  );
}

/** Nome da etapa com acento ("Separacao" -> "Separação"). */
export function NomeEtapa({ etapa }: { etapa: EtapaOP | string }) {
  // O historico registra a conclusao da OP como uma "etapa" final.
  if (etapa === 'Concluida') return <>{t('Concluída')}</>;
  return <>{td(ROTULO_ETAPA_OP[etapa as EtapaOP] ?? etapa)}</>;
}
