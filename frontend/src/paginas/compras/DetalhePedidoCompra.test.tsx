import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { DetalhePedidoCompra } from './DetalhePedidoCompra';

const navegar = vi.fn();
vi.mock('react-router-dom', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('react-router-dom')>();
  return { ...original, useNavigate: () => navegar };
});

const paginaFornecedores = {
  sucesso: true,
  dados: [{ id: 1, razao_social: 'Componentes Silva Ltda', ativo: true }],
  paginacao: { pagina: 1, limite: 200, total: 1, total_paginas: 1 },
};

const paginaPecas = {
  sucesso: true,
  dados: [{ id: 1, codigo: 'RES-10K', descricao: 'Resistor', ativo: true }],
  paginacao: { pagina: 1, limite: 200, total: 1, total_paginas: 1 },
};

function pedidoBase(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: 1,
    numero_pc: 'PC-2026-001',
    fornecedor_id: 1,
    data_pedido: '2026-08-25',
    data_entrega_prevista: '2026-09-25',
    valor_total: 5000,
    status,
    itens: [{ id: 1, parte_peca_id: 1, quantidade_solicitada: 100, quantidade_recebida: 0, preco_unitario: 50, total: 5000 }],
    created_at: '2026-08-25T12:00:00Z',
    updated_at: '2026-08-25T12:00:00Z',
    ...extra,
  };
}

function renderizar() {
  return renderizarComProvedores(
    <Routes>
      <Route path="/pedidos-compra/:id" element={<DetalhePedidoCompra />} />
    </Routes>,
    { rota: '/pedidos-compra/1' },
  );
}

describe('DetalhePedidoCompra', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    navegar.mockClear();
    entrarComoPerfil('GESTOR');
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
  });

  it('em Rascunho, Emitir muda o status', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase('Rascunho') } },
      { metodo: 'post', url: '/pedidos-compra/1/emitir', status: 200, corpo: { sucesso: true, dados: pedidoBase('Emitido') } },
    ]);
    renderizar();
    await screen.findByText('PC-2026-001');

    await userEvent.click(screen.getByRole('button', { name: /Emitido/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Emitir' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Pedido de compra emitido'));
  });

  it('emissao recusada pela alcada mostra o motivo da API', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase('Rascunho') } },
      {
        metodo: 'post', url: '/pedidos-compra/1/emitir', status: 403,
        corpo: { sucesso: false, erro: { codigo: 'ACESSO_NEGADO', mensagem: 'o valor do pedido esta acima da alcada do Gestor' } },
      },
    ]);
    renderizar();
    await screen.findByText('PC-2026-001');

    await userEvent.click(screen.getByRole('button', { name: /Emitido/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Emitir' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toMatch(/alcada do Gestor/));
    expect(useToasts.getState().itens[0]?.tom).toBe('pending');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancelar pede confirmacao antes de agir', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase('Emitido') } },
    ]);
    renderizar();
    await screen.findByText('PC-2026-001');

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));

    expect(screen.getByRole('dialog', { name: 'Cancelar pedido de compra' })).toBeInTheDocument();
  });

  it('mostra o link para a cotacao de origem quando existe', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      {
        metodo: 'get',
        url: '/pedidos-compra/1',
        status: 200,
        corpo: { sucesso: true, dados: pedidoBase('Emitido', { cotacao_id: 7 }) },
      },
    ]);
    renderizar();
    await screen.findByText('PC-2026-001');

    expect(screen.getByRole('link', { name: /Ver cotação de origem/ })).toHaveAttribute('href', '/cotacoes/7');
  });

  it('mostra a condicao de pagamento quando informada', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      {
        metodo: 'get',
        url: '/pedidos-compra/1',
        status: 200,
        corpo: { sucesso: true, dados: pedidoBase('Emitido', { condicao_pagamento: '30 dias' }) },
      },
    ]);
    renderizar();

    expect(await screen.findByText(/30 dias/)).toBeInTheDocument();
  });

  it('pedido cancelado mostra o aviso em vez da trilha', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase('Cancelado') } },
    ]);
    renderizar();

    expect(await screen.findByText(/Pedido cancelado/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /Status/ })).not.toBeInTheDocument();
  });

  it('pedido concluido nao mostra o botao de cancelar', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase('Concluido') } },
    ]);
    renderizar();
    await screen.findByText('PC-2026-001');

    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
  });

  it('mostra a etapa Concluido como acionavel quando aguardando entrega', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      {
        metodo: 'get',
        url: '/pedidos-compra/1',
        status: 200,
        corpo: { sucesso: true, dados: pedidoBase('Aguardando Entrega') },
      },
    ]);
    renderizar();

    expect(await screen.findByRole('button', { name: /Concluído/ })).toHaveAttribute('aria-current', 'step');
  });

  it('aguardando entrega: "Lancar nota fiscal" abre a nota nova com o pedido (RN-001: sem recebimento direto)', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase('Aguardando Entrega') } },
      { metodo: 'get', url: '/notas-entrada', status: 200, corpo: { sucesso: true, dados: [], paginacao: { pagina: 1, limite: 50, total: 0, total_paginas: 0 } } },
    ]);
    renderizar();
    await screen.findByText('PC-2026-001');

    expect(screen.queryByRole('button', { name: /Registrar recebimento/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lançar nota fiscal' }));
    expect(navegar).toHaveBeenCalledWith('/notas-entrada/nova?pedido=1');

    // A etapa "Concluido" (acionavel) leva ao mesmo lugar.
    navegar.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /Concluído/ }));
    expect(navegar).toHaveBeenCalledWith('/notas-entrada/nova?pedido=1');
    expect(await screen.findByText(/Nenhuma nota lançada para este pedido/)).toBeInTheDocument();
  });

  it('lista as notas fiscais do pedido com link e situacao', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase('Recebido Parcial') } },
      {
        metodo: 'get',
        url: '/notas-entrada',
        status: 200,
        corpo: {
          sucesso: true,
          dados: [{ id: 7, serie: '1', numero: '4521', data_entrada: '2026-10-20', valor_total: 2000, status: 'Efetivada', pedido_compra_id: 1 }],
          paginacao: { pagina: 1, limite: 50, total: 1, total_paginas: 1 },
        },
      },
    ]);
    renderizar();

    expect(await screen.findByRole('link', { name: 'NF 4521/1' })).toHaveAttribute('href', '/notas-entrada/7');
    expect(screen.getByText('Efetivada')).toBeInTheDocument();
    expect(servidor.requisicoes.find((r) => r.url === '/notas-entrada')?.params).toMatchObject({ pedido_compra_id: '1' });
  });

  it('encerrar com saldo pendente exige motivo de 10 a 255 caracteres e envia', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase('Recebido Parcial') } },
      { metodo: 'get', url: '/notas-entrada', status: 200, corpo: { sucesso: true, dados: [], paginacao: { pagina: 1, limite: 50, total: 0, total_paginas: 0 } } },
      { metodo: 'post', url: '/pedidos-compra/1/encerrar', status: 200, corpo: { sucesso: true, dados: pedidoBase('Concluido') } },
    ]);
    renderizar();
    await screen.findByText('PC-2026-001');

    await userEvent.click(screen.getByRole('button', { name: 'Encerrar com saldo pendente' }));
    const modal = screen.getByRole('dialog', { name: 'Encerrar com saldo pendente' });
    const confirmar = within(modal).getByRole('button', { name: 'Encerrar pedido' });
    await userEvent.type(within(modal).getByLabelText(/Motivo do encerramento/), 'curto');
    expect(confirmar).toBeDisabled();
    await userEvent.type(within(modal).getByLabelText(/Motivo do encerramento/), ' — fornecedor descontinuou');
    await userEvent.click(confirmar);

    await waitFor(() =>
      expect(servidor.requisicoes.find((r) => r.url === '/pedidos-compra/1/encerrar')?.corpo).toEqual({
        motivo: 'curto — fornecedor descontinuou',
      }),
    );
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Pedido de compra encerrado');
  });

  it('sem pedidos_compra.encerrar nem notas_entrada.lancar, nao oferece encerrar nem lancar nota', async () => {
    entrarComoPerfil('CONSULTA');
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      { metodo: 'get', url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase('Aguardando Entrega') } },
      { metodo: 'get', url: '/notas-entrada', status: 200, corpo: { sucesso: true, dados: [], paginacao: { pagina: 1, limite: 50, total: 0, total_paginas: 0 } } },
    ]);
    renderizar();
    await screen.findByText('PC-2026-001');

    expect(screen.queryByRole('button', { name: 'Encerrar com saldo pendente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lançar nota fiscal' })).not.toBeInTheDocument();
  });

  it('mostra o motivo de encerramento quando o pedido foi encerrado com saldo', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaPecas },
      {
        metodo: 'get',
        url: '/pedidos-compra/1',
        status: 200,
        corpo: { sucesso: true, dados: pedidoBase('Concluido', { motivo_encerramento: 'fornecedor faliu', encerrado_por: 'gestor' }) },
      },
    ]);
    renderizar();

    expect(await screen.findByText(/Encerrado com saldo pendente por gestor\. Motivo: fornecedor faliu/)).toBeInTheDocument();
  });
});

describe('DetalhePedidoCompra — documentos (3.1)', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    entrarComoPerfil('COMPRADOR');
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
  });

  function rotas(status: string) {
    return [
      { metodo: 'get' as const, url: '/fornecedores', status: 200, corpo: paginaFornecedores },
      { metodo: 'get' as const, url: '/partes-pecas', status: 200, corpo: paginaPecas },
      {
        metodo: 'get' as const,
        url: '/notas-entrada',
        status: 200,
        corpo: { sucesso: true, dados: [], paginacao: { pagina: 1, limite: 50, total: 0, total_paginas: 0 } },
      },
      { metodo: 'get' as const, url: '/pedidos-compra/1', status: 200, corpo: { sucesso: true, dados: pedidoBase(status) } },
      {
        metodo: 'get' as const,
        url: '/anexos',
        status: 200,
        corpo: { sucesso: true, dados: [anexoDe('pedido_compra', 1, 'Proposta/Cotação', 'Proposta comercial')] },
      },
    ];
  }

  it('pedido em andamento: anexa e remove', async () => {
    servidor.responder(rotas('Aguardando Entrega'));
    renderizar();

    const secao = await screen.findByRole('region', { name: 'Documentos do pedido' });
    expect(await within(secao).findByText('Proposta comercial')).toBeInTheDocument();
    expect(within(secao).getByRole('button', { name: 'Remover Proposta comercial' })).toBeInTheDocument();
    await userEvent.click(within(secao).getByRole('button', { name: 'Anexar documento' }));
    const categorias = within(within(secao).getByRole('form', { name: 'Enviar documento' })).getAllByRole('option');
    expect(categorias.map((o) => o.textContent)).toEqual(['Escolha a categoria', 'Proposta/Cotação', 'Pedido Assinado', 'Comunicação', 'Outro']);
  });

  it('pedido concluido: documentos ficam, sem remover', async () => {
    servidor.responder(rotas('Concluido'));
    renderizar();

    const secao = await screen.findByRole('region', { name: 'Documentos do pedido' });
    expect(await within(secao).findByText('Proposta comercial')).toBeInTheDocument();
    expect(within(secao).getByText(/Registro encerrado/)).toBeInTheDocument();
    expect(within(secao).queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument();
  });

  it('sem pedidos_compra.editar a secao e so consulta', async () => {
    entrarComoPerfil('ALMOXARIFE');
    servidor.responder(rotas('Aguardando Entrega'));
    renderizar();

    const secao = await screen.findByRole('region', { name: 'Documentos do pedido' });
    expect(await within(secao).findByText('Proposta comercial')).toBeInTheDocument();
    expect(within(secao).queryByRole('button', { name: 'Anexar documento' })).not.toBeInTheDocument();
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
