/**
 * Fixa o fuso dos testes em UTC (vitest globalSetup, roda antes dos workers e
 * eles herdam o ambiente): varios testes de data comparam o texto formatado
 * com o instante informado e so concordam quando o fuso local e UTC.
 */
export default function fixarFuso(): void {
  process.env.TZ = 'UTC';
}
