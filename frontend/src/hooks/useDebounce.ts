import { useEffect, useState } from 'react';

/**
 * Adia um valor. Usado na busca das listagens: sem isso, cada tecla dispara
 * uma requisicao e a rede da fabrica nao aguenta o ritmo da digitacao.
 */
export function useDebounce<T>(valor: T, atraso = 300): T {
  const [adiado, setAdiado] = useState(valor);

  useEffect(() => {
    const temporizador = setTimeout(() => setAdiado(valor), atraso);
    return () => clearTimeout(temporizador);
  }, [valor, atraso]);

  return adiado;
}
