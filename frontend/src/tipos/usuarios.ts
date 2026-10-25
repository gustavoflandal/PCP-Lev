/** Situacao do cadastro de usuario (nunca e excluido). */
export type SituacaoUsuario = 'ATIVO' | 'INATIVO' | 'BLOQUEADO';

/** Usuario como a API de gestao devolve (GET /usuarios). */
export interface Usuario {
  id: number;
  username: string;
  nome: string;
  email: string;
  perfil: string;
  situacao: SituacaoUsuario;
  matricula?: string;
  telefone: string;
  setor: string;
  data_admissao?: string;
  data_desligamento?: string;
  deve_trocar_senha: boolean;
  ultimo_login?: string;
  created_at: string;
}

export interface CorpoUsuario {
  username?: string;
  nome: string;
  email: string;
  perfil: string;
  matricula: string | null;
  telefone: string;
  setor: string;
  data_admissao: string | null;
  senha_temporaria?: string;
}

/** Permissao concedida ou retirada so para um usuario, sobre o perfil. */
export interface PermissaoIndividual {
  codigo: string;
  concedida: boolean;
  justificativa: string;
  created_at: string;
  created_by?: string;
}

export interface PermissoesDoUsuario {
  individuais: PermissaoIndividual[];
  efetivas: string[];
}

export interface FiltrosUsuarios {
  pagina: number;
  busca: string;
  perfil: string;
  situacao: SituacaoUsuario | '';
  ordenar_por: string;
  ordem: 'asc' | 'desc';
}
