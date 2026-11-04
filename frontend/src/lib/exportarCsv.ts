/**
 * Exportacao em CSV das tabelas que estao na tela (botao "CSV" ao lado de
 * "Imprimir / PDF"). Le o proprio DOM: o que a pessoa ve na tabela -- a pagina
 * carregada, com os filtros aplicados -- e o que vai para a planilha.
 *
 * Separador ';' e BOM UTF-8, o que o Excel em pt-BR abre sem mojibake e sem
 * colar tudo numa coluna so (mesma convencao dos relatorios do backend).
 */
import { t } from '@/i18n';
import { nomeDoArquivo, tituloDaTela } from './impressao';

const BOM = '﻿';

function escapar(valor: string): string {
  return /[;"\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** Texto de uma celula; icones de "tem/nao tem" viram Sim/Nao e campos viram o valor digitado. */
function textoDaCelula(celula: HTMLTableCellElement): string {
  const campo = celula.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
  if (campo) {
    if (campo instanceof HTMLSelectElement) {
      return campo.selectedOptions[0]?.textContent?.trim() ?? '';
    }
    return campo.value.trim();
  }
  const texto = (celula.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (texto) return texto;
  // Indicador sem texto: check clicavel = sim; icone de inexistente = nao.
  if (celula.querySelector('button[aria-label]')) return t('Sim');
  if (celula.querySelector('[role="img"][aria-label]')) return t('Não');
  return '';
}

/** Colunas de acao (lixeira, editar...) nao entram na planilha. */
function colunaIgnorada(cabecalho: HTMLTableCellElement): boolean {
  const texto = (cabecalho.textContent ?? '').trim();
  return cabecalho.classList.contains('print:hidden') || texto === t('Ações');
}

/** Linhas (cabecalho + dados) de uma tabela, ja sem as colunas de acao. */
export function linhasDaTabela(tabela: HTMLTableElement): string[][] {
  const cabecalhos = Array.from(tabela.querySelectorAll<HTMLTableCellElement>('thead th'));
  const mantidas = cabecalhos.map((th, indice) => (colunaIgnorada(th) ? -1 : indice)).filter((i) => i >= 0);
  const linhas: string[][] = [mantidas.map((i) => (cabecalhos[i].textContent ?? '').replace(/\s+/g, ' ').trim())];

  tabela.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
    const celulas = Array.from(tr.querySelectorAll<HTMLTableCellElement>('td'));
    // Linhas de estado (vazio, erro, esqueleto) ocupam a tabela inteira com uma celula so.
    if (celulas.length === 1 && cabecalhos.length > 1) return;
    linhas.push(mantidas.map((i) => (celulas[i] ? textoDaCelula(celulas[i]) : '')));
  });
  return linhas;
}

/** Monta o CSV de todas as tabelas dentro de `raiz`; vazio quando nao ha nenhuma com dados. */
export function montarCsv(raiz: ParentNode): string {
  const tabelas = Array.from(raiz.querySelectorAll<HTMLTableElement>('table'));
  const blocos: string[] = [];
  for (const tabela of tabelas) {
    const linhas = linhasDaTabela(tabela);
    if (linhas.length < 2) continue;
    const titulo = tabela.getAttribute('aria-label');
    const corpo = linhas.map((l) => l.map(escapar).join(';')).join('\r\n');
    blocos.push(tabelas.length > 1 && titulo ? `${escapar(titulo)}\r\n${corpo}` : corpo);
  }
  return blocos.join('\r\n\r\n');
}

/** Escopo da exportacao: o dialogo aberto, ou a area principal da tela. */
function raizDaExportacao(): ParentNode {
  return document.querySelector('[role="dialog"]') ?? document.querySelector('main') ?? document;
}

/**
 * Baixa o CSV das tabelas da tela. Devolve false quando nao ha tabela com
 * dados -- quem chama avisa a pessoa em vez de baixar um arquivo vazio.
 */
export function exportarTabelasCsv(raiz: ParentNode = raizDaExportacao()): boolean {
  const csv = montarCsv(raiz);
  if (!csv) return false;
  const blob = new Blob([BOM, csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${nomeDoArquivo(tituloDaTela(), new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
