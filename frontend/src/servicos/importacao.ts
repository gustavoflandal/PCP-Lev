import type { ResultadoImportacao } from '@/tipos/importacao';
import { api } from './api';

/** Planilhas grandes numa rede de galpao: mais folga que o timeout padrao. */
const TIMEOUT_IMPORTACAO_MS = 120_000;

interface Envelope<T> {
  dados: T;
}

/** Baixa o gabarito (.xlsx vazio e estruturado). */
export async function baixarGabarito(): Promise<Blob> {
  const { data } = await api.get<Blob>('/importacao/gabarito', { responseType: 'blob' });
  return data;
}

/** Envia a planilha; a API confere tudo e so grava se nao houver nenhum erro. */
export async function importarPlanilha(arquivo: File): Promise<ResultadoImportacao> {
  const formulario = new FormData();
  formulario.append('arquivo', arquivo, arquivo.name);
  const { data } = await api.post<Envelope<ResultadoImportacao>>('/importacao', formulario, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: TIMEOUT_IMPORTACAO_MS,
  });
  return data.dados;
}
