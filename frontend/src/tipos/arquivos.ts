import { marcar } from '@/i18n';
/**
 * Contrato de arquivos e anexos (v1.2, R1) — espelho dos JSON tags de
 * backend/internal/domain/arquivo e das rotas de handlers/arquivos.go.
 *
 * URLs (`url`, `miniatura_url`, `foto_url`) chegam ASSINADAS, relativas
 * (/api/v1/arquivos/:id/conteudo?exp=&sig=) e expiram em 5 minutos: servem
 * direto em <img src> e em links, mas nao podem ficar em cache longo.
 */

/** Entidades que recebem anexos (mesmo CHECK da migration 018). */
export type EntidadeAnexo =
  | 'produto_acabado'
  | 'parte_peca'
  | 'nota_entrada'
  | 'lote'
  | 'ordem_producao'
  | 'fornecedor'
  | 'pedido_compra'
  | 'pedido_venda'
  | 'cliente';

export const ROTULO_ENTIDADE: Record<EntidadeAnexo, string> = {
  produto_acabado: marcar('Produto'),
  parte_peca: marcar('Peça'),
  nota_entrada: marcar('Nota de entrada'),
  lote: marcar('Lote'),
  ordem_producao: marcar('Ordem de produção'),
  fornecedor: marcar('Fornecedor'),
  pedido_compra: marcar('Pedido de compra'),
  pedido_venda: marcar('Pedido de venda'),
  cliente: marcar('Cliente'),
};

export type TipoAnexo = 'FOTO' | 'DOCUMENTO' | 'ANEXO';

/** Arquivo guardado (sem os bytes). */
export interface Arquivo {
  id: string;
  sha256: string;
  nome_original: string;
  tipo_mime: string;
  tamanho: number;
  tem_miniatura: boolean;
  created_at: string;
}

export interface Anexo {
  id: number;
  entidade: EntidadeAnexo;
  entidade_id: number;
  tipo: TipoAnexo;
  categoria: string;
  titulo: string;
  descricao: string;
  versao: string;
  /** Agrupa as versoes de um mesmo documento (id da primeira versao). */
  documento_chave: number;
  vigente: boolean;
  /** AAAA-MM-DD; ausentes quando nao informadas (omitzero). */
  data_emissao?: string | null;
  data_validade?: string | null;
  fornecedor_id?: number;
  estrutura_produto_id?: number;
  principal: boolean;
  ordem: number;
  arquivo: Arquivo;
  created_at: string;
  created_by?: string;
  /** Assinadas, vida de 5 minutos. */
  url?: string;
  miniatura_url?: string;
}

/** Corpo de POST /anexos e PUT /anexos/:id (anexoRequest no handler). */
export interface CorpoAnexo {
  entidade: EntidadeAnexo;
  entidade_id: number;
  arquivo_id: string;
  tipo: TipoAnexo;
  categoria: string;
  titulo: string;
  descricao: string;
  versao: string;
  /** AAAA-MM-DD ou null. */
  data_emissao: string | null;
  data_validade: string | null;
  fornecedor_id: number | null;
  estrutura_produto_id: number | null;
  /** Opcional (v1.2): omitido mantem como esta. */
  principal?: boolean;
  /** Nova versao de um documento: as anteriores ficam no historico. */
  substitui_anexo_id?: number | null;
}

export interface UrlAssinada {
  url: string;
  expira_em: string;
}

/** Documento vigente vencido ou a vencer (GET /anexos/vencimentos). */
export interface VencimentoDocumento {
  anexo_id: number;
  entidade: EntidadeAnexo;
  entidade_id: number;
  entidade_codigo: string;
  categoria: string;
  titulo: string;
  data_validade: string;
  vencido: boolean;
}

/** Categorias obrigatorias de documento tecnico de produto/peca (4.1.2). */
export const CATEGORIAS_DOCUMENTO_PRODUTO = [
  marcar('Datasheet'),
  marcar('Desenho Mecânico'),
  marcar('Esquema Elétrico'),
  marcar('Manual de Montagem'),
  marcar('Certificado de Conformidade'),
  marcar('Laudo de Ensaio'),
  marcar('Instrução de Trabalho'),
  marcar('Ficha de Segurança'),
] as const;

/**
 * Registros operacionais (Fase 3.1): so aceitam tipo ANEXO e a categoria e
 * obrigatoria, de uma lista fechada por entidade.
 */
export type EntidadeRegistro = Extract<
  EntidadeAnexo,
  'ordem_producao' | 'fornecedor' | 'pedido_compra' | 'pedido_venda' | 'cliente'
>;

/** Espelho de Categorias* em backend/internal/domain/arquivo/anexo.go (mesma grafia). */
export const CATEGORIAS_ANEXO_REGISTRO: Record<EntidadeRegistro, readonly string[]> = {
  ordem_producao: [marcar('Laudo de Teste'), marcar('Relatório de Inspeção'), marcar('Foto da Produção'), marcar('Desenho/Esquema'), marcar('Outro')],
  fornecedor: [marcar('Contrato'), marcar('Certificado de Qualidade'), marcar('Documentos Cadastrais'), marcar('Tabela de Preços'), marcar('Outro')],
  pedido_compra: [marcar('Proposta/Cotação'), marcar('Pedido Assinado'), marcar('Comunicação'), marcar('Outro')],
  pedido_venda: [marcar('Contrato/Edital'), marcar('Pedido do Cliente'), marcar('Termo de Aceite'), marcar('Ordem de Serviço'), marcar('Outro')],
  cliente: [marcar('Contrato'), marcar('Documentos Cadastrais'), marcar('Termo de Aceite'), marcar('Outro')],
};

/** Fotos alem da principal (4.1.2). */
export const GALERIA_MAXIMA = 10;

/** Limites do backend (arquivo.LimiteImagem / LimitePDF). A API e a autoridade. */
export const LIMITE_IMAGEM_BYTES = 5 * 1024 * 1024;
export const LIMITE_PDF_BYTES = 25 * 1024 * 1024;

export const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const TIPO_PDF = 'application/pdf';

/** Flags de controle do item (4.1.1) — comuns a peca e produto acabado. */
export interface FlagsControle {
  controla_numero_serie: boolean;
  controla_lote: boolean;
  /** So existe junto com controla_lote (o backend devolve 400). */
  controla_validade: boolean;
  /** Exige foto principal: a foto nao pode ser removida sem outra. */
  item_critico: boolean;
  exige_certificado: boolean;
}
