/**
 * Formatacao dos paineis: rotulos das series (mes, semana, situacao, etapa)
 * e dos valores (moeda, percentual, dias, horas). Funcoes puras -- os
 * componentes de grafico recebem a funcao certa por prop.
 */
import { ROTULO_STATUS_PEDIDO_COMPRA, type StatusPedidoCompra } from '@/tipos/compras';
import { ROTULO_ETAPA_OP, ROTULO_STATUS_PEDIDO_VENDA, type EtapaOP, type StatusPedidoVenda } from '@/tipos/producao';
import { formatarMoeda } from './formato';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-10" -> "out/26". Rotulo fora do formato volta como veio. */
export function formatarMes(rotulo: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(rotulo);
  if (!m) return rotulo;
  const mes = MESES[Number(m[2]) - 1];
  return mes ? `${mes}/${m[1].slice(2)}` : rotulo;
}

/** "2026-10-20" (segunda-feira da semana) -> "20/10". */
export function formatarSemana(rotulo: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(rotulo);
  return m ? `${m[2]}/${m[1]}` : rotulo;
}

/** Situacao do pedido de compra com o rotulo do sistema ("Aguardando Entrega" -> "Aguardando entrega"). */
export function rotuloSituacaoPedidoCompra(rotulo: string): string {
  return ROTULO_STATUS_PEDIDO_COMPRA[rotulo as StatusPedidoCompra] ?? rotulo;
}

/** Situacao do pedido de venda ("Em Producao" -> "Em produção"). */
export function rotuloSituacaoPedidoVenda(rotulo: string): string {
  return ROTULO_STATUS_PEDIDO_VENDA[rotulo as StatusPedidoVenda] ?? rotulo;
}

/** Situacoes da nota de entrada ja chegam no rotulo de exibicao; so garante o texto. */
export function rotuloSituacaoNota(rotulo: string): string {
  return rotulo;
}

/** Etapa da OP: "Aberta" (ainda nao liberada) ou a etapa com acento ("Separacao" -> "Separação"). */
export function rotuloEtapa(rotulo: string): string {
  return ROTULO_ETAPA_OP[rotulo as EtapaOP] ?? rotulo;
}

const inteiroBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimalBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const moedaCompacta = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Como um valor de serie ou indicador e escrito. */
export type FormatoValor = 'numero' | 'moeda' | 'percentual' | 'dias' | 'horas';

/** Valor completo (cartao, dica do grafico e tabela "Ver dados"). Null vira travessao. */
export function formatarValor(valor: number | null | undefined, formato: FormatoValor): string {
  if (valor === null || valor === undefined) return '—';
  switch (formato) {
    case 'moeda':
      return formatarMoeda(valor);
    case 'percentual':
      return `${decimalBR.format(valor)}%`;
    case 'dias':
      return valor === 1 ? '1 dia' : `${decimalBR.format(valor)} dias`;
    case 'horas':
      return `${decimalBR.format(valor)} h`;
    case 'numero':
    default:
      return Number.isInteger(valor) ? inteiroBR.format(valor) : decimalBR.format(valor);
  }
}

/** Valor curto para o eixo do grafico ("R$ 12,5 mil"). */
export function formatarValorEixo(valor: number, formato: FormatoValor): string {
  switch (formato) {
    case 'moeda':
      return moedaCompacta.format(valor);
    case 'percentual':
      return `${inteiroBR.format(valor)}%`;
    default:
      return decimalBR.format(valor);
  }
}

/** "Atualizado às 14:05:09" -- relogio de 24 h, com segundos. */
export function formatarHorario(instante: number): string {
  const d = new Date(instante);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}
