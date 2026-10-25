import { hojeAAAAMMDD } from '@/tipos/producao';

/** Abaixo disto o vencimento vira alerta (laranja); acima e so informativo. */
export const DIAS_ALERTA_VALIDADE = 30;

/** Dias de `hoje` ate `validade` (AAAA-MM-DD); negativo = ja venceu. */
export function diasAteVencer(validade: string, hoje: string = hojeAAAAMMDD()): number {
  const emDias = (data: string) =>
    Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, Number(data.slice(8, 10))) / 86_400_000;
  return Math.round(emDias(validade) - emDias(hoje));
}
