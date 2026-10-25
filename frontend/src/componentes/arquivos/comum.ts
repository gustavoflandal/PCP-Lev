import { useQuery } from '@tanstack/react-query';
import { separarErro } from '@/lib/errosDeFormulario';
import { listarEstruturasPorProduto } from '@/servicos/estrutura';
import type { Anexo, CorpoAnexo, EntidadeAnexo } from '@/tipos/arquivos';

/** Entidades com midia de produto (fotos + documentos tecnicos). */
export type EntidadeComMidia = Extract<EntidadeAnexo, 'produto_acabado' | 'parte_peca'>;

/** Chave de cache da lista de anexos de um registro. */
export function chaveAnexos(entidade: EntidadeAnexo, entidadeId: number) {
  return ['anexos', entidade, entidadeId] as const;
}

/** Lista do cadastro que mostra a miniatura da foto principal. */
export const RECURSO_DA_ENTIDADE: Record<EntidadeComMidia, string> = {
  produto_acabado: 'produtos-acabados',
  parte_peca: 'partes-pecas',
};

/** Mensagem legivel de uma falha da API (400/409 trazem o texto do dominio). */
export function mensagemDeErro(erro: unknown, padrao: string): string {
  const { geral, porCampo } = separarErro(erro);
  return geral ?? Object.values(porCampo)[0] ?? padrao;
}

/** Corpo base de POST /anexos: so o que muda e informado por quem chama. */
export function corpoNovoAnexo(
  entidade: EntidadeAnexo,
  entidadeId: number,
  arquivoId: string,
  resto: Partial<CorpoAnexo> & Pick<CorpoAnexo, 'tipo'>,
): CorpoAnexo {
  return {
    entidade,
    entidade_id: entidadeId,
    arquivo_id: arquivoId,
    categoria: '',
    titulo: '',
    descricao: '',
    versao: '',
    data_emissao: null,
    data_validade: null,
    fornecedor_id: null,
    estrutura_produto_id: null,
    principal: false,
    ...resto,
  };
}

/** Versoes da estrutura (BOM) do produto, para vincular um documento a uma revisao. */
export function useEstruturasDoProduto(produtoId: number | null) {
  return useQuery({
    queryKey: ['estruturas', produtoId],
    queryFn: () => listarEstruturasPorProduto(produtoId ?? 0),
    enabled: produtoId !== null,
  });
}

/** Um documento e as suas versoes (mesmo documento_chave). */
export interface GrupoDeVersoes {
  chave: number;
  vigente: Anexo;
  /** Versoes substituidas, da mais nova para a mais antiga. */
  anteriores: Anexo[];
}

/** Agrupa as versoes pelo documento_chave; a vigente encabeca o grupo. */
export function agruparVersoes(anexos: Anexo[]): GrupoDeVersoes[] {
  const porChave = new Map<number, Anexo[]>();
  for (const d of anexos) {
    const chave = d.documento_chave || d.id;
    porChave.set(chave, [...(porChave.get(chave) ?? []), d]);
  }
  return [...porChave.entries()].map(([chave, versoes]) => {
    const ordenadas = [...versoes].sort((a, b) => b.id - a.id);
    const vigente = ordenadas.find((v) => v.vigente) ?? ordenadas[0];
    return { chave, vigente, anteriores: ordenadas.filter((v) => v.id !== vigente.id) };
  });
}
