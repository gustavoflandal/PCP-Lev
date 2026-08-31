import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
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

  it('mostra o historico de versoes antigas', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados/1', status: 200, corpo: PRODUTO },
      {
        metodo: 'get', url: '/produtos-acabados/1/boms', status: 200,
        corpo: {
          sucesso: true,
          dados: [
            { id: 20, versao: 2, data_vigencia_inicio: '2026-10-01', ativo: true, itens: [] },
            { id: 10, versao: 1, data_vigencia_inicio: '2026-09-01', data_vigencia_fim: '2026-09-30', ativo: false, itens: [] },
          ],
        },
      },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: PECAS },
    ]);
    renderizar();

    expect(await screen.findByText('Histórico')).toBeInTheDocument();
    expect(screen.getByText(/Versão 1 — 01\/09\/2026 até 30\/09\/2026/)).toBeInTheDocument();
  });
});
