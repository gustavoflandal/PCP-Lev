import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutenticacao } from '@/store/autenticacao';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import { Cabecalho } from './Cabecalho';

const navegar = vi.fn();
vi.mock('react-router-dom', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('react-router-dom')>();
  return { ...original, useNavigate: () => navegar };
});

const respostaLogin = {
  access_token: 'token-abc',
  token_type: 'Bearer',
  expires_in: 28800,
  usuario: {
    id: 1, username: 'admin', nome: 'Gustavo Landal', perfil: 'GESTOR' as const,
    tema: 'automatico' as const, alto_contraste: false, densidade: 'confortavel' as const, tamanho_fonte: 'padrao' as const,
  },
};

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Cabecalho />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Cabecalho', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    navegar.mockClear();
    sessionStorage.clear();
    useAutenticacao.getState().entrar(respostaLogin);
    servidor = instalarServidorFalso();
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { tem_logo_claro: false, tem_logo_escuro: false, nome_fantasia: '' } } },
    ]);
  });

  it('identifica quem esta operando o sistema', () => {
    renderizar();

    expect(screen.getByText('Gustavo Landal')).toBeInTheDocument();
  });

  it('mostra o perfil com rotulo textual, nao apenas por cor', () => {
    renderizar();

    expect(screen.getByText('Gestor')).toBeInTheDocument();
  });

  it('encerra a sessao ao sair', async () => {
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(useAutenticacao.getState().autenticado).toBe(false);
  });

  it('sair manualmente nao registra motivo de expiracao', async () => {
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(useAutenticacao.getState().motivoSaida).toBeNull();
  });

  it('e um cabecalho de pagina para a navegacao por leitor de tela', () => {
    renderizar();

    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('Preferencias navega para a tela de preferencias', async () => {
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Preferências' }));

    expect(navegar).toHaveBeenCalledWith('/preferencias');
  });

  it('mostra o nome padrao quando a empresa nao tem nome fantasia configurado', () => {
    renderizar();

    expect(screen.getByText('Sistema PCP')).toBeInTheDocument();
  });

  it('mostra o nome fantasia da empresa quando configurado', async () => {
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { tem_logo_claro: false, tem_logo_escuro: false, nome_fantasia: 'Industria VMS' } } },
    ]);

    renderizar();

    expect(await screen.findByText('Industria VMS')).toBeInTheDocument();
  });
});
