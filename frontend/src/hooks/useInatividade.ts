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
 */
export function useInatividade(aoExpirar: () => void, ativo = true): void {
  // Guardar a callback em ref evita reiniciar a contagem a cada re-render.
  const expirar = useRef(aoExpirar);
  expirar.current = aoExpirar;

  useEffect(() => {
    if (!ativo) return;

    let temporizador: ReturnType<typeof setTimeout>;

    const reiniciar = () => {
      clearTimeout(temporizador);
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
  }, [ativo]);
}
