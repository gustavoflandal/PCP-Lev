import { PERMISSOES } from '@/lib/permissoes';

/**
 * Espelho, SO PARA TESTES, da matriz semeada pelas migrations 014, 016, 017, 019 e 022
 * (docs/superpowers/specs/2026-10-24-rbac-design.md, secao 3). Usado pelo
 * setup dos testes para dar a fixtures de login sem `permissoes` as do
 * perfil delas -- o comportamento real do backend no login.
 */
const P = PERMISSOES;
const todas = Object.values(P);
const visualizacoes = todas.filter((p) => p.endsWith('.visualizar'));

export const PERMISSOES_POR_PERFIL: Record<string, string[]> = {
  ADMIN: todas,
  GESTOR: [
    ...todas.filter((p) => !p.startsWith('configuracoes.') && p !== P.pedidosEmitirAcimaAlcada),
    P.configAuditoria,
    P.configAuditoriaExportar,
  ],
  COMPRADOR: [
    P.fornecedoresVisualizar, P.fornecedoresIncluir, P.fornecedoresEditar, P.fornecedoresInativar,
    P.cotacoesVisualizar, P.cotacoesIncluir, P.cotacoesEditar, P.cotacoesCancelar, P.cotacoesConverter,
    P.pedidosVisualizar, P.pedidosIncluir, P.pedidosEditar, P.pedidosEmitir, P.pedidosCancelar, P.pedidosExportar,
    P.necessidadeVisualizar, P.pecasVisualizar, P.produtosVisualizar, P.estoqueVisualizar,
    P.producaoVisualizar,
    // Migration 019 (v1.2): recebimento fiscal.
    P.notasVisualizar, P.notasLancar,
    // Migration 022: paineis.
    P.paineisCompras, P.paineisEstoque,
  ],
  ALMOXARIFE: [
    P.pedidosVisualizar, P.pedidosReceber, P.estoqueVisualizar, P.estoqueAjustar, P.estoqueExportar,
    P.fornecedoresVisualizar, P.pecasVisualizar, P.produtosVisualizar, P.necessidadeVisualizar,
    P.producaoVisualizar, P.producaoApontar, P.producaoAvancar,
    P.notasVisualizar, P.notasLancar, P.notasEfetivar,
    P.paineisEstoque,
  ],
  OPERADOR: [
    P.produtosVisualizar, P.pecasVisualizar, P.estruturaVisualizar, P.estoqueVisualizar, P.centrosVisualizar,
    P.producaoVisualizar, P.producaoApontar, P.producaoAvancar,
    P.paineisProducao,
  ],
  QUALIDADE: [
    P.produtosVisualizar, P.pecasVisualizar, P.estruturaVisualizar, P.fornecedoresVisualizar, P.estoqueVisualizar,
    P.centrosVisualizar,
    P.producaoVisualizar, P.producaoApontar, P.producaoTestar, P.producaoMetrologia,
    P.notasVisualizar,
    P.paineisProducao, P.paineisQualidade,
  ],
  VENDAS: [
    P.produtosVisualizar, P.pecasVisualizar, P.estruturaVisualizar, P.estoqueVisualizar,
    P.clientesVisualizar, P.clientesIncluir, P.clientesEditar, P.clientesInativar, P.centrosVisualizar,
    P.vendasVisualizar, P.vendasIncluir, P.vendasEditar, P.vendasCancelar, P.vendasEntregar,
    P.producaoVisualizar,
    P.paineisVendas,
  ],
  CONSULTA: [...visualizacoes, P.pedidosExportar, P.estoqueExportar, ...todas.filter((p) => p.startsWith('paineis.'))],
};

export function permissoesDoPerfil(perfil: string): string[] {
  const permissoes = PERMISSOES_POR_PERFIL[perfil];
  if (!permissoes) {
    // Silenciar com [] esconderia um erro de digitacao na fixture.
    throw new Error(`perfil desconhecido no espelho da matriz: ${perfil} (informe permissoes na fixture)`);
  }
  return permissoes;
}
