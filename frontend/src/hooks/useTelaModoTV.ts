import { useCallback, useEffect, useRef, useState } from 'react';
import { useModoTV } from '@/store/modoTV';

export interface TelaModoTV {
  /** O navegador esta em tela cheia agora. */
  telaCheia: boolean;
  /** O navegador oferece tela cheia (Fullscreen API). */
  telaCheiaDisponivel: boolean;
  /** Liga o modo TV e pede a tela cheia (precisa vir de um clique). */
  entrar: () => void;
  /** Pede a tela cheia de novo (ex.: painel aberto pelo favorito da TV). */
  pedirTelaCheia: () => void;
  /** Sai da tela cheia (se estiver) e desliga o modo TV. */
  sair: () => void;
}

function emTelaCheia(): boolean {
  return typeof document !== 'undefined' && Boolean(document.fullscreenElement);
}

async function pedirTelaCheiaAoNavegador(): Promise<void> {
  try {
    await document.documentElement.requestFullscreen?.();
  } catch {
    // Navegador negou (sem gesto do usuario, politica do quiosque...): o
    // modo TV segue dentro da pagina, sem menu nem cabecalho.
  }
}

/**
 * Liga o modo TV da tela de painel enquanto `tv` (do endereco) estiver
 * ativo: avisa o Shell e a sessao (store modoTV), aumenta a fonte e cuida
 * da tela cheia. Esc ou "Sair do modo TV" saem; sair da tela cheia pelo
 * navegador (Esc em tela cheia nao chega a pagina) tambem sai do modo.
 */
export function useTelaModoTV(tv: boolean, definirTV: (tv: boolean) => void): TelaModoTV {
  const definirModo = useModoTV((estado) => estado.definir);
  const [telaCheia, setTelaCheia] = useState(emTelaCheia);
  const definirTVRef = useRef(definirTV);
  definirTVRef.current = definirTV;

  useEffect(() => {
    if (!tv) return;
    definirModo(true);
    const raiz = document.documentElement;
    raiz.dataset.modoTv = 'true';

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && !evento.defaultPrevented) definirTVRef.current(false);
    };
    window.addEventListener('keydown', aoTeclar);

    return () => {
      window.removeEventListener('keydown', aoTeclar);
      delete raiz.dataset.modoTv;
      definirModo(false);
    };
  }, [tv, definirModo]);

  useEffect(() => {
    let antes = emTelaCheia();
    const aoMudar = () => {
      const agora = emTelaCheia();
      setTelaCheia(agora);
      // Saiu da tela cheia pelo navegador: sai do modo TV junto.
      if (antes && !agora) definirTVRef.current(false);
      antes = agora;
    };
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);

  // Saindo do modo TV por qualquer caminho (Esc, botao, endereco), larga a
  // tela cheia que o modo tinha pedido.
  useEffect(() => {
    if (!tv && emTelaCheia()) void document.exitFullscreen?.().catch(() => undefined);
  }, [tv]);

  const entrar = useCallback(() => {
    definirTVRef.current(true);
    void pedirTelaCheiaAoNavegador();
  }, []);

  const pedirTelaCheia = useCallback(() => void pedirTelaCheiaAoNavegador(), []);

  const sair = useCallback(() => definirTVRef.current(false), []);

  return {
    telaCheia,
    telaCheiaDisponivel: typeof document !== 'undefined' && Boolean(document.fullscreenEnabled),
    entrar,
    pedirTelaCheia,
    sair,
  };
}
