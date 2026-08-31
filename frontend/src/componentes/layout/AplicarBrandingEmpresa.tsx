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
    // nome_fantasia com razao_social como reserva: so a razao social e
    // obrigatoria, entao o caminho minimo de configuracao precisa mudar o
    // titulo da aba mesmo sem nome fantasia preenchido.
    const nome = empresa?.nome_fantasia || empresa?.razao_social;
    if (nome) {
      document.title = nome;
    }
  }, [empresa?.nome_fantasia, empresa?.razao_social]);

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

    if (!empresa?.tem_favicon) {
      // Sem isto, remover o favicon deixava o <link> criado antes ainda
      // apontando para uma URL agora 404 -- so um F5 corrigia.
      link?.remove();
      return;
    }

    if (link) {
      link.href = urlFavicon(empresa.updated_at);
      return;
    }
    const novoLink = document.createElement('link');
    novoLink.rel = 'icon';
    novoLink.href = urlFavicon(empresa.updated_at);
    document.head.appendChild(novoLink);
  }, [empresa?.tem_favicon, empresa?.updated_at]);

  return null;
}
