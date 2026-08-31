import { create } from 'zustand';
import { PREFERENCIAS_PADRAO, usePreferencias, type Densidade, type Preferencias, type TamanhoFonte, type Tema } from './preferencias';

export type Perfil = 'ADMIN' | 'GESTOR' | 'OPERADOR';

export interface UsuarioSessao {
  id: number;
  username: string;
  nome: string;
  perfil: Perfil;
  tema: Tema;
  alto_contraste: boolean;
  densidade: Densidade;
  tamanho_fonte: TamanhoFonte;
}

/** Contrato de POST /auth/login (doc 3). */
export interface RespostaLogin {
  access_token: string;
  token_type: string;
  expires_in: number;
  usuario: UsuarioSessao;
}

/** Por que a sessao terminou — a tela de login explica o motivo ao usuario. */
export type MotivoSaida = 'expirada' | 'inatividade' | null;

interface Sessao {
  token: string;
  usuario: UsuarioSessao;
}

/**
 * A sessao fica em sessionStorage, nao em localStorage: some ao fechar a aba,
 * limitando a janela de uso de um token roubado. Aqui nao trafega dado de
 * negocio — apenas a credencial da sessao e a identidade de quem esta logado.
 */
const CHAVE_SESSAO = 'pcp.sessao';

export function lerSessaoSalva(): Sessao | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    if (!bruto) return null;

    const sessao = JSON.parse(bruto) as Partial<Sessao>;
    if (!sessao?.token || !sessao?.usuario) return null;

    return { token: sessao.token, usuario: sessao.usuario };
  } catch {
    // Sessao corrompida ou armazenamento bloqueado: trata como sem sessao.
    return null;
  }
}

function salvarSessao(sessao: Sessao | null): void {
  try {
    if (sessao) {
      sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
    } else {
      sessionStorage.removeItem(CHAVE_SESSAO);
    }
  } catch {
    // Armazenamento indisponivel: a sessao segue valida apenas em memoria.
  }
}

interface EstadoAutenticacao {
  token: string | null;
  usuario: UsuarioSessao | null;
  autenticado: boolean;
  motivoSaida: MotivoSaida;
  entrar: (resposta: RespostaLogin) => void;
  sair: (motivo?: MotivoSaida) => void;
  /** Mantem o usuario da sessao (e o sessionStorage) em dia com a ultima
   * preferencia salva -- sem isso, um F5 apos mudar preferencias re-semeia
   * o <html> com o valor de login (ver `sessaoInicial` abaixo), revertendo
   * a troca que acabou de ser confirmada pelo servidor. */
  atualizarPreferenciasSessao: (preferencias: Preferencias) => void;
}

function preferenciasDoUsuario(usuario: UsuarioSessao): Preferencias {
  return {
    tema: usuario.tema,
    alto_contraste: usuario.alto_contraste,
    densidade: usuario.densidade,
    tamanho_fonte: usuario.tamanho_fonte,
  };
}

const sessaoInicial = lerSessaoSalva();

// Semeia a partir da sessao (fonte de verdade mais recente: o que o
// backend confirmou no ultimo login), nao so do cache local de
// preferencias -- um F5 com sessao ja aberta nao pode deixar a tela de
// Preferencias mostrando um valor desatualizado (ou os defaults, se o
// localStorage foi limpo) enquanto o banco tem outra coisa. A primeira
// alteracao do usuario reenviaria esse valor errado para o servidor.
if (sessaoInicial) {
  usePreferencias.getState().aplicar(preferenciasDoUsuario(sessaoInicial.usuario));
}

export const useAutenticacao = create<EstadoAutenticacao>((set) => ({
  token: sessaoInicial?.token ?? null,
  usuario: sessaoInicial?.usuario ?? null,
  autenticado: sessaoInicial !== null,
  motivoSaida: null,

  entrar: (resposta) => {
    const sessao: Sessao = { token: resposta.access_token, usuario: resposta.usuario };
    salvarSessao(sessao);
    usePreferencias.getState().aplicar(preferenciasDoUsuario(resposta.usuario));
    set({ ...sessao, autenticado: true, motivoSaida: null });
  },

  sair: (motivo = null) => {
    salvarSessao(null);
    // Preferencias sao por conta, nao por estacao -- um terminal
    // compartilhado do chao de fabrica nao deve mostrar o tema/contraste/
    // fonte do operador anterior na tela de login do proximo.
    usePreferencias.getState().aplicar(PREFERENCIAS_PADRAO);
    set({ token: null, usuario: null, autenticado: false, motivoSaida: motivo });
  },

  atualizarPreferenciasSessao: (preferencias) => {
    set((estado) => {
      if (!estado.usuario || !estado.token) return estado;
      const usuario: UsuarioSessao = { ...estado.usuario, ...preferencias };
      salvarSessao({ token: estado.token, usuario });
      return { usuario };
    });
  },
}));

/** Le o token fora do React (interceptador do axios). */
export function tokenAtual(): string | null {
  return useAutenticacao.getState().token;
}
