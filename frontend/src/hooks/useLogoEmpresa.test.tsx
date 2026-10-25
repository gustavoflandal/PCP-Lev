import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { usePreferencias, PREFERENCIAS_PADRAO } from '@/store/preferencias';
import { useLogoEmpresa } from './useLogoEmpresa';

function envolver({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useLogoEmpresa', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    usePreferencias.setState({ preferencias: PREFERENCIAS_PADRAO });
  });

  it('usa o logo claro no tema claro quando os dois existem', async () => {
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { tem_logo_claro: true, tem_logo_escuro: true, nome_fantasia: 'Industria VMS' } } },
    ]);

    const { result } = renderHook(() => useLogoEmpresa(), { wrapper: envolver });

    await waitFor(() => expect(result.current.temLogo).toBe(true));
    expect(result.current.url).toContain('/logotipo/claro');
  });

  it('cai para o logo claro quando so o claro foi configurado e o tema e escuro', async () => {
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, tema: 'escuro' });
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { tem_logo_claro: true, tem_logo_escuro: false, nome_fantasia: 'Industria VMS' } } },
    ]);

    const { result } = renderHook(() => useLogoEmpresa(), { wrapper: envolver });

    // Sem o fallback, ninguem em tema escuro veria logo nenhum, mesmo a
    // empresa tendo configurado um (so nao na variante "certa").
    await waitFor(() => expect(result.current.temLogo).toBe(true));
    expect(result.current.url).toContain('/logotipo/claro');
  });

  it('nao mostra logo quando nenhuma variante foi configurada', async () => {
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { tem_logo_claro: false, tem_logo_escuro: false, nome_fantasia: 'Industria VMS' } } },
    ]);

    const { result } = renderHook(() => useLogoEmpresa(), { wrapper: envolver });

    await waitFor(() => expect(result.current.nomeExibido).toBe('Industria VMS'));
    expect(result.current.temLogo).toBe(false);
  });

  it('usa a razao social quando o nome fantasia nao esta preenchido', async () => {
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { tem_logo_claro: false, tem_logo_escuro: false, nome_fantasia: '', razao_social: 'Industria de Paineis VMS Ltda' } } },
    ]);

    const { result } = renderHook(() => useLogoEmpresa(), { wrapper: envolver });

    await waitFor(() => expect(result.current.nomeExibido).toBe('Industria de Paineis VMS Ltda'));
  });

  it('usa o nome padrao quando a empresa ainda nao foi configurada', () => {
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { tem_logo_claro: false, tem_logo_escuro: false, nome_fantasia: '', razao_social: '' } } },
    ]);

    const { result } = renderHook(() => useLogoEmpresa(), { wrapper: envolver });

    expect(result.current.nomeExibido).toBe('Sistema PCP');
  });
});
