export interface DadosEmpresa {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  cnae: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  site: string;
  rodape_padrao: string;
  condicoes_gerais_compra: string;
  responsavel_tecnico: string;
  tem_logo_claro: boolean;
  tem_logo_escuro: boolean;
  tem_favicon: boolean;
  updated_at: string;
  updated_by?: string;
}

/** Corpo de PUT /configuracoes/empresa — sempre a empresa inteira de novo. */
export type CorpoAtualizarEmpresa = Omit<
  DadosEmpresa,
  'tem_logo_claro' | 'tem_logo_escuro' | 'tem_favicon' | 'updated_at' | 'updated_by'
>;

/** Corpo de PUT .../logotipo/claro|escuro e .../favicon. dados_base64 vazio remove a imagem. */
export interface CorpoAtualizarImagemEmpresa {
  dados_base64: string;
  mime: string;
}
