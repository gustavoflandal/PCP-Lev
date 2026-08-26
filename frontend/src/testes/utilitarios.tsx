import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

/** Renderiza com os provedores reais da aplicacao — sem repetir em cada teste. */
export function renderizarComProvedores(elemento: ReactElement): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{elemento}</MemoryRouter>
    </QueryClientProvider>,
  );
}
