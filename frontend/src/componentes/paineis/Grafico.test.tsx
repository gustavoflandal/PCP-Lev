import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREFERENCIAS_PADRAO, usePreferencias } from '@/store/preferencias';
import { formatarMes } from '@/lib/paineis';
import { useModoTV } from '@/store/modoTV';
import { GraficoBarras, GraficoBarrasHorizontais, GraficoLinha } from './Grafico';

const meses = [
  { rotulo: '2026-09', valor: 0 },
  { rotulo: '2026-10', valor: 12500.5 },
];

describe('Grafico', () => {
  it('tem titulo e esconde a tabela ate pedir "Ver dados"', async () => {
    render(
      <GraficoLinha
        area
        titulo="Comprado por mês"
        series={[{ nome: 'Valor emitido', pontos: meses }]}
        formato="moeda"
        formatarRotulo={formatarMes}
        rotuloCategoria="Mês"
        vazio="Nenhum pedido."
      />,
    );

    const regiao = screen.getByRole('region', { name: 'Comprado por mês' });
    expect(within(regiao).getByRole('heading', { name: 'Comprado por mês' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    const botao = screen.getByRole('button', { name: 'Ver dados' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(botao);

    expect(screen.getByRole('button', { name: 'Ocultar dados' })).toHaveAttribute('aria-expanded', 'true');
    const tabela = screen.getByRole('table', { name: 'Comprado por mês' });
    expect(within(tabela).getByRole('columnheader', { name: 'Mês' })).toBeInTheDocument();
    expect(within(tabela).getByRole('columnheader', { name: 'Valor emitido' })).toBeInTheDocument();
  });

  it('a tabela equivalente traz os rotulos e valores formatados', async () => {
    render(
      <GraficoLinha
        area
        titulo="Comprado por mês"
        series={[{ nome: 'Valor emitido', pontos: meses }]}
        formato="moeda"
        formatarRotulo={formatarMes}
        rotuloCategoria="Mês"
        vazio="Nenhum pedido."
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver dados' }));

    const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(2);
    expect(within(linhas[0]).getByRole('rowheader')).toHaveTextContent('set/26');
    expect(within(linhas[1]).getByRole('rowheader')).toHaveTextContent('out/26');
    expect(within(linhas[1]).getByRole('cell')).toHaveTextContent(/R\$\s12\.500,50/);
    expect(within(linhas[1]).getByRole('cell')).toHaveClass('tabular');
  });

  it('com mais de uma serie, a tabela tem uma coluna por serie', async () => {
    render(
      <GraficoBarras
        titulo="Comparativo"
        series={[
          { nome: 'Previsto', pontos: [{ rotulo: 'A', valor: 1 }] },
          { nome: 'Realizado', pontos: [{ rotulo: 'A', valor: 2 }] },
        ]}
        rotuloCategoria="Item"
        vazio="Nada."
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver dados' }));

    const tabela = screen.getByRole('table');
    expect(within(tabela).getByRole('columnheader', { name: 'Previsto' })).toBeInTheDocument();
    expect(within(tabela).getByRole('columnheader', { name: 'Realizado' })).toBeInTheDocument();
    expect(within(tabela).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', '2']);
  });

  it('o desenho usa os tokens de cor do sistema e fica fora da arvore acessivel', () => {
    const { container } = render(
      <GraficoBarras
        titulo="OPs por etapa"
        series={[{ nome: 'OPs', pontos: [{ rotulo: 'Montagem', valor: 3 }] }]}
        rotuloCategoria="Etapa"
        vazio="Nada."
      />,
    );

    const desenho = container.querySelector('.recharts-wrapper');
    expect(desenho).not.toBeNull();
    expect(desenho?.closest('[aria-hidden="true"]')).not.toBeNull();
    const barra = container.querySelector('.recharts-bar-rectangle path');
    expect(barra?.getAttribute('fill')).toBe('var(--grafico-1)');
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it('uma serie so: cada categoria ganha uma cor da paleta', () => {
    const { container } = render(
      <GraficoBarras
        titulo="OPs por etapa"
        series={[{ nome: 'OPs', pontos: [{ rotulo: 'Montagem', valor: 3 }, { rotulo: 'Teste', valor: 5 }, { rotulo: 'Expedição', valor: 2 }] }]}
        rotuloCategoria="Etapa"
        vazio="Nada."
      />,
    );

    const cores = [...container.querySelectorAll('.recharts-bar-rectangle path')].map((b) => b.getAttribute('fill'));
    expect(cores).toEqual(['var(--grafico-1)', 'var(--grafico-2)', 'var(--grafico-3)']);
  });

  it('varias series: a cor identifica a serie', () => {
    const pontos = [{ rotulo: 'A', valor: 1 }, { rotulo: 'B', valor: 2 }];
    const { container } = render(
      <GraficoBarras
        titulo="Comparativo"
        series={[{ nome: 'Previsto', pontos }, { nome: 'Realizado', pontos }]}
        rotuloCategoria="Item"
        vazio="Nada."
      />,
    );

    const cores = [...container.querySelectorAll('.recharts-bar-rectangle path')].map((b) => b.getAttribute('fill'));
    expect(new Set(cores)).toEqual(new Set(['var(--grafico-1)', 'var(--grafico-2)']));
  });

  it('carregando mostra o esqueleto, sem "Ver dados"', () => {
    render(<GraficoBarras titulo="OPs por etapa" series={[]} rotuloCategoria="Etapa" vazio="Nenhuma OP." carregando />);

    expect(screen.getByTestId('esqueleto-grafico')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'OPs por etapa' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('button', { name: 'Ver dados' })).not.toBeInTheDocument();
  });

  it('sem pontos, mostra a frase do que falta', () => {
    render(<GraficoBarras titulo="OPs por etapa" series={[{ nome: 'OPs', pontos: [] }]} rotuloCategoria="Etapa" vazio="Nenhuma OP aberta." />);

    expect(screen.getByText('Nenhuma OP aberta.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver dados' })).not.toBeInTheDocument();
  });

  it('serie toda zerada tambem e vazio (um eixo reto no zero nao informa)', () => {
    render(
      <GraficoLinha
        titulo="Entradas por mês"
        series={[{ nome: 'Valor', pontos: [{ rotulo: '2026-09', valor: 0 }, { rotulo: '2026-10', valor: 0 }] }]}
        rotuloCategoria="Mês"
        vazio="Nenhuma nota efetivada no período."
      />,
    );

    expect(screen.getByText('Nenhuma nota efetivada no período.')).toBeInTheDocument();
  });

  it('percentual zero e resultado, nao vazio', () => {
    render(
      <GraficoLinha
        titulo="OTD por mês"
        series={[{ nome: 'No prazo', pontos: [{ rotulo: '2026-10', valor: 0 }] }]}
        formato="percentual"
        rotuloCategoria="Mês"
        vazio="Nenhuma entrega."
      />,
    );

    expect(screen.queryByText('Nenhuma entrega.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver dados' })).toBeInTheDocument();
  });

  it('erro mostra a mensagem e Tentar de novo', async () => {
    const tentar = vi.fn();
    render(
      <GraficoBarrasHorizontais
        titulo="Atrasos por fornecedor"
        series={[]}
        rotuloCategoria="Fornecedor"
        vazio="Nada."
        erro="Não foi possível carregar o gráfico."
        aoTentarDeNovo={tentar}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o gráfico.');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(tentar).toHaveBeenCalledOnce();
  });

  it('barras horizontais: nome longo inteiro na tabela', async () => {
    const nome = 'Fornecedor de Componentes Eletrônicos Industriais Ltda';
    render(
      <GraficoBarrasHorizontais
        titulo="Atrasos por fornecedor"
        series={[{ nome: 'Pedidos em atraso', pontos: [{ rotulo: nome, valor: 3 }] }]}
        rotuloCategoria="Fornecedor"
        vazio="Nada."
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver dados' }));

    expect(screen.getByRole('rowheader', { name: nome })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '3' })).toBeInTheDocument();
  });
});

describe('Grafico em espanhol', () => {
  afterEach(() => usePreferencias.getState().aplicar(PREFERENCIAS_PADRAO));

  it('traduz os controles, o mes abreviado e o rotulo da API', async () => {
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'es' });
    render(
      <GraficoBarras
        titulo="Lotes por faixa de vencimento"
        series={[{ nome: 'Lotes', pontos: [{ rotulo: 'Até 30 dias', valor: 3 }] }]}
        rotuloCategoria="Vencimento"
        vazio="Nenhum lote."
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver datos' }));
    expect(screen.getByRole('button', { name: 'Ocultar datos' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Hasta 30 días' })).toBeInTheDocument();
    expect(formatarMes('2026-10')).toBe('oct/26');
    expect(formatarMes('2026-01')).toBe('ene/26');
  });
});

describe('Grafico no modo TV', () => {
  afterEach(() => useModoTV.setState({ ativo: false }));

  const grafico = (
    <GraficoBarras
      titulo="OPs por etapa"
      series={[{ nome: 'OPs', pontos: [{ rotulo: 'Montagem', valor: 3 }] }]}
      rotuloCategoria="Etapa"
      vazio="Nada."
    />
  );

  it('ocupa a celula da grade e nao oferece "Ver dados"', () => {
    useModoTV.setState({ ativo: true });
    const { container } = render(grafico);

    expect(screen.getByRole('region', { name: 'OPs por etapa' })).toHaveClass('h-full', 'min-h-0');
    expect(container.querySelector('[data-grafico-desenho]')).toHaveClass('flex-1');
    expect(screen.queryByRole('button', { name: 'Ver dados' })).not.toBeInTheDocument();
  });

  it('fora do modo TV mantem a altura fixa e o "Ver dados"', () => {
    const { container } = render(grafico);

    expect(screen.getByRole('button', { name: 'Ver dados' })).toBeInTheDocument();
    expect((container.querySelector('[data-grafico-desenho]') as HTMLElement).style.height).toBe('16rem');
  });
});
