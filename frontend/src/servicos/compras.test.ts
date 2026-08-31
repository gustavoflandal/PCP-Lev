import { beforeEach, describe, expect, it } from 'vitest';
import { instalarServidorFalso, type ServidorFalso } from '@/testes/utilitarios';
import {
  cancelarCotacao,
  cancelarPedidoCompra,
  converterCotacaoEmPedido,
  criarCompra,
  emitirPedidoCompra,
  enviarCotacao,
  listar,
  listarNecessidadeCompra,
  listarPedidosEmAtraso,
  obterCompra,
  registrarRecebimentoPedidoCompra,
  registrarRespostaCotacao,
} from './compras';
import type { Cotacao, PedidoCompra } from '@/tipos/compras';

const parametros = {
  pagina: 1,
  limite: 20,
  ordenar_por: 'numero_cotacao',
  ordem: 'asc' as const,
  busca: '',
  status: null,
};

const cotacao: Cotacao = {
  id: 1,
  numero_cotacao: 'COT-2026-001',
  fornecedor_id: 1,
  data_emissao: '2026-08-25',
  data_validade: '2026-09-25',
  valor_total: 5000,
  status: 'Rascunho',
  itens: [{ id: 1, parte_peca_id: 1, quantidade: 100, preco_unitario: 50, total: 5000 }],
  created_at: '2026-08-25T12:00:00Z',
  updated_at: '2026-08-25T12:00:00Z',
};

const pedido: PedidoCompra = {
  id: 1,
  numero_pc: 'PC-2026-001',
  fornecedor_id: 1,
  data_pedido: '2026-08-25',
  data_entrega_prevista: '2026-09-25',
  valor_total: 5000,
  status: 'Rascunho',
  itens: [],
  created_at: '2026-08-25T12:00:00Z',
  updated_at: '2026-08-25T12:00:00Z',
};

const paginaVazia = {
  sucesso: true,
  dados: [],
  paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 },
};

describe('servico de compras', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
  });

  it('listar desembrulha o envelope em itens e paginacao', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/cotacoes',
        status: 200,
        corpo: { sucesso: true, dados: [cotacao], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } },
      },
    ]);

    const pagina = await listar<Cotacao>('cotacoes', parametros);

    expect(pagina.itens).toHaveLength(1);
    expect(pagina.itens[0].numero_cotacao).toBe('COT-2026-001');
  });

  it('listar omite busca vazia e status nulo da query', async () => {
    servidor.responder([{ metodo: 'get', url: '/cotacoes', status: 200, corpo: paginaVazia }]);

    await listar<Cotacao>('cotacoes', parametros);

    const enviados = servidor.requisicoes[0].params;
    expect(enviados).not.toHaveProperty('busca');
    expect(enviados).not.toHaveProperty('status');
    expect(enviados).toMatchObject({ pagina: 1, limite: 20, ordenar_por: 'numero_cotacao', ordem: 'asc' });
  });

  it('listar envia busca e status quando informados', async () => {
    servidor.responder([{ metodo: 'get', url: '/cotacoes', status: 200, corpo: paginaVazia }]);

    await listar<Cotacao>('cotacoes', { ...parametros, busca: 'COT-2026', status: 'Enviada' });

    expect(servidor.requisicoes[0].params).toMatchObject({ busca: 'COT-2026', status: 'Enviada' });
  });

  it('obter devolve o registro de dentro do envelope', async () => {
    servidor.responder([
      { metodo: 'get', url: '/cotacoes/1', status: 200, corpo: { sucesso: true, dados: cotacao } },
    ]);

    const encontrada = await obterCompra<Cotacao>('cotacoes', 1);

    expect(encontrada.id).toBe(1);
  });

  it('criarCompra envia o corpo e devolve o registro criado', async () => {
    servidor.responder([
      { metodo: 'post', url: '/cotacoes', status: 201, corpo: { sucesso: true, dados: cotacao } },
    ]);

    const criada = await criarCompra<Cotacao>('cotacoes', { numero_cotacao: 'COT-2026-001' });

    expect(servidor.requisicoes[0].corpo).toEqual({ numero_cotacao: 'COT-2026-001' });
    expect(criada.numero_cotacao).toBe('COT-2026-001');
  });

  it('enviarCotacao chama a rota de acao correta', async () => {
    servidor.responder([
      { metodo: 'post', url: '/cotacoes/1/enviar', status: 200, corpo: { sucesso: true, dados: { ...cotacao, status: 'Enviada' } } },
    ]);

    const enviada = await enviarCotacao(1);

    expect(enviada.status).toBe('Enviada');
  });

  it('registrarRespostaCotacao envia data e itens', async () => {
    servidor.responder([
      { metodo: 'post', url: '/cotacoes/1/registrar-resposta', status: 200, corpo: { sucesso: true, dados: { ...cotacao, status: 'Respondida' } } },
    ]);

    await registrarRespostaCotacao(1, { data_resposta: '2026-09-01', itens: [{ parte_peca_id: 1, preco_unitario: 48 }] });

    expect(servidor.requisicoes[0].corpo).toEqual({
      data_resposta: '2026-09-01',
      itens: [{ parte_peca_id: 1, preco_unitario: 48 }],
    });
  });

  it('converterCotacaoEmPedido chama converter-pc e devolve o PC criado', async () => {
    servidor.responder([
      { metodo: 'post', url: '/cotacoes/1/converter-pc', status: 201, corpo: { sucesso: true, dados: pedido } },
    ]);

    const criado = await converterCotacaoEmPedido(1, { numero_pc: 'PC-2026-001', data_entrega_prevista: '2026-10-01', condicao_pagamento: '30 dias' });

    expect(criado.numero_pc).toBe('PC-2026-001');
  });

  it('cancelarCotacao chama a rota de cancelar', async () => {
    servidor.responder([
      { metodo: 'post', url: '/cotacoes/1/cancelar', status: 200, corpo: { sucesso: true, dados: { ...cotacao, status: 'Cancelada' } } },
    ]);

    const cancelada = await cancelarCotacao(1);

    expect(cancelada.status).toBe('Cancelada');
  });

  it('emitirPedidoCompra chama a rota de emitir', async () => {
    servidor.responder([
      { metodo: 'post', url: '/pedidos-compra/1/emitir', status: 200, corpo: { sucesso: true, dados: { ...pedido, status: 'Emitido' } } },
    ]);

    const emitido = await emitirPedidoCompra(1);

    expect(emitido.status).toBe('Emitido');
  });

  it('cancelarPedidoCompra chama a rota de cancelar', async () => {
    servidor.responder([
      { metodo: 'post', url: '/pedidos-compra/1/cancelar', status: 200, corpo: { sucesso: true, dados: { ...pedido, status: 'Cancelado' } } },
    ]);

    const cancelado = await cancelarPedidoCompra(1);

    expect(cancelado.status).toBe('Cancelado');
  });

  it('registrarRecebimentoPedidoCompra envia POST para .../registrar-recebimento', async () => {
    servidor.responder([
      {
        metodo: 'post',
        url: '/pedidos-compra/1/registrar-recebimento',
        status: 200,
        corpo: { sucesso: true, dados: { ...pedido, status: 'Recebido Parcial' } },
      },
    ]);

    await registrarRecebimentoPedidoCompra(1, { itens: [{ parte_peca_id: 10, quantidade_recebida: 5 }] });

    expect(servidor.requisicoes[0].corpo).toEqual({ itens: [{ parte_peca_id: 10, quantidade_recebida: 5 }] });
  });

  it('listarPedidosEmAtraso desembrulha a lista sem paginacao', async () => {
    servidor.responder([
      { metodo: 'get', url: '/pedidos-compra/em-atraso', status: 200, corpo: { sucesso: true, dados: [pedido] } },
    ]);

    const emAtraso = await listarPedidosEmAtraso();

    expect(emAtraso).toHaveLength(1);
    expect(emAtraso[0].numero_pc).toBe('PC-2026-001');
  });

  it('listarNecessidadeCompra desembrulha a lista sem paginacao', async () => {
    servidor.responder([
      {
        metodo: 'get', url: '/necessidade-compra', status: 200,
        corpo: {
          sucesso: true,
          dados: [
            { parte_peca_id: 1, codigo: 'RES-10K', descricao: 'Resistor', saldo_atual: 2, estoque_minimo: 10, necessidade: 8, fornecedor_padrao_id: 5, fornecedor_padrao_nome: 'Fornecedor X' },
          ],
        },
      },
    ]);

    const itens = await listarNecessidadeCompra();

    expect(itens).toHaveLength(1);
    expect(itens[0].necessidade).toBe(8);
    expect(itens[0].fornecedor_padrao_nome).toBe('Fornecedor X');
  });

  it('erro da API chega normalizado como ErroApi', async () => {
    servidor.responder([
      {
        metodo: 'post',
        url: '/cotacoes',
        status: 409,
        corpo: { sucesso: false, erro: { codigo: 'CONFLITO', mensagem: 'ja existe uma cotacao com este numero' } },
      },
    ]);

    await expect(criarCompra<Cotacao>('cotacoes', {})).rejects.toMatchObject({
      codigo: 'CONFLITO',
      message: 'ja existe uma cotacao com este numero',
    });
  });
});
