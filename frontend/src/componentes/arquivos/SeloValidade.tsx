import { Badge } from '@/componentes/ui/Badge';
import { DIAS_ALERTA_VALIDADE, diasAteVencer } from '@/lib/validade';
import { t } from '@/i18n';

/**
 * Selo do vencimento de um documento: vencido (vermelho), perto de vencer
 * (laranja) ou ainda distante (neutro). Sempre com texto: a cor nunca
 * carrega a informacao sozinha.
 */
export function SeloValidade({ validade, hoje }: { validade: string; hoje?: string }) {
  const dias = diasAteVencer(validade, hoje);
  if (dias < 0) {
    return (
      <Badge tom="pending" icone="alert-triangle">
        {t('Vencido')}
      </Badge>
    );
  }
  const texto = dias === 0 ? t('Vence hoje') : dias === 1 ? t('Vence em 1 dia') : t('Vence em {dias} dias', { dias });
  return dias <= DIAS_ALERTA_VALIDADE ? (
    <Badge tom="warning" icone="calendar-clock">
      {texto}
    </Badge>
  ) : (
    <Badge tom="neutral" icone="calendar-clock">
      {texto}
    </Badge>
  );
}
