import { useEffect } from 'react';
import { useDadosEmpresa } from '@/hooks/useDadosEmpresa';
import { urlFavicon } from '@/servicos/empresa';

/**
 * Sem UI propria -- so mantem o titulo da aba e o favicon do navegador
 * acompanhando os dados da empresa. Montado uma vez em App.tsx, fora das
 * rotas: vale tanto logado quanto na tela de login, que precisa do favicon
 * antes de qualquer sessao existir.
 */
export function AplicarBrandingEmpresa() {
  const { data: empresa } = useDadosEmpresa();

  useEffect(() => {
    if (empresa?.nome_fantasia) {
      document.title = empresa.nome_fantasia;
    }
  }, [empresa?.nome_fantasia]);

  useEffect(() => {
    if (!empresa?.tem_favicon) return;

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = urlFavicon();
  }, [empresa?.tem_favicon]);

  return null;
}
