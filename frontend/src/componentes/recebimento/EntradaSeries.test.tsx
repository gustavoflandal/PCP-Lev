import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { SerieItem } from '@/tipos/notasEntrada';
import { EntradaSeries } from './EntradaSeries';

function Envelope({ esperado, lotes, inicial = [] }: { esperado: number; lotes?: string[]; inicial?: SerieItem[] }) {
  const [series, definirSeries] = useState<SerieItem[]>(inicial);
  return (
    <>
      <EntradaSeries rotulo="CONECTOR" series={series} esperado={esperado} lotes={lotes} aoMudar={definirSeries} focarAoAbrir />
      <output data-testid="series">{JSON.stringify(series)}</output>
    </>
  );
}

const lidas = () => JSON.parse(screen.getByTestId('series').textContent ?? '[]') as SerieItem[];

describe('EntradaSeries', () => {
  it('bipagem continua: Enter adiciona, limpa o campo e mantem o foco', async () => {
    render(<Envelope esperado={50} />);
    const campo = screen.getByLabelText(/Bipar ou digitar série/);
    expect(campo).toHaveFocus();

    await userEvent.keyboard('SN-1001{Enter}SN-1002{Enter}');

    expect(campo).toHaveValue('');
    expect(campo).toHaveFocus();
    expect(lidas()).toEqual([{ numero: 'SN-1001' }, { numero: 'SN-1002' }]);
    expect(screen.getByText('2 de 50 séries informadas')).toBeInTheDocument();
  });

  it('gera faixa sequencial com prefixo (SN-1001 a SN-1038) e conta 38 de 50', async () => {
    render(<Envelope esperado={50} />);

    await userEvent.click(screen.getByRole('button', { name: 'Gerar faixa' }));
    await userEvent.type(screen.getByLabelText('Prefixo'), 'SN-');
    await userEvent.type(screen.getByLabelText('Início'), '1001');
    await userEvent.type(screen.getByLabelText('Fim'), '1038');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar faixa' }));

    expect(screen.getByText('38 de 50 séries informadas')).toBeInTheDocument();
    expect(lidas()[0]).toEqual({ numero: 'SN-1001' });
    expect(lidas()[37]).toEqual({ numero: 'SN-1038' });
  });

  it('faixa invalida explica o que corrigir e nao adiciona nada', async () => {
    render(<Envelope esperado={5} />);

    await userEvent.click(screen.getByRole('button', { name: 'Gerar faixa' }));
    await userEvent.type(screen.getByLabelText('Início'), '10');
    await userEvent.type(screen.getByLabelText('Fim'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar faixa' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Faixa inválida');
    expect(lidas()).toEqual([]);
  });

  it('colar lista: uma por linha, ignora repetidas', async () => {
    render(<Envelope esperado={3} inicial={[{ numero: 'A1' }]} />);

    await userEvent.click(screen.getByRole('button', { name: 'Colar lista' }));
    await userEvent.type(screen.getByLabelText(/Séries coladas/), 'A1{Enter}A2{Enter}A3');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar lista' }));

    expect(lidas().map((s) => s.numero)).toEqual(['A1', 'A2', 'A3']);
    expect(screen.getByText('3 de 3 séries informadas')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Série A1 já informada');
  });

  it('com lote: cada serie aponta o lote escolhido e pode ser trocada', async () => {
    render(<Envelope esperado={2} lotes={['L-A', 'L-B']} />);

    await userEvent.keyboard('S1{Enter}');
    await userEvent.selectOptions(screen.getByLabelText('Lote das próximas séries'), 'L-B');
    await userEvent.click(screen.getByLabelText(/Bipar ou digitar série/));
    await userEvent.keyboard('S2{Enter}');
    expect(lidas()).toEqual([
      { numero: 'S1', numero_lote: 'L-A' },
      { numero: 'S2', numero_lote: 'L-B' },
    ]);

    await userEvent.selectOptions(screen.getByLabelText('Lote da série S1'), 'L-B');
    expect(lidas()[0]).toEqual({ numero: 'S1', numero_lote: 'L-B' });
  });

  it('remover uma serie atualiza o contador', async () => {
    render(<Envelope esperado={2} inicial={[{ numero: 'X1' }, { numero: 'X2' }]} />);
    expect(screen.getByText('2 de 2 séries informadas')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remover série X1' }));

    expect(screen.getByText('1 de 2 séries informadas')).toBeInTheDocument();
  });
});
