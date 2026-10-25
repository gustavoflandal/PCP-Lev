import { create } from 'zustand';

/**
 * Modo TV dos paineis. A tela do painel liga ao montar com `?tv=1` e desliga
 * ao desmontar; quem esta fora dela reage:
 * - Shell esconde o cabecalho e a navegacao lateral;
 * - RotaProtegida suspende o encerramento por inatividade (com a aba
 *   visivel -- ver useInatividade).
 * Nao persiste: o modo vive no endereco da tela (favorito da TV).
 */
interface EstadoModoTV {
  ativo: boolean;
  definir: (ativo: boolean) => void;
}

export const useModoTV = create<EstadoModoTV>((set) => ({
  ativo: false,
  definir: (ativo) => set({ ativo }),
}));
