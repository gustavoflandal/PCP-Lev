import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { notaBase, pagina, rotasDeApoio } from '@/testes/fixturasRecebimento';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { NotasEntrada } from './NotasEntrada';

function renderizar() {
  return renderizarComProvedores(
    <Routes>
      <Route path="/notas-entrada" element={<NotasEntrada />} />
      <Route path="/notas-entrada/:id" element={<p>tela da nota</p>} />
    </Routes>,
    { rota: '/notas-entrada' },
  );
}

const previa = {
  arquivo_id: 'uuid-xml',
  pedido_compra_id: 1,
  cnpj_emitente: '11222333000181',
  nome_emitente: 'Eletronica Fornecedora',
  modelo: '55',
  serie: '1',
  numero: '777',
  chave_acesso: '31261011222333000181550010000007771000007770',
  data_emissao: '2026-10-22',
  cfop: '5102',
  valor_produtos: 590,
  valor_frete: 0,
  valor_seguro: 0,
  valor_desconto: 0,
  valor_ipi: 0,
  valor_icms_st: 0,
  valor_total: 590,
  nao_reconhecidos: 1,
  itens: [
    {
      numero_item: 1, codigo_fornecedor: 'PL-01', descricao: 'Placa', unidade: 'UN', cfop: '5102', quantidade: 10,
      valor_unitario: 50, valor_total: 500, fator_conversao: 1, quantidade_recebida: 10,
      parte_peca_id: 1, peca_codigo: 'PLACA', peca_descricao: 'Placa controladora', item_pedido_compra_id: 11,
      lotes: [{ numero_lote: 'L-A', quantidade: 10, validade: '2027-06-01' }],
    },
    {
      numero_item: 2, codigo_fornecedor: 'CX-M3', descricao: 'Parafuso M3 cx 100', unidade: 'CX', cfop: '5102', quantidade: 9,
      valor_unitario: 10, valor_total: 90, fator_conversao: 1, quantidade_recebida: 0, lotes: [],
    },
  ],
};

describe('NotasEntrada', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    entrarComoPerfil('GESTOR');
    useToasts.setState({ itens: [] });
  });

  it('lista as notas com situacao e filtra por status (mais recentes primeiro)', async () => {
    servidor.responder([
      ...rotasDeApoio(),
      {
        metodo: 'get', url: '/notas-entrada', status: 200,
        corpo: pagina([notaBase('Efetivada', [], { origem: 'XML' }), notaBase('Rascunho', [], { id: 6, numero: '102' })]),
      },
    ]);
    renderizar();

    expect(await screen.findByRole('link', { name: '101/1' })).toHaveAttribute('href', '/notas-entrada/5');
    const tabela = screen.getByRole('table', { name: 'Notas fiscais de entrada' });
    expect(within(tabela).getByText('Efetivada')).toBeInTheDocument();
    expect(within(tabela).getByText('XML')).toBeInTheDocument();
    expect(servidor.requisicoes.find((r) => r.url === '/notas-entrada')?.params).toMatchObject({ ordenar_por: 'data_entrada', ordem: 'desc' });

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'Conferida');
    await waitFor(() => expect(servidor.requisicoes.at(-1)?.params.status).toBe('Conferida'));
  });

  it('sem notas_entrada.lancar nao oferece nova nota nem importacao', async () => {
    entrarComoPerfil('CONSULTA');
    servidor.responder([{ metodo: 'get', url: '/notas-entrada', status: 200, corpo: pagina([]) }]);
    renderizar();

    expect(await screen.findByText('Nenhuma nota fiscal lançada.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova nota fiscal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Importar XML' })).not.toBeInTheDocument();
  });

  it('importar XML: item nao reconhecido e vinculado (de-para memorizado), o rascunho e criado e o XML anexado', async () => {
    servidor.responder([
      ...rotasDeApoio(),
      { metodo: 'get', url: '/notas-entrada', status: 200, corpo: pagina([]) },
      { metodo: 'post', url: '/notas-entrada/importar-xml', status: 200, corpo: { sucesso: true, dados: previa } },
      {
        metodo: 'post', url: '/fornecedores/1/de-para', status: 200,
        corpo: { sucesso: true, dados: { id: 9, fornecedor_id: 1, parte_peca_id: 3, peca_codigo: 'PARAFUSO', peca_descricao: 'Parafuso M3', codigo_fornecedor: 'CX-M3', descricao_fornecedor: 'Parafuso M3 cx 100', unidade_fornecedor: 'CX', fator_conversao: 100 } },
      },
      { metodo: 'post', url: '/notas-entrada', status: 201, corpo: { sucesso: true, dados: notaBase('Rascunho', [], { id: 8, origem: 'XML' }) } },
      { metodo: 'post', url: '/anexos', status: 201, corpo: { sucesso: true, dados: { id: 1 } } },
    ]);
    renderizar();
    await screen.findByText(/Nenhuma nota fiscal lançada/);

    await userEvent.click(screen.getByRole('button', { name: 'Importar XML' }));
    const modal = screen.getByRole('dialog', { name: 'Importar XML da NF-e' });
    await waitFor(() => expect(within(modal).getByRole('option', { name: /^PC-NF-1/ })).toBeInTheDocument());
    await userEvent.selectOptions(within(modal).getByLabelText(/^Pedido de compra/), '1');
    const arquivo = new File(['<nfeProc/>'], 'nfe-777.xml', { type: 'text/xml' });
    await userEvent.upload(within(modal).getByLabelText(/Arquivo XML da NF-e/), arquivo);
    await userEvent.click(within(modal).getByRole('button', { name: 'Ler XML' }));

    // Previa: o nao reconhecido fica destacado e bloqueia a criacao.
    const naoReconhecido = await within(modal).findByRole('listitem', { name: /Item 2 do XML — CX-M3/ });
    expect(within(naoReconhecido).getByText('Não reconhecido')).toBeInTheDocument();
    expect(within(modal).getByText(/1 item não reconhecido/)).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Criar rascunho' })).toBeDisabled();
    const pedidoLido = servidor.requisicoes.find((r) => r.url === '/notas-entrada/importar-xml')?.corpo as FormData;
    expect(pedidoLido.get('pedido_compra_id')).toBe('1');

    await userEvent.selectOptions(within(naoReconhecido).getByLabelText(/Peça do item CX-M3/), '3');
    await userEvent.clear(within(naoReconhecido).getByLabelText(/Fator — CX-M3/));
    await userEvent.type(within(naoReconhecido).getByLabelText(/Fator — CX-M3/), '100');
    await userEvent.click(within(naoReconhecido).getByRole('button', { name: 'Vincular e memorizar' }));

    expect(await within(modal).findByText('Vínculo memorizado para as próximas notas deste fornecedor.')).toBeInTheDocument();
    expect(servidor.requisicoes.find((r) => r.url === '/fornecedores/1/de-para')?.corpo).toEqual({
      parte_peca_id: 3,
      codigo_fornecedor: 'CX-M3',
      descricao_fornecedor: 'Parafuso M3 cx 100',
      unidade_fornecedor: 'CX',
      fator_conversao: 100,
    });
    expect(within(modal).getByText('PARAFUSO · fator 100 · recebe 900')).toBeInTheDocument();

    await userEvent.click(within(modal).getByRole('button', { name: 'Criar rascunho' }));

    await waitFor(() => expect(servidor.requisicoes.some((r) => r.url === '/anexos')).toBe(true));
    const criada = servidor.requisicoes.find((r) => r.metodo === 'post' && r.url === '/notas-entrada')?.corpo;
    expect(criada).toMatchObject({
      pedido_compra_id: 1,
      cnpj_emitente: '11222333000181',
      numero: '777',
      chave_acesso: previa.chave_acesso,
      itens: [
        { parte_peca_id: 1, item_pedido_compra_id: 11, quantidade_recebida: 10, lotes: [{ numero_lote: 'L-A', quantidade: 10, validade: '2027-06-01' }] },
        // Parafuso nao controla lote; 9 caixas x 100.
        { parte_peca_id: 3, item_pedido_compra_id: 13, codigo_fornecedor: 'CX-M3', unidade_nf: 'CX', quantidade_nf: 9, fator_conversao: 100, quantidade_recebida: 900, lotes: [] },
      ],
    });
    expect(servidor.requisicoes.find((r) => r.url === '/anexos')?.corpo).toMatchObject({
      entidade: 'nota_entrada',
      entidade_id: 8,
      arquivo_id: 'uuid-xml',
      tipo: 'ANEXO',
      categoria: 'XML da NF-e',
    });
    expect(await screen.findByText('tela da nota')).toBeInTheDocument();
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Rascunho criado a partir do XML');
  });

  it('XML de outro fornecedor: mostra a recusa da API (409)', async () => {
    servidor.responder([
      ...rotasDeApoio(),
      { metodo: 'get', url: '/notas-entrada', status: 200, corpo: pagina([]) },
      {
        metodo: 'post', url: '/notas-entrada/importar-xml', status: 409,
        corpo: { sucesso: false, erro: { codigo: 'CONFLITO', mensagem: 'o CNPJ do emitente da nota nao e o do fornecedor do pedido de compra' } },
      },
    ]);
    renderizar();
    await screen.findByText(/Nenhuma nota fiscal lançada/);

    await userEvent.click(screen.getByRole('button', { name: 'Importar XML' }));
    const modal = screen.getByRole('dialog', { name: 'Importar XML da NF-e' });
    await waitFor(() => expect(within(modal).getByRole('option', { name: /^PC-NF-1/ })).toBeInTheDocument());
    await userEvent.selectOptions(within(modal).getByLabelText(/^Pedido de compra/), '1');
    await userEvent.upload(within(modal).getByLabelText(/Arquivo XML da NF-e/), new File(['<x/>'], 'a.xml', { type: 'text/xml' }));
    await userEvent.click(within(modal).getByRole('button', { name: 'Ler XML' }));

    expect(await within(modal).findByRole('alert')).toHaveTextContent('nao e o do fornecedor do pedido');
  });
});
