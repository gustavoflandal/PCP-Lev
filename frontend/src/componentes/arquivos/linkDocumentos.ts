import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Parametros do link direto (vindo de Documentos a vencer): ?documentos=ID&nome=... */
export const PARAMETRO_DOCUMENTOS = 'documentos';
export const PARAMETRO_NOME = 'nome';

/** Link que abre os documentos de um cadastro (fornecedor, cliente) direto na lista. */
export function linkDocumentosDoCadastro(rota: string, id: number, nome: string): string {
  const parametros = new URLSearchParams({ [PARAMETRO_DOCUMENTOS]: String(id), [PARAMETRO_NOME]: nome });
  return `${rota}?${parametros.toString()}`;
}

export interface RegistroComDocumentos {
  id: number;
  nome: string;
}

/**
 * Qual cadastro esta com os documentos abertos: o escolhido na linha da
 * tabela ou o do link direto. Fechar limpa o link, para o "voltar" do
 * navegador nao reabrir o modal.
 */
export function useDocumentosDoCadastro() {
  const [parametros, definirParametros] = useSearchParams();
  const [escolhido, definirEscolhido] = useState<RegistroComDocumentos | null>(null);
  const idDoLink = Number(parametros.get(PARAMETRO_DOCUMENTOS));
  const doLink =
    Number.isInteger(idDoLink) && idDoLink > 0 ? { id: idDoLink, nome: parametros.get(PARAMETRO_NOME) ?? '' } : null;

  function fechar() {
    definirEscolhido(null);
    if (doLink) {
      const novos = new URLSearchParams(parametros);
      novos.delete(PARAMETRO_DOCUMENTOS);
      novos.delete(PARAMETRO_NOME);
      definirParametros(novos, { replace: true });
    }
  }

  return { aberto: escolhido ?? doLink, abrir: definirEscolhido, fechar };
}
