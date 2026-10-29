import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PREFERENCIAS_PADRAO, usePreferencias } from '@/store/preferencias';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { DetalheEstruturaProduto } from './DetalheEstruturaProduto';

const PRODUTO = { sucesso: true, dados: { id: 1, codigo: 'VMS-01', descricao: 'Painel de velocidade', ativo: true } };
const PECAS = {
  sucesso: true,
  dados: [{ id: 1, codigo: 'RES-10K', descricao: 'Resistor', ativo: true }],
  paginacao: { pagina: 1, limite: 200, total: 1, total_paginas: 1 },
};

function renderizar() {
  return renderizarComProvedores(
    <Routes>
      <Route path="/estrutura-produtos/:produtoId" element={<DetalheEstruturaProduto />} />
    </Routes>,
    { rota: '/estrutura-produtos/1' },
  );
}

describe('DetalheEstruturaProduto', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    entrarComoPerfil('GESTOR');
  });

  it('sem estrutura ativa mostra "Criar estrutura"', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1', status: 200, corpo: PRODUTO },
      { metodo: 'get', url: '/produtos-acabados/1/boms', status: 200, corpo: { sucesso: true, dados: [] } },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
    ]);
    renderizar();

    expect(await screen.findByRole('button', { name: 'Criar estrutura' })).toBeInTheDocument();
    expect(screen.getByText('Este produto ainda não tem estrutura cadastrada.')).toBeInTheDocument();
  });

  it('com estrutura ativa mostra os itens e "Nova versão"', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1', status: 200, corpo: PRODUTO },
      {
        metodo: 'get', url: '/produtos-acabados/1/boms', status: 200,
        corpo: { sucesso: true, dados: [{ id: 10, versao: 1, data_vigencia_inicio: '2026-09-01', ativo: true, itens: [{ id: 1, parte_peca_id: 1, quantidade: 4 }] }] },
      },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
    ]);
    renderizar();

    expect(await screen.findByRole('button', { name: 'Nova versão' })).toBeInTheDocument();
    expect(screen.getByText('RES-10K')).toBeInTheDocument();
  });

  const DUAS_VERSOES = {
    sucesso: true,
    dados: [
      { id: 20, versao: 2, data_vigencia_inicio: '2026-10-01', ativo: true, itens: [{ id: 3, parte_peca_id: 1, quantidade: 6 }] },
      { id: 10, versao: 1, data_vigencia_inicio: '2026-09-01', data_vigencia_fim: '2026-09-30', ativo: false, itens: [{ id: 1, parte_peca_id: 1, quantidade: 4 }] },
    ],
  };

  it('lista todas as versoes, com a vigente identificada', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1', status: 200, corpo: PRODUTO },
      { metodo: 'get', url: '/produtos-acabados/1/boms', status: 200, corpo: DUAS_VERSOES },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
    ]);
    renderizar();

    const tabela = await screen.findByRole('table', { name: 'Versões da estrutura' });
    expect(tabela).toHaveTextContent('v.2');
    expect(tabela).toHaveTextContent('v.1');
    expect(tabela).toHaveTextContent('01/09/2026 até 30/09/2026');
    expect(tabela).toHaveTextContent('Vigente');
    expect(tabela).toHaveTextContent('Anterior');
  });

  it('o painel mostra a versao mais recente e troca ao escolher outra', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1', status: 200, corpo: PRODUTO },
      { metodo: 'get', url: '/produtos-acabados/1/boms', status: 200, corpo: DUAS_VERSOES },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
    ]);
    renderizar();

    expect(await screen.findByRole('heading', { name: /^Versão 2/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver itens da versão 1' }));

    expect(screen.getByRole('heading', { name: /^Versão 1/ })).toBeInTheDocument();
    expect(screen.getByText('Não vigente')).toBeInTheDocument();
  });

  it('define uma versao anterior como vigente', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1', status: 200, corpo: PRODUTO },
      { metodo: 'get', url: '/produtos-acabados/1/boms', status: 200, corpo: DUAS_VERSOES },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
      { metodo: 'post', url: '/boms/10/ativar', status: 200, corpo: { sucesso: true, dados: { id: 10, versao: 1, ativo: true } } },
    ]);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Definir a versão 1 como vigente' }));

    await waitFor(() => expect(servidor.requisicoes.find((r) => r.url === '/boms/10/ativar')).toBeTruthy());
    // A vigente nao oferece o botao.
    expect(screen.queryByRole('button', { name: 'Definir a versão 2 como vigente' })).not.toBeInTheDocument();
  });

  it('quem so visualiza nao ve o botao de definir vigente', async () => {
    entrarComoPerfil('OPERADOR');
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1', status: 200, corpo: PRODUTO },
      { metodo: 'get', url: '/produtos-acabados/1/boms', status: 200, corpo: DUAS_VERSOES },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
    ]);
    renderizar();

    await screen.findByRole('table', { name: 'Versões da estrutura' });
    expect(screen.queryByRole('button', { name: /como vigente/ })).not.toBeInTheDocument();
  });
});

describe('DetalheEstruturaProduto (espanhol)', () => {
  beforeEach(() => {
    entrarComoPerfil('GESTOR');
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'es' });
  });
  afterEach(() => {
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'pt-BR' });
  });

  it('mostra a estrutura e o historico de versoes em espanhol', async () => {
    const servidor = instalarServidorFalso();
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1', status: 200, corpo: PRODUTO },
      {
        metodo: 'get', url: '/produtos-acabados/1/boms', status: 200,
        corpo: {
          sucesso: true,
          dados: [
            { id: 20, versao: 2, data_vigencia_inicio: '2026-10-01', ativo: true, itens: [{ id: 3, parte_peca_id: 1, quantidade: 6 }] },
            { id: 10, versao: 1, data_vigencia_inicio: '2026-09-01', data_vigencia_fim: '2026-09-30', ativo: false, itens: [] },
          ],
        },
      },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
    ]);
    renderizar();

    expect(await screen.findByRole('button', { name: 'Nueva versión' })).toBeInTheDocument();
    expect(screen.getByText('Versiones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Definir la versión 1 como vigente' })).toBeInTheDocument();
    expect(screen.getByText('Anterior')).toBeInTheDocument();
    expect(screen.queryByText('Versões')).not.toBeInTheDocument();
  });
});
