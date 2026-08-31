import { create } from 'zustand';
import { usePreferencias, type Densidade, type TamanhoFonte, type Tema } from './preferencias';

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
}

const sessaoInicial = lerSessaoSalva();

export const useAutenticacao = create<EstadoAutenticacao>((set) => ({
  token: sessaoInicial?.token ?? null,
  usuario: sessaoInicial?.usuario ?? null,
  autenticado: sessaoInicial !== null,
  motivoSaida: null,

  entrar: (resposta) => {
    const sessao: Sessao = { token: resposta.access_token, usuario: resposta.usuario };
    salvarSessao(sessao);
    usePreferencias.getState().aplicar({
      tema: resposta.usuario.tema,
      alto_contraste: resposta.usuario.alto_contraste,
      densidade: resposta.usuario.densidade,
      tamanho_fonte: resposta.usuario.tamanho_fonte,
    });
    set({ ...sessao, autenticado: true, motivoSaida: null });
  },

  sair: (motivo = null) => {
    salvarSessao(null);
    set({ token: null, usuario: null, autenticado: false, motivoSaida: motivo });
  },
}));

/** Le o token fora do React (interceptador do axios). */
export function tokenAtual(): string | null {
  return useAutenticacao.getState().token;
}
