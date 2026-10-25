import { api } from './api';
import type { DadosPaginacao, Pagina } from '@/tipos/cadastros';
import type { FiltrosAuditoria, RegistroAuditoria } from '@/tipos/auditoria';

interface EnvelopeLista<T> {
  dados: T[];
  paginacao: DadosPaginacao;
}

function paramsDeFiltros(filtros: FiltrosAuditoria): Record<string, string | number> {
  const params: Record<string, string | number> = { pagina: filtros.pagina, limite: filtros.limite };
  if (filtros.data_inicio) params.data_inicio = filtros.data_inicio;
  if (filtros.data_fim) params.data_fim = filtros.data_fim;
  if (filtros.usuario_id) params.usuario_id = filtros.usuario_id;
  if (filtros.tabela) params.tabela = filtros.tabela;
  if (filtros.operacao) params.operacao = filtros.operacao;
  return params;
}

export async function listarAuditoria(filtros: FiltrosAuditoria): Promise<Pagina<RegistroAuditoria>> {
  const { data } = await api.get<EnvelopeLista<RegistroAuditoria>>('/auditoria', { params: paramsDeFiltros(filtros) });
  return { itens: data.dados, paginacao: data.paginacao };
}

/** Monta a query string de exportação a partir dos mesmos filtros da tela
 * (sem pagina/limite -- o CSV nunca pagina). Usada com `baixarArquivo`, que
 * so aceita uma URL pronta, não um objeto de parâmetros. */
export function queryDeExportacaoAuditoria(filtros: Omit<FiltrosAuditoria, 'pagina' | 'limite'>): string {
  const params = new URLSearchParams();
  if (filtros.data_inicio) params.set('data_inicio', filtros.data_inicio);
  if (filtros.data_fim) params.set('data_fim', filtros.data_fim);
  if (filtros.usuario_id) params.set('usuario_id', String(filtros.usuario_id));
  if (filtros.tabela) params.set('tabela', filtros.tabela);
  if (filtros.operacao) params.set('operacao', filtros.operacao);
  return params.toString();
}
