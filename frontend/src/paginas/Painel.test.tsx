import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { useAutenticacao } from '@/store/autenticacao';
import { Painel } from './Painel';

const saudeOk = { sucesso: true, dados: { status: 'ok', ambiente: 'test' } };

describe('Painel', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    servidor = instalarServidorFalso();
    servidor.responder([
      { metodo: 'get', url: '/saude', status: 200, corpo: saudeOk },
      { metodo: 'get', url: '/pedidos-compra/em-atraso', status: 200, corpo: { sucesso: true, dados: [] } },
    ]);
  });

  it('anuncia a tela', () => {
    renderizarComProvedores(<Painel />);

    expect(screen.getByRole('heading', { name: 'Painel', level: 1 })).toBeInTheDocument();
  });

  it('mostra os quatro widgets do RF6.1', () => {
    renderizarComProvedores(<Painel />);

    expect(screen.getByRole('heading', { name: 'Ordens de produção em atraso' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pedidos de compra em atraso' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Insumos em nível crítico' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conexão com o servidor' })).toBeInTheDocument();
  });

  it('os widgets sem modulo ainda dizem em que sprint o dado passa a existir', () => {
    renderizarComProvedores(<Painel />);

    expect(screen.getByText(/O módulo de produção entra na Sprint 6/)).toBeInTheDocument();
    expect(screen.getByText(/O controle de estoque entra na Sprint 3/)).toBeInTheDocument();
  });

  it('pedidos de compra em atraso mostra dado real, nao mais um placeholder', async () => {
    servidor.responder([
      { metodo: 'get', url: '/saude', status: 200, corpo: saudeOk },
      {
        metodo: 'get',
        url: '/pedidos-compra/em-atraso',
        status: 200,
        corpo: { sucesso: true, dados: [{ id: 1, numero_pc: 'PC-2026-001' }, { id: 2, numero_pc: 'PC-2026-002' }] },
      },
    ]);

    renderizarComProvedores(<Painel />);

    expect(await screen.findByText('2 pedidos de compra em atraso.')).toBeInTheDocument();
  });

  it('sem pedidos em atraso, o widget convida com uma frase, nao um numero zerado', async () => {
    renderizarComProvedores(<Painel />);

    expect(await screen.findByText('Nenhum pedido de compra em atraso.')).toBeInTheDocument();
  });

  it('os dois widgets sem modulo ainda continuam vazios de proposito', () => {
    const { container } = renderizarComProvedores(<Painel />);

    // `text-dado-lg` e a classe da quantidade em destaque. Enquanto nao houver
    // dado real, nenhum widget pode mostrar numero como se fosse medicao.
    expect(container.querySelectorAll('.text-dado-lg')).toHaveLength(0);
    expect(container.querySelectorAll('[data-widget-vazio]').length).toBeGreaterThanOrEqual(2);
  });

  it('mostra o estado real da conexao', async () => {
    renderizarComProvedores(<Painel />);

    expect(await screen.findByText(/Operacional · ambiente test/)).toBeInTheDocument();
  });

  it('servidor fora do ar aparece como falha', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/saude',
        status: 503,
        corpo: { sucesso: false, erro: { codigo: 'INDISPONIVEL', mensagem: 'Banco de dados indisponivel' } },
      },
    ]);

    renderizarComProvedores(<Painel />);

    expect(await screen.findByText(/Servidor indisponível/)).toBeInTheDocument();
  });
});
