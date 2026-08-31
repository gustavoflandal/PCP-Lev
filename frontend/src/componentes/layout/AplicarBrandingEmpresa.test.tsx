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

  it('nao mexe no favicon quando a empresa nao tem um configurado', async () => {
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { tem_favicon: false, nome_fantasia: '' } } },
    ]);

    renderizar();

    await waitFor(() => expect(document.title).toBe('Sistema PCP'));
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
});
