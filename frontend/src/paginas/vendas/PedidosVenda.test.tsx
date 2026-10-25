import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { DetalhePedidoVenda } from './DetalhePedidoVenda';
import { FormularioPedidoVenda } from './FormularioPedidoVenda';
import { PedidosVenda } from './PedidosVenda';

function pagina<T>(dados: T[]) {
  return { sucesso: true, dados, paginacao: { pagina: 1, limite: 20, total: dados.length, total_paginas: 1 } };
}

const pedidoAtrasado = {
  id: 1,
  numero_pedido: 'PV-001',
  cliente_id: 7,
  cliente_nome: 'DER Teste',
  data_pedido: '2020-01-02',
  data_entrega_prometida: '2020-02-01',
  valor_total: 30000,
  status: 'Em Producao',
  observacoes: '',
  created_at: '2020-01-02T12:00:00Z',
  updated_at: '2020-01-02T12:00:00Z',
};

const pedidoEntregue = {
  ...pedidoAtrasado,
  id: 2,
  numero_pedido: 'PV-002',
  status: 'Entregue',
  data_entrega_real: '2020-01-30',
};

function detalhe(extra: Record<string, unknown> = {}) {
  return {
    ...pedidoAtrasado,
    status: 'Aberto',
    data_entrega_prometida: '2999-01-01',
    itens: [
      {
        id: 11,
        produto_acabado_id: 5,
        produto_codigo: 'RAD-200',
        produto_descricao: 'Radar fixo R-200',
        quantidade: 2,
        preco_unitario: 15000,
        total: 30000,
      },
    ],
    ...extra,
  };
}

describe('Pedidos de venda', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    entrarComoPerfil('VENDAS');
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
  });

  it('lista pedidos com cliente, valor, situacao e selo de atraso so no que nao foi entregue', async () => {
    servidor.responder([{ metodo: 'get', url: '/pedidos-venda', status: 200, corpo: pagina([pedidoAtrasado, pedidoEntregue]) }]);

    renderizarComProvedores(<PedidosVenda />);

    const tabela = await screen.findByRole('table', { name: 'Pedidos de venda' });
    await within(tabela).findByText('PV-001');
    const linhaAtrasada = within(tabela).getByText('PV-001').closest('tr')!;
    expect(within(linhaAtrasada).getByText('DER Teste')).toBeInTheDocument();
    expect(within(linhaAtrasada).getByText('Atrasado')).toBeInTheDocument();
    expect(within(linhaAtrasada).getByText('Em produção')).toBeInTheDocument();
    expect(within(linhaAtrasada).getByText(/30\.000,00/)).toBeInTheDocument();

    const linhaEntregue = within(tabela).getByText('PV-002').closest('tr')!;
    expect(within(linhaEntregue).queryByText('Atrasado')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo pedido de venda' })).toBeInTheDocument();

    expect(servidor.requisicoes[0].params).toMatchObject({ ordenar_por: 'data_entrega_prometida' });
  });

  it('filtra por situacao', async () => {
    servidor.responder([{ metodo: 'get', url: '/pedidos-venda', status: 200, corpo: pagina([pedidoAtrasado]) }]);
    renderizarComProvedores(<PedidosVenda />);
    await screen.findByText('PV-001');

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'Pronto para Envio');

    await waitFor(() =>
      expect(servidor.requisicoes.some((r) => r.params.status === 'Pronto para Envio')).toBe(true),
    );
  });

  it('cria um pedido com itens, preco pre-preenchido pelo produto e preco enviado como texto', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/clientes',
        status: 200,
        corpo: pagina([{ id: 7, razao_social: 'DER Teste', nome_fantasia: '', ativo: true }]),
      },
      {
        metodo: 'get',
        url: '/produtos-acabados',
        status: 200,
        corpo: pagina([
          { id: 5, codigo: 'RAD-200', descricao: 'Radar fixo R-200', preco_venda: 15000, ativo: true },
          { id: 6, codigo: 'PMV-10', descricao: 'Painel de mensagem', preco_venda: 8000.5, ativo: true },
        ]),
      },
      { metodo: 'post', url: '/pedidos-venda', status: 201, corpo: { sucesso: true, dados: detalhe({ id: 99 }) } },
    ]);

    renderizarComProvedores(
      <Routes>
        <Route path="/pedidos-venda/novo" element={<FormularioPedidoVenda />} />
        <Route path="/pedidos-venda/:id" element={<p>detalhe aberto</p>} />
      </Routes>,
      { rota: '/pedidos-venda/novo' },
    );

    await screen.findByRole('option', { name: 'DER Teste' });
    await screen.findAllByRole('option', { name: 'RAD-200 — Radar fixo R-200' });

    await userEvent.type(screen.getByLabelText(/Número do pedido/), 'pv-001');
    await userEvent.selectOptions(screen.getByLabelText(/^Cliente/), '7');
    await userEvent.clear(screen.getByLabelText(/Data do pedido/));
    await userEvent.type(screen.getByLabelText(/Data do pedido/), '2026-10-24');
    await userEvent.type(screen.getByLabelText(/Entrega prometida/), '2026-12-01');

    await userEvent.selectOptions(screen.getAllByLabelText(/Produto acabado/)[0], '5');
    await waitFor(() => expect(screen.getAllByLabelText(/Preço unitário/)[0]).toHaveValue('15000.00'));
    await userEvent.clear(screen.getAllByLabelText(/^Quantidade/)[0]);
    await userEvent.type(screen.getAllByLabelText(/^Quantidade/)[0], '2');

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    await userEvent.selectOptions(screen.getAllByLabelText(/Produto acabado/)[1], '6');
    await waitFor(() => expect(screen.getAllByLabelText(/Preço unitário/)[1]).toHaveValue('8000.50'));

    expect(screen.getByText(/38\.000,50/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('detalhe aberto')).toBeInTheDocument();
    const envio = servidor.requisicoes.find((r) => r.metodo === 'post');
    expect(envio?.corpo).toEqual({
      numero_pedido: 'pv-001',
      cliente_id: 7,
      data_pedido: '2026-10-24',
      data_entrega_prometida: '2026-12-01',
      observacoes: '',
      itens: [
        { produto_acabado_id: 5, quantidade: 2, preco_unitario: '15000.00' },
        { produto_acabado_id: 6, quantidade: 1, preco_unitario: '8000.50' },
      ],
    });
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Pedido de venda cadastrado');
  });

  it('nao envia com entrega antes do pedido nem produto repetido', async () => {
    servidor.responder([
      { metodo: 'get', url: '/clientes', status: 200, corpo: pagina([{ id: 7, razao_social: 'DER Teste', ativo: true }]) },
      {
        metodo: 'get',
        url: '/produtos-acabados',
        status: 200,
        corpo: pagina([{ id: 5, codigo: 'RAD-200', descricao: 'Radar', preco_venda: 100, ativo: true }]),
      },
    ]);
    renderizarComProvedores(<FormularioPedidoVenda />, { rota: '/pedidos-venda/novo' });
    await screen.findByRole('option', { name: 'DER Teste' });
    await screen.findAllByRole('option', { name: 'RAD-200 — Radar' });

    await userEvent.type(screen.getByLabelText(/Número do pedido/), 'PV-9');
    await userEvent.selectOptions(screen.getByLabelText(/^Cliente/), '7');
    await userEvent.clear(screen.getByLabelText(/Data do pedido/));
    await userEvent.type(screen.getByLabelText(/Data do pedido/), '2026-10-24');
    await userEvent.type(screen.getByLabelText(/Entrega prometida/), '2026-10-01');
    await userEvent.selectOptions(screen.getAllByLabelText(/Produto acabado/)[0], '5');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    await userEvent.selectOptions(screen.getAllByLabelText(/Produto acabado/)[1], '5');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('A entrega prometida precisa ser depois da data do pedido')).toBeInTheDocument();
    expect(screen.getByText(/O mesmo produto aparece em mais de um item/)).toBeInTheDocument();
    expect(servidor.requisicoes.some((r) => r.metodo === 'post')).toBe(false);
  });
});

describe('Edicao do pedido de venda', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    entrarComoPerfil('VENDAS');
    servidor = instalarServidorFalso();
  });

  function rotas() {
    return [
      { metodo: 'get' as const, url: '/clientes', status: 200, corpo: pagina([{ id: 7, razao_social: 'DER Teste', ativo: true }]) },
      {
        metodo: 'get' as const,
        url: '/produtos-acabados',
        status: 200,
        corpo: pagina([{ id: 5, codigo: 'RAD-200', descricao: 'Radar fixo R-200', preco_venda: 15000, ativo: true }]),
      },
      { metodo: 'get' as const, url: '/pedidos-venda/1', status: 200, corpo: { sucesso: true, dados: detalhe() } },
    ];
  }

  function renderizar() {
    return renderizarComProvedores(
      <Routes>
        <Route path="/pedidos-venda/:id/editar" element={<FormularioPedidoVenda />} />
      </Routes>,
      { rota: '/pedidos-venda/1/editar' },
    );
  }

  it('carrega o pedido e mostra a recusa 409 da API em alerta', async () => {
    servidor.responder([
      ...rotas(),
      {
        metodo: 'put',
        url: '/pedidos-venda/1',
        status: 409,
        corpo: {
          sucesso: false,
          erro: { codigo: 'CONFLITO', mensagem: 'um item deste pedido ja teve OP liberada -- o pedido nao pode mais ser editado' },
        },
      },
    ]);
    renderizar();

    expect(await screen.findByRole('heading', { name: 'Editar pedido PV-001' })).toBeInTheDocument();
    await screen.findByRole('option', { name: 'DER Teste' });
    expect(screen.getAllByLabelText(/Preço unitário/)[0]).toHaveValue('15000.00');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('ja teve OP liberada');
    expect(servidor.requisicoes.find((r) => r.metodo === 'put')?.corpo).toMatchObject({ numero_pedido: 'PV-001', cliente_id: 7 });
  });

  it('pedido com OP ativa nao abre o formulario', async () => {
    servidor.responder([
      ...rotas().slice(0, 2),
      {
        metodo: 'get',
        url: '/pedidos-venda/1',
        status: 200,
        corpo: { sucesso: true, dados: detalhe({ itens: [{ ...detalhe().itens[0], ordem_producao_id: 40, status_op: 'Aberta' }] }) },
      },
    ]);
    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('não pode mais ser editado');
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
  });
});

describe('Detalhe do pedido de venda', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    entrarComoPerfil('GESTOR');
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
    // O detalhe carrega os documentos (3.1): sem anexos, salvo quando o teste declara outros.
    const responder = servidor.responder;
    servidor.responder = (rotas) =>
      responder([...rotas, { metodo: 'get', url: '/anexos', status: 200, corpo: { sucesso: true, dados: [] } }]);
  });

  function renderizar() {
    return renderizarComProvedores(
      <Routes>
        <Route path="/pedidos-venda/:id" element={<DetalhePedidoVenda />} />
      </Routes>,
      { rota: '/pedidos-venda/1' },
    );
  }

  it('gera a OP do item (POST /ops com o item)', async () => {
    servidor.responder([
      { metodo: 'get', url: '/pedidos-venda/1', status: 200, corpo: { sucesso: true, dados: detalhe() } },
      { metodo: 'post', url: '/ops', status: 201, corpo: { sucesso: true, dados: { id: 40, numero_op: 'OP-2026-00001' } } },
    ]);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Gerar OP de RAD-200' }));
    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('OP OP-2026-00001 gerada'));
    const envio = servidor.requisicoes.find((r) => r.metodo === 'post');
    expect(envio?.corpo).toEqual({ item_pedido_venda_id: 11 });
  });

  it('item com OP mostra o link, a situacao e a etapa da OP, sem botao de gerar', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/pedidos-venda/1',
        status: 200,
        corpo: {
          sucesso: true,
          dados: detalhe({
            status: 'Em Producao',
            itens: [
              {
                ...detalhe().itens[0],
                ordem_producao_id: 40,
                numero_op: 'OP-2026-00001',
                status_op: 'Liberada',
                etapa_op: 'Separacao',
              },
            ],
          }),
        },
      },
    ]);
    renderizar();

    expect(await screen.findByRole('link', { name: 'OP-2026-00001' })).toHaveAttribute('href', '/producao/ops/40');
    expect(screen.getByText('Separação')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar OP/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar pedido' })).not.toBeInTheDocument();
  });

  it('409 sem BOM ativa mostra a mensagem da API', async () => {
    servidor.responder([
      { metodo: 'get', url: '/pedidos-venda/1', status: 200, corpo: { sucesso: true, dados: detalhe() } },
      {
        metodo: 'post',
        url: '/ops',
        status: 409,
        corpo: {
          sucesso: false,
          erro: { codigo: 'CONFLITO', mensagem: 'o produto nao tem estrutura (BOM) ativa -- cadastre antes de gerar a OP' },
        },
      },
    ]);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Gerar OP de RAD-200' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('o produto nao tem estrutura (BOM) ativa');
  });

  it('pronto para envio: registra a entrega com confirmacao', async () => {
    servidor.responder([
      { metodo: 'get', url: '/pedidos-venda/1', status: 200, corpo: { sucesso: true, dados: detalhe({ status: 'Pronto para Envio' }) } },
      { metodo: 'post', url: '/pedidos-venda/1/entregar', status: 200, corpo: { sucesso: true, dados: detalhe({ status: 'Entregue' }) } },
    ]);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Registrar entrega' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar entrega' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Entrega registrada'));
    expect(servidor.requisicoes.some((r) => r.metodo === 'post' && r.url === '/pedidos-venda/1/entregar')).toBe(true);
    // Sem botao de gerar OP fora de Aberto/Em Producao.
    expect(screen.queryByRole('button', { name: /Gerar OP/ })).not.toBeInTheDocument();
  });

  it('cancela o pedido com confirmacao', async () => {
    servidor.responder([
      { metodo: 'get', url: '/pedidos-venda/1', status: 200, corpo: { sucesso: true, dados: detalhe() } },
      { metodo: 'post', url: '/pedidos-venda/1/cancelar', status: 200, corpo: { sucesso: true, dados: detalhe({ status: 'Cancelado' }) } },
    ]);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar pedido' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar pedido' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Pedido de venda cancelado'));
  });

  it('consulta nao ve acoes', async () => {
    entrarComoPerfil('CONSULTA');
    servidor.responder([{ metodo: 'get', url: '/pedidos-venda/1', status: 200, corpo: { sucesso: true, dados: detalhe() } }]);
    renderizar();

    await screen.findByText('RAD-200');
    expect(screen.queryByRole('button', { name: /Gerar OP/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar pedido' })).not.toBeInTheDocument();
  });

  it('documentos: pedido entregue aceita anexo (termo de aceite) mas nao remove', async () => {
    servidor.responder([
      { metodo: 'get', url: '/pedidos-venda/1', status: 200, corpo: { sucesso: true, dados: detalhe({ status: 'Entregue' }) } },
      {
        metodo: 'get',
        url: '/anexos',
        status: 200,
        corpo: { sucesso: true, dados: [anexoDe('pedido_venda', 1, 'Contrato/Edital', 'Edital 12/2026')] },
      },
    ]);
    renderizar();

    const secao = await screen.findByRole('region', { name: 'Documentos do pedido' });
    expect(await within(secao).findByText('Edital 12/2026')).toBeInTheDocument();
    expect(within(secao).queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument();
    await userEvent.click(within(secao).getByRole('button', { name: 'Anexar documento' }));
    const opcoes = within(within(secao).getByRole('form', { name: 'Enviar documento' })).getAllByRole('option');
    expect(opcoes.map((o) => o.textContent)).toContain('Termo de Aceite');
  });

  it('documentos: pedido aberto permite remover', async () => {
    servidor.responder([
      { metodo: 'get', url: '/pedidos-venda/1', status: 200, corpo: { sucesso: true, dados: detalhe() } },
      {
        metodo: 'get',
        url: '/anexos',
        status: 200,
        corpo: { sucesso: true, dados: [anexoDe('pedido_venda', 1, 'Pedido do Cliente', 'Pedido assinado')] },
      },
    ]);
    renderizar();

    const secao = await screen.findByRole('region', { name: 'Documentos do pedido' });
    expect(await within(secao).findByRole('button', { name: 'Remover Pedido assinado' })).toBeInTheDocument();
  });
});

function anexoDe(entidade: string, entidadeId: number, categoria: string, titulo: string) {
  return {
    id: 5, entidade, entidade_id: entidadeId, tipo: 'ANEXO', categoria, titulo, descricao: '', versao: '',
    documento_chave: 5, vigente: true, principal: false, ordem: 0,
    arquivo: { id: 'uuid-5', sha256: 'a', nome_original: 'doc.pdf', tipo_mime: 'application/pdf', tamanho: 1024, tem_miniatura: false, created_at: '2026-10-24T12:00:00Z' },
    created_at: '2026-10-24T12:00:00Z',
    url: '/api/v1/arquivos/uuid-5/conteudo?exp=1&sig=x',
  };
}
