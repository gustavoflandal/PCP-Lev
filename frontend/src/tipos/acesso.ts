/** Item do catálogo de permissões (GET /acesso/permissoes). */
export interface PermissaoCatalogo {
  codigo: string;
  modulo: string;
  acao: string;
  descricao: string;
  sensivel: boolean;
}

/** Perfil de acesso com as suas permissões (GET /acesso/perfis). */
export interface PerfilAcesso {
  codigo: string;
  nome: string;
  descricao: string;
  sistema: boolean;
  permissoes: string[];
  usuarios: number;
}

export interface CorpoPerfil {
  codigo?: string;
  nome: string;
  descricao: string;
  permissoes: string[];
}
