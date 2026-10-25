import { Badge, type TomBadge } from '@/componentes/ui/Badge';
import type { NomeIcone } from '@/componentes/ui/icones';
import { DIAS_ALERTA_VALIDADE, diasAteVencer } from '@/lib/validade';
import type { StatusNota } from '@/tipos/notasEntrada';

/**
 * Tom por situacao da nota (design system §2): Conferida aguarda a efetivacao
 * (azul-violeta de "aguardando", nao problema); Efetivada e concluida;
 * cancelada e estornada sao historico, neutras.
 */
const TOM_STATUS: Record<StatusNota, { tom: TomBadge; icone: NomeIcone; rotulo: string }> = {
  Rascunho: { tom: 'neutral', icone: 'circle', rotulo: 'Rascunho' },
  Conferida: { tom: 'blocked', icone: 'shield-check', rotulo: 'Conferida · aguardando efetivação' },
  Efetivada: { tom: 'done', icone: 'check-circle-2', rotulo: 'Efetivada' },
  Cancelada: { tom: 'neutral', icone: 'ban', rotulo: 'Cancelada' },
  Estornada: { tom: 'neutral', icone: 'undo-2', rotulo: 'Estornada' },
};

export function SeloStatusNota({ status }: { status: StatusNota }) {
  const t = TOM_STATUS[status] ?? TOM_STATUS.Rascunho;
  return (
    <Badge tom={t.tom} icone={t.icone}>
      {t.rotulo}
    </Badge>
  );
}

/**
 * Validade do lote: vencido (vermelho), a vencer em ate 30 dias (laranja),
 * valido (neutro) ou sem validade. Sempre com texto.
 */
export function SeloValidadeLote({ validade, vencido }: { validade?: string | null; vencido?: boolean }) {
  if (!validade) {
    return (
      <Badge tom="neutral" icone="circle">
        Sem validade
      </Badge>
    );
  }
  const dias = diasAteVencer(validade);
  if (vencido || dias < 0) {
    return (
      <Badge tom="pending" icone="alert-triangle">
        Vencido
      </Badge>
    );
  }
  if (dias <= DIAS_ALERTA_VALIDADE) {
    return (
      <Badge tom="warning" icone="calendar-clock">
        {dias === 0 ? 'Vence hoje' : dias === 1 ? 'Vence em 1 dia' : `Vence em ${dias} dias`}
      </Badge>
    );
  }
  return (
    <Badge tom="done" icone="check-circle-2">
      Válido
    </Badge>
  );
}
