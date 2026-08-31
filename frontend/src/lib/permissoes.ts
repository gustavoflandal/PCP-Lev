import type { Perfil } from '@/store/autenticacao';

/**
 * Escrita nos cadastros base e de ADMIN e GESTOR (o backend responde 403 para
 * OPERADOR). A regra mora aqui para que a interface nao ofereca o que vai ser
 * negado — e para que so exista um lugar a mudar quando o RNF3 mudar.
 */
export function podeGerenciarCadastros(perfil: Perfil | null | undefined): boolean {
  return perfil === 'ADMIN' || perfil === 'GESTOR';
}
