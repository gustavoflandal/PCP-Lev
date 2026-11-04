/**
 * Contrato das APIs de integracao com o ERP — espelho dos JSON tags de
 * backend/internal/domain/integracao e de handlers/integracao*.go.
 */

/** Chave de API como a tela a exibe: nunca o segredo. */
export interface ChaveApi {
  id: number;
  nome: string;
  descricao: string;
  /** Primeiros caracteres da chave, para reconhece-la sem revelar o segredo. */
  prefixo: string;
  ativo: boolean;
  criado_por: string;
  ultimo_uso?: string;
  created_at: string;
  revogada_em?: string;
  revogada_por?: string;
}

/** Resposta da criacao: o unico momento em que o segredo (`chave`) aparece. */
export interface ChaveApiCriada extends ChaveApi {
  chave: string;
}

export interface CorpoChaveApi {
  nome: string;
  descricao: string;
}

export interface ParametroEndpoint {
  nome: string;
  /** "caminho" ou "consulta". */
  onde: 'caminho' | 'consulta';
  descricao: string;
}

/** Uma rota da API publica de integracao (GET /integracao/endpoints). */
export interface EndpointIntegracao {
  metodo: string;
  caminho: string;
  recurso: string;
  descricao: string;
  parametros: ParametroEndpoint[];
  exemplo: string;
}
