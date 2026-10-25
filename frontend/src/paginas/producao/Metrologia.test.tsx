import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { Metrologia } from './Metrologia';

describe('Metrologia', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    entrarComoPerfil('QUALIDADE');
    servidor = instalarServidorFalso();
  });

  it('lista vencidas e a vencer e troca o periodo', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/metrologia/vencimentos',
        status: 200,
        corpo: {
          sucesso: true,
          dados: [
            { serie_id: 1, numero: 'RAD-200-2026-00001', produto_codigo: 'RAD-200', produto_descricao: 'Radar', cliente_nome: 'DER', numero_lacre: 'L-1', validade: '2026-01-01', vencida: true },
            { serie_id: 2, numero: 'RAD-200-2026-00002', produto_codigo: 'RAD-200', produto_descricao: 'Radar', cliente_nome: 'DER', numero_lacre: 'L-2', validade: '2026-11-01', vencida: false },
          ],
        },
      },
    ]);
    renderizarComProvedores(<Metrologia />);

    const tabela = await screen.findByRole('table', { name: 'Vencimentos de metrologia' });
    await within(tabela).findByText('RAD-200-2026-00001');
    expect(within(within(tabela).getByText('RAD-200-2026-00001').closest('tr')!).getByText('Vencida')).toBeInTheDocument();
    expect(within(within(tabela).getByText('RAD-200-2026-00002').closest('tr')!).getByText('A vencer')).toBeInTheDocument();
    expect(servidor.requisicoes[0].params).toEqual({ dias: 30 });

    await userEvent.selectOptions(screen.getByLabelText('Período'), '90');
    await waitFor(() => expect(servidor.requisicoes.some((r) => r.params.dias === 90)).toBe(true));
  });
});
