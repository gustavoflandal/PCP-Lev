import { useAutenticacao } from '@/store/autenticacao';

/**
 * Codigos das permissoes (RBAC, doc 0 secao 4.7.3) -- espelho do catalogo de
 * backend/internal/domain/acesso. A interface decide menu, botoes e telas por
 * permissao, nunca pelo codigo do perfil: perfis sao editaveis (e podem ser
 * criados) pelo Administrador, entao "GESTOR pode X" nao e mais verdade fixa.
 */
export const PERMISSOES = {
  fornecedoresVisualizar: 'fornecedores.visualizar',
  fornecedoresIncluir: 'fornecedores.incluir',
  fornecedoresEditar: 'fornecedores.editar',
  fornecedoresInativar: 'fornecedores.inativar',
  clientesVisualizar: 'clientes.visualizar',
  clientesIncluir: 'clientes.incluir',
  clientesEditar: 'clientes.editar',
  clientesInativar: 'clientes.inativar',
  pecasVisualizar: 'partes_pecas.visualizar',
  pecasIncluir: 'partes_pecas.incluir',
  pecasEditar: 'partes_pecas.editar',
  pecasInativar: 'partes_pecas.inativar',
  produtosVisualizar: 'produtos.visualizar',
  produtosIncluir: 'produtos.incluir',
  produtosEditar: 'produtos.editar',
  produtosInativar: 'produtos.inativar',
  estruturaVisualizar: 'estrutura.visualizar',
  estruturaIncluir: 'estrutura.incluir',
  centrosVisualizar: 'centros_trabalho.visualizar',
  centrosIncluir: 'centros_trabalho.incluir',
  centrosEditar: 'centros_trabalho.editar',
  centrosInativar: 'centros_trabalho.inativar',
  cotacoesVisualizar: 'cotacoes.visualizar',
  cotacoesIncluir: 'cotacoes.incluir',
  cotacoesEditar: 'cotacoes.editar',
  cotacoesCancelar: 'cotacoes.cancelar',
  cotacoesConverter: 'cotacoes.converter',
  pedidosVisualizar: 'pedidos_compra.visualizar',
  pedidosIncluir: 'pedidos_compra.incluir',
  pedidosEditar: 'pedidos_compra.editar',
  pedidosEmitir: 'pedidos_compra.emitir',
  pedidosEmitirAcimaAlcada: 'pedidos_compra.emitir_acima_alcada',
  pedidosCancelar: 'pedidos_compra.cancelar',
  pedidosReceber: 'pedidos_compra.receber',
  pedidosExportar: 'pedidos_compra.exportar',
  pedidosEncerrar: 'pedidos_compra.encerrar',
  notasVisualizar: 'notas_entrada.visualizar',
  notasLancar: 'notas_entrada.lancar',
  notasEfetivar: 'notas_entrada.efetivar',
  notasEstornar: 'notas_entrada.estornar',
  notasAprovarDivergencia: 'notas_entrada.aprovar_divergencia',
  estoqueVisualizar: 'estoque.visualizar',
  estoqueAjustar: 'estoque.ajustar',
  estoqueExportar: 'estoque.exportar',
  necessidadeVisualizar: 'necessidade_compra.visualizar',
  vendasVisualizar: 'pedidos_venda.visualizar',
  vendasIncluir: 'pedidos_venda.incluir',
  vendasEditar: 'pedidos_venda.editar',
  vendasCancelar: 'pedidos_venda.cancelar',
  vendasEntregar: 'pedidos_venda.entregar',
  producaoVisualizar: 'producao.visualizar',
  producaoGerarOP: 'producao.gerar_op',
  producaoLiberar: 'producao.liberar',
  producaoApontar: 'producao.apontar',
  producaoAvancar: 'producao.avancar',
  producaoCancelar: 'producao.cancelar',
  producaoTestar: 'producao.testar',
  producaoMetrologia: 'producao.metrologia',
  producaoCustos: 'producao.custos',
  paineisCompras: 'paineis.compras',
  paineisEstoque: 'paineis.estoque',
  paineisProducao: 'paineis.producao',
  paineisVendas: 'paineis.vendas',
  paineisQualidade: 'paineis.qualidade',
  configEmpresa: 'configuracoes.empresa',
  configRegional: 'configuracoes.regional',
  configNegocio: 'configuracoes.negocio',
  configIntegracoes: 'configuracoes.integracoes',
  configBanco: 'configuracoes.banco',
  configAuditoria: 'configuracoes.auditoria',
  configAuditoriaExportar: 'configuracoes.auditoria_exportar',
  configPerfis: 'configuracoes.perfis',
  configUsuarios: 'configuracoes.usuarios',
} as const;

export type Permissao = (typeof PERMISSOES)[keyof typeof PERMISSOES];

/** A sessao atual tem a permissao? (Fora do React: interceptadores, etc.) */
export function podeNaSessao(permissao: Permissao): boolean {
  return useAutenticacao.getState().usuario?.permissoes?.includes(permissao) ?? false;
}

/** Hook: re-renderiza quando as permissoes da sessao mudam. */
export function usePode(permissao: Permissao): boolean {
  return useAutenticacao((estado) => estado.usuario?.permissoes?.includes(permissao) ?? false);
}
