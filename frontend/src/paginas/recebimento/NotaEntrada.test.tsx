import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { itemNota, notaBase, rotasDeApoio } from '@/testes/fixturasRecebimento';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type RotaFalsa, type ServidorFalso } from '@/testes/utilitarios';
import { NotaEntrada } from './NotaEntrada';

function renderizar(rota: string) {
  return renderizarComProvedores(
    <Routes>
      <Route path="/notas-entrada/nova" element={<NotaEntrada />} />
      <Route path="/notas-entrada/:id" element={<NotaEntrada />} />
    </Routes>,
    { rota },
  );
}

function rotasDaNota(nota: unknown, pendencias: unknown[] = []): RotaFalsa[] {
  return [
    ...rotasDeApoio(),
    { metodo: 'get', url: /\/notas-entrada\/5$/, status: 200, corpo: { sucesso: true, dados: nota } },
    { metodo: 'get', url: '/notas-entrada/5/pendencias', status: 200, corpo: { sucesso: true, dados: pendencias } },
  ];
}

describe('NotaEntrada', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    entrarComoPerfil('GESTOR');
    useToasts.setState({ itens: [] });
  });

  it('nota nova com o pedido da URL: item com lote soma os lotes em tempo real e o rascunho salva o corpo certo', async () => {
    const salva = notaBase('Rascunho', [itemNota(1, 1)]);
    servidor.responder([
      ...rotasDaNota(salva),
      { metodo: 'post', url: '/notas-entrada', status: 201, corpo: { sucesso: true, dados: salva } },
    ]);
    renderizar('/notas-entrada/nova?pedido=1');

    expect(await screen.findByRole('heading', { name: 'Nova nota fiscal de entrada' })).toBeInTheDocument();
    // Fornecedor e CNPJ vem do pedido.
    expect(await screen.findByText('11.222.333/0001-81')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^Número/), '101');
    await userEvent.type(screen.getByLabelText(/^Chave de acesso/), '312610112223');
    expect(screen.getByText(/12 de 44 dígitos — obrigatória na NF-e/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/^Chave de acesso/));

    await waitFor(() => expect(screen.getByRole('option', { name: /^PLACA — Placa controladora \(pendente 10 de 10/ })).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText(/^Item do pedido/), '11');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));

    const item = screen.getByRole('article', { name: 'Item 1 — PLACA' });
    expect(within(item).getByText('Lote e validade')).toBeInTheDocument();
    expect(within(item).getByText('Soma dos lotes: 0 de 10')).toBeInTheDocument();

    await userEvent.click(within(item).getByRole('button', { name: 'Adicionar lote' }));
    await userEvent.click(within(item).getByRole('button', { name: 'Adicionar lote' }));
    await userEvent.type(within(item).getByLabelText(/^Lote 1 — número/), 'L-A');
    await userEvent.type(within(item).getByLabelText(/^Lote 1 — quantidade/), '6');
    fireEvent.change(within(item).getByLabelText(/^Lote 1 — validade/), { target: { value: '2027-05-01' } });
    expect(within(item).getByText('Soma dos lotes: 6 de 10')).toBeInTheDocument();
    await userEvent.type(within(item).getByLabelText(/^Lote 2 — número/), 'L-B');
    await userEvent.type(within(item).getByLabelText(/^Lote 2 — quantidade/), '4');
    expect(within(item).getByText('Soma dos lotes: 10 de 10')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

    await waitFor(() => expect(servidor.requisicoes.find((r) => r.metodo === 'post' && r.url === '/notas-entrada')).toBeDefined());
    const corpo = servidor.requisicoes.find((r) => r.metodo === 'post' && r.url === '/notas-entrada')?.corpo;
    expect(corpo).toMatchObject({
      pedido_compra_id: 1,
      cnpj_emitente: '11222333000181',
      modelo: '55',
      serie: '1',
      numero: '101',
      chave_acesso: '',
      itens: [
        {
          item_pedido_compra_id: 11,
          parte_peca_id: 1,
          quantidade_nf: 10,
          quantidade_recebida: 10,
          valor_unitario: 50,
          valor_total: 500,
          fator_conversao: 1,
          bonificacao: false,
          lotes: [
            { numero_lote: 'L-A', quantidade: 6, validade: '2027-05-01', data_fabricacao: null, certificado_arquivo_id: null },
            { numero_lote: 'L-B', quantidade: 4, validade: null, data_fabricacao: null, certificado_arquivo_id: null },
          ],
          series: [],
        },
      ],
    });
    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Rascunho salvo'));
    // Foi para a nota salva.
    expect(await screen.findByRole('heading', { name: 'NF 101/1' })).toBeInTheDocument();
  });

  it('series por bipagem continua e colagem, com contador; conferir com pendencias (409) mostra os tres niveis', async () => {
    const nota = notaBase('Rascunho', [itemNota(1, 2)]);
    servidor.responder([
      ...rotasDaNota(nota, [{ item_ordem: 1, tipo: 'SERIE', nivel: 'BLOQUEIO', mensagem: '0 de 3 series informadas' }]),
      {
        metodo: 'put', url: '/notas-entrada/5', status: 200,
        corpo: { sucesso: true, dados: notaBase('Rascunho', [itemNota(1, 2, { series: [{ numero: 'SN-0001' }, { numero: 'SN-0002' }, { numero: 'SN-0003' }] })]) },
      },
      {
        metodo: 'post', url: '/notas-entrada/5/conferir', status: 409,
        corpo: {
          sucesso: false,
          erro: {
            codigo: 'PENDENCIAS_NA_NOTA',
            mensagem: 'a nota tem pendencias -- corrija antes de conferir/efetivar',
            detalhes: [
              { campo: 'item 1', mensagem: '[BLOQUEIO] serie SN-0003 ja existe para esta peca' },
              { campo: 'item 1', mensagem: '[APROVACAO] preco unitario R$ 22.0000 diverge 10.0% do pedido (R$ 20.00), acima da tolerancia de 2.0%' },
              { campo: 'item 1', mensagem: '[AVISO] recebido 3, nota declara 4 (x 1) -- a diferenca fica pendente com o fornecedor' },
            ],
          },
        },
      },
    ]);
    renderizar('/notas-entrada/5');

    const item = await screen.findByRole('article', { name: 'Item 1 — CONECTOR' });
    // Pendencias da nota salva aparecem ao abrir.
    expect(await screen.findByText(/0 de 3 series informadas/)).toBeInTheDocument();
    expect(within(item).getByText('0 de 3 séries informadas')).toBeInTheDocument();

    const bipagem = within(item).getByLabelText(/Bipar ou digitar série/);
    await userEvent.click(bipagem);
    await userEvent.keyboard('SN-0001{Enter}');
    expect(within(item).getByText('1 de 3 séries informadas')).toBeInTheDocument();
    expect(bipagem).toHaveValue('');
    expect(bipagem).toHaveFocus();
    // Repetida e ignorada.
    await userEvent.keyboard('SN-0001{Enter}');
    expect(within(item).getByText(/Série SN-0001 já informada/)).toBeInTheDocument();

    await userEvent.click(within(item).getByRole('button', { name: 'Colar lista' }));
    await userEvent.type(within(item).getByLabelText(/Séries coladas/), 'SN-0002{Enter}SN-0003');
    await userEvent.click(within(item).getByRole('button', { name: 'Adicionar lista' }));
    expect(within(item).getByText('3 de 3 séries informadas')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Conferir' }));

    // Mudou: salva antes de conferir.
    await waitFor(() => expect(servidor.requisicoes.some((r) => r.url === '/notas-entrada/5/conferir')).toBe(true));
    const put = servidor.requisicoes.find((r) => r.metodo === 'put');
    expect((put?.corpo as { itens: { series: unknown }[] }).itens[0].series).toEqual([
      { numero: 'SN-0001' },
      { numero: 'SN-0002' },
      { numero: 'SN-0003' },
    ]);
    const conferencia = await screen.findByRole('region', { name: 'Conferência' });
    expect(within(conferencia).getByRole('region', { name: 'Bloqueios' })).toHaveTextContent('Item 1: serie SN-0003 ja existe para esta peca');
    expect(within(conferencia).getByRole('region', { name: 'Exigem aprovação' })).toHaveTextContent('diverge 10.0%');
    expect(within(conferencia).getByRole('region', { name: 'Avisos' })).toHaveTextContent('pendente com o fornecedor');
  });

  it('nota conferida sem pendencias: efetivar da entrada no estoque e a nota fica so leitura com quem efetivou', async () => {
    const conferida = notaBase('Conferida', [itemNota(1, 3, { quantidade_nf: 9, fator_conversao: 100, quantidade_recebida: 900, unidade_nf: 'CX' })]);
    servidor.responder([
      ...rotasDaNota(conferida, []),
      {
        metodo: 'post', url: '/notas-entrada/5/efetivar', status: 200,
        corpo: { sucesso: true, dados: { ...conferida, status: 'Efetivada', efetivada_por: 'almox', efetivada_em: '2026-10-24T13:00:00Z' } },
      },
    ]);
    renderizar('/notas-entrada/5');

    expect(await screen.findByText('Nenhuma pendência: a nota pode ser conferida.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Efetivar nota' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Nota efetivada — estoque atualizado'));
    expect(await screen.findByText('Efetivada por')).toBeInTheDocument();
    expect(screen.getAllByText('almox').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/^Número/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Efetivar nota' })).not.toBeInTheDocument();
  });

  it('divergencia que exige aprovacao: sem a permissao, avisa e nao deixa efetivar', async () => {
    entrarComoPerfil('ALMOXARIFE');
    servidor.responder(
      rotasDaNota(notaBase('Conferida', [itemNota(1, 3)]), [
        { item_ordem: 1, tipo: 'PRECO', nivel: 'APROVACAO', mensagem: 'preco unitario diverge 10.0% do pedido' },
      ]),
    );
    renderizar('/notas-entrada/5');

    expect(await screen.findByText(/a efetivação precisa de quem tem a permissão "Aprovar divergência de preço"/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Efetivar nota' })).toBeDisabled();
  });

  it('nota efetivada: estorno pede motivo e mostra a recusa (409) quando o material ja foi consumido', async () => {
    servidor.responder([
      ...rotasDaNota(notaBase('Efetivada', [itemNota(1, 3)], { efetivada_por: 'almox', divergencia_aprovada_por: 'gestor' })),
      {
        metodo: 'post', url: '/notas-entrada/5/estornar', status: 409,
        corpo: {
          sucesso: false,
          erro: {
            codigo: 'CONFLITO',
            mensagem: 'o material desta nota ja foi reservado, consumido ou movimentado -- corrija por ajuste de inventario justificado',
          },
        },
      },
    ]);
    renderizar('/notas-entrada/5');

    expect(await screen.findByText('Divergência de preço aprovada por gestor')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Estornar nota' }));
    const modal = screen.getByRole('dialog', { name: 'Estornar nota fiscal' });
    const estornar = within(modal).getByRole('button', { name: 'Estornar' });
    expect(estornar).toBeDisabled();
    await userEvent.type(within(modal).getByLabelText(/Motivo do estorno/), 'nota lançada no pedido errado');
    await userEvent.click(estornar);

    expect(await within(modal).findByRole('alert')).toHaveTextContent('ja foi reservado, consumido ou movimentado');
    expect(servidor.requisicoes.find((r) => r.url === '/notas-entrada/5/estornar')?.corpo).toEqual({ motivo: 'nota lançada no pedido errado' });
  });

  it('bonificacao: item sem pedido, com justificativa e valor zero', async () => {
    const nota = notaBase('Rascunho', []);
    servidor.responder([
      ...rotasDaNota(nota),
      { metodo: 'put', url: '/notas-entrada/5', status: 200, corpo: { sucesso: true, dados: nota } },
    ]);
    renderizar('/notas-entrada/5');

    await waitFor(() => expect(screen.getByRole('option', { name: /^PARAFUSO — Parafuso M3$/ })).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText(/^Bonificação \(peça sem pedido\)/), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar bonificação' }));
    const item = screen.getByRole('article', { name: 'Item 1 — PARAFUSO' });
    expect(within(item).getByText('Bonificação (sem pedido)')).toBeInTheDocument();
    await userEvent.type(within(item).getByLabelText(/^Quantidade na nota/), '5');
    await userEvent.type(within(item).getByLabelText(/^Quantidade recebida/), '5');
    await userEvent.type(within(item).getByLabelText(/^Justificativa da bonificação/), 'amostra enviada pelo fornecedor');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

    await waitFor(() => expect(servidor.requisicoes.some((r) => r.metodo === 'put')).toBe(true));
    expect((servidor.requisicoes.find((r) => r.metodo === 'put')?.corpo as { itens: unknown[] }).itens[0]).toMatchObject({
      item_pedido_compra_id: null,
      parte_peca_id: 3,
      bonificacao: true,
      justificativa_bonificacao: 'amostra enviada pelo fornecedor',
      valor_unitario: 0,
      valor_total: 0,
      quantidade_recebida: 5,
    });
  });

  it('nota alterada por outra pessoa (409 CONFLITO ao efetivar): mostra o motivo e recarrega a nota', async () => {
    const conferida = notaBase('Conferida', [itemNota(1, 3)], { versao: 3 });
    servidor.responder([
      ...rotasDaNota(conferida, []),
      {
        metodo: 'post', url: '/notas-entrada/5/efetivar', status: 409,
        corpo: { sucesso: false, erro: { codigo: 'CONFLITO', mensagem: 'a nota foi alterada por outra pessoa enquanto voce conferia' } },
      },
    ]);
    renderizar('/notas-entrada/5');

    await screen.findByText('Nenhuma pendência: a nota pode ser conferida.');
    const leiturasAntes = servidor.requisicoes.filter((r) => r.metodo === 'get' && r.url === '/notas-entrada/5').length;
    await userEvent.click(screen.getByRole('button', { name: 'Efetivar nota' }));

    expect(await screen.findByText(/alterada por outra pessoa enquanto voce conferia\. A nota foi recarregada/)).toBeInTheDocument();
    await waitFor(() =>
      expect(servidor.requisicoes.filter((r) => r.metodo === 'get' && r.url === '/notas-entrada/5').length).toBeGreaterThan(leiturasAntes),
    );
  });
});
