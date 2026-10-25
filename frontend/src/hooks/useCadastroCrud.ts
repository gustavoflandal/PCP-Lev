import { useState } from 'react';
import { separarErro } from '@/lib/errosDeFormulario';
import type { Recurso } from '@/tipos/cadastros';
import { useMutacoesCadastro, type MensagensCadastro } from './useMutacoesCadastro';

/**
 * Maquina de estado comum aos cadastros: abrir novo, abrir edicao, fechar,
 * salvar, pedir e confirmar inativacao, separar o erro da API. Colunas,
 * schema zod e JSX continuam explicitos em cada tela — o hook so cuida do
 * estado que se repetiria verbatim.
 */
export interface CadastroCrud<T> {
  emEdicao: T | null;
  formularioAberto: boolean;
  aInativar: T | null;
  salvando: boolean;
  inativando: boolean;
  erroGeral: string | null;
  errosPorCampo: Record<string, string>;
  abrirNovo: () => void;
  abrirEdicao: (item: T) => void;
  fecharFormulario: () => void;
  salvar: (corpo: unknown) => void;
  pedirInativacao: (item: T) => void;
  cancelarInativacao: () => void;
  confirmarInativacao: () => void;
}

export function useCadastroCrud<T extends { id: number }>(
  recurso: Recurso,
  mensagens: MensagensCadastro,
): CadastroCrud<T> {
  const mutacoes = useMutacoesCadastro(recurso, mensagens);

  const [emEdicao, definirEmEdicao] = useState<T | null>(null);
  const [formularioAberto, definirFormularioAberto] = useState(false);
  const [aInativar, definirAInativar] = useState<T | null>(null);

  const mutacaoAtiva = emEdicao ? mutacoes.atualizar : mutacoes.criar;
  const { geral, porCampo } = separarErro(mutacaoAtiva.error);

  function abrirNovo() {
    mutacoes.criar.reset();
    definirEmEdicao(null);
    definirFormularioAberto(true);
  }

  function abrirEdicao(item: T) {
    mutacoes.atualizar.reset();
    definirEmEdicao(item);
    definirFormularioAberto(true);
  }

  function fecharFormulario() {
    definirFormularioAberto(false);
    definirEmEdicao(null);
  }

  function salvar(corpo: unknown) {
    const aoConcluir = { onSuccess: () => fecharFormulario() };
    if (emEdicao) {
      mutacoes.atualizar.mutate({ id: emEdicao.id, corpo }, aoConcluir);
    } else {
      mutacoes.criar.mutate(corpo, aoConcluir);
    }
  }

  function pedirInativacao(item: T) {
    definirAInativar(item);
  }

  function cancelarInativacao() {
    definirAInativar(null);
  }

  function confirmarInativacao() {
    if (aInativar) {
      mutacoes.inativar.mutate(aInativar.id, { onSuccess: () => definirAInativar(null) });
    }
  }

  return {
    emEdicao,
    formularioAberto,
    aInativar,
    salvando: mutacaoAtiva.isPending,
    inativando: mutacoes.inativar.isPending,
    erroGeral: geral,
    errosPorCampo: porCampo,
    abrirNovo,
    abrirEdicao,
    fecharFormulario,
    salvar,
    pedirInativacao,
    cancelarInativacao,
    confirmarInativacao,
  };
}
