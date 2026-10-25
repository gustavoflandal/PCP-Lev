import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { hojeAAAAMMDD } from '@/tipos/producao';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { Lotes } from './Lotes';
import { RastreioLote } from './RastreioLote';

function emDias(dias: number): string {
  const d = new Date(`${hojeAAAAMMDD()}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function lote(id: number, numero: string, validade: string | null, extra: Record<string, unknown> = {}) {
  return {
    id, parte_peca_id: 1, peca_codigo: 'PLACA', peca_descricao: 'Placa controladora', numero_lote: numero,
    fornecedor_nome: 'Placas SA', validade, quantidade_atual: 10, quantidade_reservada: 2, vencido: false, ...extra,
  };
}

function renderizar(rota: string) {
  return renderizarComProvedores(
    <Routes>
      <Route path="/lotes" element={<Lotes />} />
      <Route path="/lotes/:id" element={<RastreioLote />} />
    </Routes>,
    { rota },
  );
}

describe('Lotes', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    entrarComoPerfil('CONSULTA');
  });

  it('lista com selo de vencido / a vencer / valido e filtros na consulta', async () => {
    servidor.responder([
      {
        metodo: 'get', url: '/lotes', status: 200,
        corpo: {
          sucesso: true,
          dados: [
            lote(1, 'L-VENCIDO', '2020-01-01', { vencido: true }),
            lote(2, 'L-PERTO', emDias(10)),
            lote(3, 'L-LONGE', emDias(400)),
            lote(4, 'L-SEM', null),
          ],
        },
      },
    ]);
    renderizar('/lotes');

    expect(await screen.findByRole('link', { name: 'L-VENCIDO' })).toHaveAttribute('href', '/lotes/1');
    const tabela = screen.getByRole('table', { name: 'Lotes' });
    expect(within(tabela).getByText('Vencido')).toBeInTheDocument();
    expect(within(tabela).getByText('Vence em 10 dias')).toBeInTheDocument();
    expect(within(tabela).getByText('Válido')).toBeInTheDocument();
    expect(within(tabela).getByText('Sem validade')).toBeInTheDocument();
    // Padrao: so com saldo.
    expect(servidor.requisicoes[0].params).toMatchObject({ com_saldo: 'true' });

    await userEvent.selectOptions(screen.getByLabelText('Vencimento'), '30');
    await waitFor(() => expect(servidor.requisicoes.at(-1)?.params).toMatchObject({ vencendo_dias: 30, com_saldo: 'true' }));
    await userEvent.click(screen.getByLabelText('Só lotes com saldo'));
    await waitFor(() => expect(servidor.requisicoes.at(-1)?.params.com_saldo).toBeUndefined());
  });

  it('rastreabilidade do lote: entradas, OPs que consumiram e unidades produzidas ate o cliente', async () => {
    servidor.responder([
      {
        metodo: 'get', url: '/lotes/4/rastreabilidade', status: 200,
        corpo: {
          sucesso: true,
          dados: {
            lote: lote(4, 'L-77', '2027-05-01'),
            entradas: [{ nota_id: 5, numero: '101', serie: '1', data_entrada: '2026-10-20', fornecedor_nome: 'Placas SA', quantidade: 10 }],
            consumos: [{ ordem_producao_id: 40, numero_op: 'OP-2026-00001', quantidade: 4, produto_codigo: 'RAD-200' }],
            unidades: [
              { serie_id: 101, numero: 'RAD-200-2026-00001', status: 'Expedido', produto_codigo: 'RAD-200', numero_op: 'OP-2026-00001',
                pedido_venda_id: 1, numero_pedido: 'PV-001', cliente_nome: 'DER Teste', direta: true },
              { serie_id: 102, numero: 'RAD-200-2026-00002', status: 'Em Estoque', produto_codigo: 'RAD-200', numero_op: 'OP-2026-00001',
                pedido_venda_id: 1, numero_pedido: 'PV-001', cliente_nome: 'DER Teste', direta: false },
            ],
          },
        },
      },
    ]);
    renderizar('/lotes/4');

    expect(await screen.findByRole('heading', { name: 'L-77' })).toBeInTheDocument();
    const entradas = screen.getByRole('region', { name: 'Entradas' });
    expect(within(entradas).getByRole('link', { name: 'NF 101/1' })).toHaveAttribute('href', '/notas-entrada/5');
    const consumos = screen.getByRole('region', { name: 'Consumo em ordens de produção' });
    expect(within(consumos).getByRole('link', { name: 'OP-2026-00001' })).toHaveAttribute('href', '/producao/ops/40');
    const unidades = screen.getByRole('region', { name: 'Unidades produzidas' });
    expect(within(unidades).getByRole('link', { name: 'RAD-200-2026-00001' })).toHaveAttribute('href', '/rastreabilidade/RAD-200-2026-00001');
    expect(within(unidades).getAllByRole('link', { name: 'PV-001' })[0]).toHaveAttribute('href', '/pedidos-venda/1');
    expect(within(unidades).getByText('Direta — série instalada')).toBeInTheDocument();
    expect(within(unidades).getByText('Pela OP')).toBeInTheDocument();
    expect(within(unidades).getAllByText('DER Teste')).toHaveLength(2);
  });

  it('lote inexistente avisa', async () => {
    servidor.responder([
      { metodo: 'get', url: '/lotes/9/rastreabilidade', status: 404, corpo: { sucesso: false, erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'lote nao encontrado' } } },
    ]);
    renderizar('/lotes/9');

    expect(await screen.findByRole('alert')).toHaveTextContent('Lote não encontrado.');
  });
});
