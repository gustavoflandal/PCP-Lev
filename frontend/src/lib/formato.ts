import { t } from '@/i18n';
import { configuracaoRegionalAtual } from '@/store/configuracaoRegional';
import type { FormatoData, FormatoHora } from '@/tipos/regional';

const TAMANHO_CNPJ = 14;

const moedaBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Pontua o CNPJ para exibicao. O banco guarda so digitos, entao a pontuacao e
 * sempre derivada — nunca persistida.
 */
export function formatarCNPJ(cnpj: string): string {
  if (cnpj.length !== TAMANHO_CNPJ) {
    return cnpj;
  }
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export function formatarMoeda(valor: number): string {
  return moedaBR.format(valor);
}

const UNIDADES_BYTES = ['B', 'KB', 'MB', 'GB', 'TB'];
const decimalBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Tamanho em bytes na maior unidade binária que fique ≥ 1 ("12,3 MB"). */
export function formatarBytes(bytes: number): string {
  let valor = bytes;
  let unidade = 0;
  while (valor >= 1024 && unidade < UNIDADES_BYTES.length - 1) {
    valor /= 1024;
    unidade += 1;
  }
  return `${decimalBR.format(valor)} ${UNIDADES_BYTES[unidade]}`;
}

/** Duração em milissegundos com uma casa ("0,8 ms"). */
export function formatarMilissegundos(ms: number): string {
  return `${decimalBR.format(ms)} ms`;
}

/** Lead time em dias, com concordancia. */
export function formatarDias(dias: number): string {
  return dias === 1 ? t('1 dia') : t('{n} dias', { n: dias });
}

/** Núcleo puro de formatação de data — sem depender da store, para a
 * pré-visualização da tela de Parâmetros Regionais poder mostrar o efeito
 * de uma opção ainda não salva. */
export function formatarDataComFormato(dataAAAAMMDD: string, formato: FormatoData): string {
  const [ano, mes, dia] = dataAAAAMMDD.split('-');
  switch (formato) {
    case 'DD-MM-AAAA':
      return `${dia}-${mes}-${ano}`;
    case 'AAAA-MM-DD':
      return `${ano}-${mes}-${dia}`;
    case 'DD/MM/AAAA':
    default:
      return `${dia}/${mes}/${ano}`;
  }
}

/** Núcleo puro de formatação de hora — mesmo motivo do anterior. */
export function formatarHoraComFormato(hora: number, minuto: number, formato: FormatoHora): string {
  const minutoTexto = String(minuto).padStart(2, '0');
  if (formato === '12H') {
    const periodo = hora >= 12 ? 'PM' : 'AM';
    const hora12 = hora % 12 === 0 ? 12 : hora % 12;
    return `${String(hora12).padStart(2, '0')}:${minutoTexto} ${periodo}`;
  }
  return `${String(hora).padStart(2, '0')}:${minutoTexto}`;
}

/**
 * Converte a data do contrato da API (AAAA-MM-DD, ou um timestamp com essa
 * data na frente) para o formato de exibição configurado (Parâmetros
 * Regionais). Ausente vira travessão — o mesmo convite vazio usado no resto
 * do sistema, nunca string vazia.
 */
export function formatarData(data: string | undefined): string {
  if (!data) {
    return '—';
  }
  return formatarDataComFormato(data.slice(0, 10), configuracaoRegionalAtual().formato_data);
}

/**
 * Converte um timestamp ISO 8601 completo (com hora) para "<data> <hora>" no
 * formato configurado. `new Date(iso)` já resolve para o fuso do navegador —
 * o backend manda o offset correto (ver auditoria_repo.go, `normalizarRegistro`).
 */
export function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  const { formato_data: formatoData, formato_hora: formatoHora } = configuracaoRegionalAtual();

  const dataFormatada = formatarDataComFormato(`${ano}-${mes}-${dia}`, formatoData);
  const horaFormatada = formatarHoraComFormato(data.getHours(), data.getMinutes(), formatoHora);
  return `${dataFormatada} ${horaFormatada}`;
}
