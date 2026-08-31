import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { AplicarBrandingEmpresa } from './AplicarBrandingEmpresa';

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AplicarBrandingEmpresa />
    </QueryClientProvider>,
  );
}

describe('AplicarBrandingEmpresa', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    document.title = 'Sistema PCP';
    document.querySelectorAll('link[rel="icon"]').forEach((el) => el.remove());
  });

  it('nao cria favicon quando a empresa nao tem um configurado', async () => {
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { tem_favicon: false, nome_fantasia: 'Industria Sem Favicon' } } },
    ]);

    renderizar();

    // Ancora num titulo que so pode ter vindo da resposta da query -- o
    // beforeEach ja deixa document.title em 'Sistema PCP', entao esperar por
    // esse valor passaria antes mesmo da consulta resolver.
    await waitFor(() => expect(document.title).toBe('Industria Sem Favicon'));
    expect(document.querySelector('link[rel="icon"]')).toBeNull();
  });

  it('remove o link de favicon quando a empresa deixa de ter um configurado', async () => {
    const linkAntigo = document.createElement('link');
    linkAntigo.rel = 'icon';
    linkAntigo.href = '/api/v1/configuracoes/empresa/favicon?v=antigo';
    document.head.appendChild(linkAntigo);
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { tem_favicon: false, nome_fantasia: 'Industria Removeu Favicon' } } },
    ]);

    renderizar();

    await waitFor(() => expect(document.title).toBe('Industria Removeu Favicon'));
    expect(document.querySelector('link[rel="icon"]')).toBeNull();
  });

  it('cria o link de favicon apontando para o endpoint publico quando configurado', async () => {
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { tem_favicon: true, nome_fantasia: 'Industria VMS' } } },
    ]);

    renderizar();

    await waitFor(() => {
      const link = document.querySelector('link[rel="icon"]');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toContain('/configuracoes/empresa/favicon');
    });
  });

  it('atualiza o titulo da aba com o nome fantasia', async () => {
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { tem_favicon: false, nome_fantasia: 'Industria VMS' } } },
    ]);

    renderizar();

    await waitFor(() => expect(document.title).toBe('Industria VMS'));
  });

  it('usa a razao social no titulo quando o nome fantasia nao esta preenchido', async () => {
    // So a razao social e obrigatoria no cadastro -- o caminho minimo de
    // configuracao precisa mudar o titulo mesmo sem nome fantasia.
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { tem_favicon: false, nome_fantasia: '', razao_social: 'Industria de Paineis VMS Ltda' } } },
    ]);

    renderizar();

    await waitFor(() => expect(document.title).toBe('Industria de Paineis VMS Ltda'));
  });
});
