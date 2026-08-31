import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tabela, type Coluna } from './Tabela';

interface Linha {
  id: number;
  codigo: string;
  quantidade: number;
}

const itens: Linha[] = [
  { id: 1, codigo: 'CON-001', quantidade: 50 },
  { id: 2, codigo: 'PLC-100', quantidade: 5 },
];

const colunas: Coluna<Linha>[] = [
  { chave: 'codigo', rotulo: 'Código', ordenavel: true, renderizar: (l) => l.codigo },
  {
    chave: 'quantidade',
    rotulo: 'Quantidade',
    ordenavel: true,
    alinhamento: 'direita',
    renderizar: (l) => l.quantidade,
  },
  { chave: 'observacao', rotulo: 'Observação', renderizar: () => '—' },
];

function renderizar(sobrescritas: Partial<Parameters<typeof Tabela<Linha>>[0]> = {}) {
  return render(
    <Tabela<Linha>
      rotulo="Partes e peças"
      colunas={colunas}
      itens={itens}
      chaveDe={(l) => l.id}
      ordenarPor="codigo"
      ordem="asc"
      aoOrdenar={vi.fn()}
      vazio="Nenhuma peça cadastrada. Cadastre a primeira para começar."
      {...sobrescritas}
    />,
  );
}

describe('Tabela', () => {
  it('mostra os cabecalhos e as linhas', () => {
    renderizar();

    expect(screen.getByRole('table', { name: 'Partes e peças' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Código/ })).toBeInTheDocument();
    expect(screen.getByText('CON-001')).toBeInTheDocument();
    expect(screen.getByText('PLC-100')).toBeInTheDocument();
  });

  it('marca aria-sort so na coluna ordenada', () => {
    renderizar();

    expect(screen.getByRole('columnheader', { name: /Código/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.getByRole('columnheader', { name: /Quantidade/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('descendente aparece como descending', () => {
    renderizar({ ordem: 'desc' });

    expect(screen.getByRole('columnheader', { name: /Código/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('clicar no cabecalho ordenavel pede a ordenacao pela chave da API', async () => {
    const aoOrdenar = vi.fn();
    renderizar({ aoOrdenar });

    await userEvent.click(screen.getByRole('button', { name: /Quantidade/ }));

    expect(aoOrdenar).toHaveBeenCalledWith('quantidade');
  });

  it('coluna nao ordenavel nao vira botao', () => {
    renderizar();

    const cabecalho = screen.getByRole('columnheader', { name: 'Observação' });
    expect(within(cabecalho).queryByRole('button')).not.toBeInTheDocument();
  });

  it('coluna numerica alinha a direita com tabular-nums', () => {
    renderizar();

    expect(screen.getByText('50')).toHaveClass('text-right', 'tabular');
  });

  it('carregando mostra esqueleto, nao a mensagem de vazio', () => {
    renderizar({ carregando: true, itens: [] });

    expect(screen.getByTestId('esqueleto-tabela')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma peça cadastrada/)).not.toBeInTheDocument();
  });

  it('lista vazia convida a agir, sem ilustracao', () => {
    renderizar({ itens: [] });

    expect(
      screen.getByText('Nenhuma peça cadastrada. Cadastre a primeira para começar.'),
    ).toBeInTheDocument();
  });

  it('erro mostra a mensagem legivel e oferece nova tentativa', async () => {
    const aoTentarDeNovo = vi.fn();
    renderizar({
      itens: [],
      erro: 'Não foi possível conectar ao servidor. Verifique sua rede e tente novamente.',
      aoTentarDeNovo,
    });

    expect(screen.getByText(/Não foi possível conectar ao servidor/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(aoTentarDeNovo).toHaveBeenCalled();
  });

  it('erro tem precedencia sobre carregando', () => {
    renderizar({ itens: [], carregando: true, erro: 'Servidor indisponível.' });

    expect(screen.getByText('Servidor indisponível.')).toBeInTheDocument();
    expect(screen.queryByTestId('esqueleto-tabela')).not.toBeInTheDocument();
  });

  it('coluna de acoes aparece quando informada', () => {
    renderizar({ acoes: (l) => <button type="button">{`Editar ${l.codigo}`}</button> });

    expect(screen.getByRole('button', { name: 'Editar CON-001' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ações' })).toBeInTheDocument();
  });
});
