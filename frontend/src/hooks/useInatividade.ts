import { useEffect, useRef } from 'react';

/** RNF3: a sessao expira apos 30 minutos de inatividade. */
export const MINUTOS_INATIVIDADE = 30;

const LIMITE_MS = MINUTOS_INATIVIDADE * 60 * 1000;

/**
 * Eventos que contam como presenca do operador. `visibilitychange` cobre o
 * caso de voltar para a aba depois de trabalhar em outra janela.
 */
const EVENTOS_DE_ATIVIDADE = [
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'visibilitychange',
] as const;

/**
 * Encerra a sessao apos o periodo sem interacao. So conta enquanto `ativo`,
 * para nao disparar na tela de login.
 *
 * `manterSessao` (modo TV dos paineis): a tela e de exibicao, ninguem toca
 * nela, entao a contagem fica suspensa -- mas so enquanto a aba estiver
 * visivel. Com a aba em segundo plano (outra janela na frente, monitor
 * desligado pelo sistema), a contagem volta a correr normalmente; ao voltar
 * a ficar visivel, suspende de novo. Sair do modo TV recomeca a contagem
 * do zero.
 */
export function useInatividade(aoExpirar: () => void, ativo = true, manterSessao = false): void {
  // Guardar a callback em ref evita reiniciar a contagem a cada re-render.
  const expirar = useRef(aoExpirar);
  expirar.current = aoExpirar;

  useEffect(() => {
    if (!ativo) return;

    let temporizador: ReturnType<typeof setTimeout>;

    const reiniciar = () => {
      clearTimeout(temporizador);
      if (manterSessao && document.visibilityState === 'visible') return;
      temporizador = setTimeout(() => expirar.current(), LIMITE_MS);
    };

    reiniciar();
    EVENTOS_DE_ATIVIDADE.forEach((evento) =>
      window.addEventListener(evento, reiniciar, { passive: true }),
    );

    return () => {
      clearTimeout(temporizador);
      EVENTOS_DE_ATIVIDADE.forEach((evento) => window.removeEventListener(evento, reiniciar));
    };
  }, [ativo, manterSessao]);
}
