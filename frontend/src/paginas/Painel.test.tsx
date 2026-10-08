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
      { metodo: 'get', url: '/estoque/criticos', status: 200, corpo: { dados: [] } },
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

  it('o widget sem modulo ainda diz em que sprint o dado passa a existir', () => {
    renderizarComProvedores(<Painel />);

    expect(screen.getByText(/O módulo de produção entra na Sprint 6/)).toBeInTheDocument();
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

  it('nenhum widget mostra numero como se fosse medicao quando esta vazio', async () => {
    const { container } = renderizarComProvedores(<Painel />);

    // Espera os dados reais assentarem antes de contar, senao os widgets
    // ainda estao em "Verificando..." e nao tem data-widget-vazio.
    await screen.findByText('Nenhum pedido de compra em atraso.');
    await screen.findByText('Nenhum insumo em estoque crítico.');

    // `text-dado-lg` e a classe da quantidade em destaque.
    expect(container.querySelectorAll('.text-dado-lg')).toHaveLength(0);
    expect(container.querySelectorAll('[data-widget-vazio]').length).toBeGreaterThanOrEqual(3);
  });

  it('mostra o estado real da conexao', async () => {
    renderizarComProvedores(<Painel />);

    expect(await screen.findByText(/Operacional · ambiente test/)).toBeInTheDocument();
  });

  it('mostra "Nenhum insumo em estoque crítico." quando a lista vem vazia', async () => {
    servidor.responder([
      { metodo: 'get', url: '/saude', status: 200, corpo: saudeOk },
      { metodo: 'get', url: '/pedidos-compra/em-atraso', status: 200, corpo: { dados: [] } },
      { metodo: 'get', url: '/estoque/criticos', status: 200, corpo: { dados: [] } },
    ]);
    renderizarComProvedores(<Painel />);

    expect(await screen.findByText('Nenhum insumo em estoque crítico.')).toBeInTheDocument();
  });

  it('mostra a contagem de insumos criticos quando ha itens', async () => {
    servidor.responder([
      { metodo: 'get', url: '/saude', status: 200, corpo: saudeOk },
      { metodo: 'get', url: '/pedidos-compra/em-atraso', status: 200, corpo: { dados: [] } },
      { metodo: 'get', url: '/estoque/criticos', status: 200, corpo: { dados: [{ id: 1 }, { id: 2 }] } },
    ]);
    renderizarComProvedores(<Painel />);

    expect(await screen.findByText('2 insumos em estoque crítico.')).toBeInTheDocument();
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
