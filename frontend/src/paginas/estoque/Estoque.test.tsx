import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { useToasts } from '@/componentes/ui/Toast';
import { PREFERENCIAS_PADRAO, usePreferencias } from '@/store/preferencias';
import { Estoque } from './Estoque';

const ITEM = {
  id: 1, parte_peca_id: 10, codigo: 'CON-001', descricao: 'Conector RCA Macho',
  quantidade_atual: 250, quantidade_reservada: 100, disponivel: 150,
  estoque_minimo: 50, status: 'OK', updated_at: '2026-08-30T12:00:00Z',
};

describe('Estoque', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    entrarComoPerfil('GESTOR');
    useToasts.setState({ itens: [] });
  });

  it('mostra as colunas e o saldo', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } }]);
    renderizarComProvedores(<Estoque />);

    expect(await screen.findByText('CON-001')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('badge de status critico usa o tom certo', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [{ ...ITEM, status: 'CRITICO' }], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } }]);
    renderizarComProvedores(<Estoque />);

    expect(await screen.findByText('Crítico')).toBeInTheDocument();
  });

  it('filtro de status muda a query', async () => {
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } }]);
    renderizarComProvedores(<Estoque />);
    await screen.findByText('CON-001');

    await userEvent.selectOptions(screen.getByLabelText('Situação'), 'CRITICO');

    await waitFor(() => expect(servidor.requisicoes.at(-1)?.params.status).toBe('CRITICO'));
  });

  it('sem estoque.ajustar nem estoque.exportar, nao ha coluna Ajustar nem Exportar CSV', async () => {
    entrarComoPerfil('OPERADOR');
    servidor.responder([{ metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } }]);
    renderizarComProvedores(<Estoque />);

    await screen.findByText('CON-001');

    expect(screen.queryByRole('button', { name: /^Ajustar/ })).not.toBeInTheDocument();
    // Kardex e origem do saldo sao consultas: ficam para quem so ve o estoque.
    expect(screen.getByRole('button', { name: 'Kardex de CON-001' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument();
  });

  it('ajustar saldo envia o corpo certo e mostra toast', async () => {
    servidor.responder([
      { metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
      { metodo: 'post', url: '/estoque/ajuste', status: 201, corpo: { dados: { ...ITEM, quantidade_atual: 260 } } },
    ]);
    renderizarComProvedores(<Estoque />);
    await screen.findByText('CON-001');

    await userEvent.click(screen.getByRole('button', { name: 'Ajustar CON-001' }));
    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/Quantidade/), '10');
    await userEvent.type(within(modal).getByLabelText(/Motivo/), 'Inventário físico');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ajuste' }));

    await waitFor(() =>
      expect(servidor.requisicoes.find((r) => r.url === '/estoque/ajuste')?.corpo).toEqual({
        parte_peca_id: 10, quantidade: 10, motivo: 'Inventário físico',
      }),
    );
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Estoque ajustado');
  });

  it('erro 409 no ajuste mostra alerta com o modal aberto', async () => {
    servidor.responder([
      { metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
      { metodo: 'post', url: '/estoque/ajuste', status: 409, corpo: { sucesso: false, erro: { codigo: 'CONFLITO', mensagem: 'O ajuste deixaria o saldo negativo' } } },
    ]);
    renderizarComProvedores(<Estoque />);
    await screen.findByText('CON-001');

    await userEvent.click(screen.getByRole('button', { name: 'Ajustar CON-001' }));
    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/Quantidade/), '-1000');
    await userEvent.type(within(modal).getByLabelText(/Motivo/), 'Perda');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ajuste' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('saldo negativo');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('exportar CSV baixa o relatorio de estoque', async () => {
    URL.createObjectURL = () => 'blob:teste';
    URL.revokeObjectURL = () => {};
    const cliqueEspiao = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    servidor.responder([
      { metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
      { metodo: 'get', url: '/estoque/relatorio.csv', status: 200, corpo: new Blob(['codigo,descricao']) },
    ]);
    renderizarComProvedores(<Estoque />);
    await screen.findByText('CON-001');

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    await waitFor(() => expect(cliqueEspiao).toHaveBeenCalledTimes(1));
    cliqueEspiao.mockRestore();
  });

  it('exportar CSV com falha na API mostra toast de erro', async () => {
    servidor.responder([
      { metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
      { metodo: 'get', url: '/estoque/relatorio.csv', status: 500, corpo: { sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' } } },
    ]);
    renderizarComProvedores(<Estoque />);
    await screen.findByText('CON-001');

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    await waitFor(() =>
      expect(useToasts.getState().itens[0]?.mensagem).toBe('Erro interno do servidor'),
    );
  });

  describe('itens rastreados (v1.2)', () => {
    const paginaEstoque = { dados: [ITEM], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } };
    function pecas(flags: Record<string, boolean>) {
      return {
        sucesso: true,
        dados: [{ id: 10, codigo: 'CON-001', descricao: 'Conector RCA Macho', unidade_medida: 'UN', ativo: true, ...flags }],
        paginacao: { pagina: 1, limite: 200, total: 1, total_paginas: 1 },
      };
    }

    it('ajuste de peca com lote pede o lote e a validade e envia no corpo', async () => {
      servidor.responder([
        { metodo: 'get', url: '/estoque', status: 200, corpo: paginaEstoque },
        { metodo: 'get', url: '/partes-pecas', status: 200, corpo: pecas({ controla_lote: true, controla_validade: true }) },
        { metodo: 'post', url: '/estoque/ajuste', status: 201, corpo: { dados: ITEM } },
      ]);
      renderizarComProvedores(<Estoque />);
      await screen.findByText('CON-001');

      await userEvent.click(screen.getByRole('button', { name: 'Ajustar CON-001' }));
      const modal = screen.getByRole('dialog');
      expect(await within(modal).findByText('Controla lote e validade')).toBeInTheDocument();
      await userEvent.type(within(modal).getByLabelText(/^Quantidade/), '5');
      await userEvent.type(within(modal).getByLabelText(/^Motivo/), 'Inventário de abertura');
      // Sem o lote, nem chama a API.
      await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ajuste' }));
      expect(within(modal).getByRole('alert')).toHaveTextContent('Informe o lote');
      expect(servidor.requisicoes.some((r) => r.url === '/estoque/ajuste')).toBe(false);

      await userEvent.type(within(modal).getByLabelText(/^Lote/), 'L-77');
      fireEvent.change(within(modal).getByLabelText(/^Validade do lote/), { target: { value: '2027-05-01' } });
      await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ajuste' }));

      await waitFor(() =>
        expect(servidor.requisicoes.find((r) => r.url === '/estoque/ajuste')?.corpo).toEqual({
          parte_peca_id: 10,
          quantidade: 5,
          motivo: 'Inventário de abertura',
          lote: { numero_lote: 'L-77', validade: '2027-05-01', data_fabricacao: null },
        }),
      );
    });

    it('ajuste de peca com serie pede uma serie por unidade (bipagem)', async () => {
      servidor.responder([
        { metodo: 'get', url: '/estoque', status: 200, corpo: paginaEstoque },
        { metodo: 'get', url: '/partes-pecas', status: 200, corpo: pecas({ controla_numero_serie: true }) },
        { metodo: 'post', url: '/estoque/ajuste', status: 201, corpo: { dados: ITEM } },
      ]);
      renderizarComProvedores(<Estoque />);
      await screen.findByText('CON-001');

      await userEvent.click(screen.getByRole('button', { name: 'Ajustar CON-001' }));
      const modal = screen.getByRole('dialog');
      await within(modal).findByText('Controla número de série');
      await userEvent.type(within(modal).getByLabelText(/^Quantidade/), '-2');
      await userEvent.type(within(modal).getByLabelText(/^Motivo/), 'Sucata por avaria');
      const bipagem = within(modal).getByLabelText(/Bipar ou digitar série/);
      await userEvent.type(bipagem, 'SN-0001{Enter}');
      expect(within(modal).getByText('1 de 2 séries informadas')).toBeInTheDocument();
      await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ajuste' }));
      expect(within(modal).getByRole('alert')).toHaveTextContent('1 de 2');

      await userEvent.type(bipagem, 'SN-0002{Enter}');
      expect(within(modal).getByText('2 de 2 séries informadas')).toBeInTheDocument();
      await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ajuste' }));

      await waitFor(() =>
        expect(servidor.requisicoes.find((r) => r.url === '/estoque/ajuste')?.corpo).toEqual({
          parte_peca_id: 10,
          quantidade: -2,
          motivo: 'Sucata por avaria',
          series: ['SN-0001', 'SN-0002'],
        }),
      );
    });

    it('recusa da API (409 serie indisponivel) aparece no modal', async () => {
      servidor.responder([
        { metodo: 'get', url: '/estoque', status: 200, corpo: paginaEstoque },
        { metodo: 'get', url: '/partes-pecas', status: 200, corpo: pecas({ controla_numero_serie: true }) },
        {
          metodo: 'post', url: '/estoque/ajuste', status: 409,
          corpo: { sucesso: false, erro: { codigo: 'CONFLITO', mensagem: 'uma das series nao existe em estoque para esta peca' } },
        },
      ]);
      renderizarComProvedores(<Estoque />);
      await screen.findByText('CON-001');

      await userEvent.click(screen.getByRole('button', { name: 'Ajustar CON-001' }));
      const modal = screen.getByRole('dialog');
      await within(modal).findByText('Controla número de série');
      await userEvent.type(within(modal).getByLabelText(/^Quantidade/), '-1');
      await userEvent.type(within(modal).getByLabelText(/^Motivo/), 'Perda');
      await userEvent.type(within(modal).getByLabelText(/Bipar ou digitar série/), 'SN-9{Enter}');
      await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ajuste' }));

      expect(await within(modal).findByRole('alert')).toHaveTextContent('nao existe em estoque');
    });

    it('kardex lista os movimentos com link para o documento de origem', async () => {
      servidor.responder([
        { metodo: 'get', url: '/estoque', status: 200, corpo: paginaEstoque },
        {
          metodo: 'get', url: '/estoque/10/kardex', status: 200,
          corpo: {
            sucesso: true,
            dados: [
              { id: 3, data_hora: '2026-10-20T10:00:00Z', tipo: 'Saida', motivo: 'Consumo da OP', quantidade: -4, saldo: 246,
                documento_tipo: 'ORDEM_PRODUCAO', documento_id: 9, referencia: 'OP-2026-009', numero_lote: 'L-01', observacoes: '' },
              { id: 2, data_hora: '2026-10-18T10:00:00Z', tipo: 'Entrada', motivo: 'Nota fiscal', quantidade: 250, saldo: 250,
                documento_tipo: 'NOTA_ENTRADA', documento_id: 5, referencia: '123/1', numero_lote: 'L-01', observacoes: '' },
              { id: 1, data_hora: '2026-10-01T10:00:00Z', tipo: 'Inventario', motivo: 'Contagem', quantidade: 0, saldo: 0,
                documento_tipo: 'AJUSTE', observacoes: '' },
            ],
          },
        },
      ]);
      renderizarComProvedores(<Estoque />);
      await screen.findByText('CON-001');

      await userEvent.click(screen.getByRole('button', { name: 'Kardex de CON-001' }));
      const modal = await screen.findByRole('dialog', { name: /Kardex — CON-001/ });

      expect(await within(modal).findByRole('link', { name: 'Nota fiscal 123/1' })).toHaveAttribute('href', '/notas-entrada/5');
      expect(within(modal).getByRole('link', { name: 'OP OP-2026-009' })).toHaveAttribute('href', '/producao/ops/9');
      expect(within(modal).getByText('Ajuste')).toBeInTheDocument();
      expect(within(modal).getByText('+250')).toBeInTheDocument();
      expect(within(modal).getByText('246')).toBeInTheDocument();
      // Sem custo na resposta (sem producao.custos), sem a coluna.
      expect(within(modal).queryByRole('columnheader', { name: 'Custo unitário' })).not.toBeInTheDocument();
    });

    it('origem do saldo mostra lotes, notas e o que ficou sem documento', async () => {
      servidor.responder([
        { metodo: 'get', url: '/estoque', status: 200, corpo: paginaEstoque },
        {
          metodo: 'get', url: '/estoque/10/origens', status: 200,
          corpo: {
            sucesso: true,
            dados: {
              parte_peca_id: 10, saldo: 250, sem_origem: 50,
              lotes: [{ id: 4, parte_peca_id: 10, peca_codigo: 'CON-001', peca_descricao: '', numero_lote: 'L-01', fornecedor_nome: 'Silva',
                validade: '2020-01-01', quantidade_atual: 200, quantidade_reservada: 0, vencido: true }],
              entradas: [{ nota_id: 5, numero: '123', serie: '1', data_entrada: '2026-10-18', fornecedor_nome: 'Silva', quantidade: 200, custo_unitario: 1.5 }],
            },
          },
        },
      ]);
      renderizarComProvedores(<Estoque />);
      await screen.findByText('CON-001');

      await userEvent.click(screen.getByRole('button', { name: 'Origem do saldo de CON-001' }));
      const modal = await screen.findByRole('dialog', { name: /Origem do saldo/ });

      expect(await within(modal).findByRole('link', { name: 'L-01' })).toHaveAttribute('href', '/lotes/4');
      expect(within(modal).getByText('Vencido')).toBeInTheDocument();
      expect(within(modal).getByRole('link', { name: 'NF 123/1' })).toHaveAttribute('href', '/notas-entrada/5');
      expect(within(modal).getByText(/50 unidade\(s\) do saldo sem documento/)).toBeInTheDocument();
      expect(within(modal).getByRole('columnheader', { name: 'Custo unitário' })).toBeInTheDocument();
    });
  });
});

describe('Estoque em espanhol', () => {
  afterEach(() => usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'pt-BR' }));

  it('traduz titulo, colunas, status e botoes; o dado do banco fica como veio', async () => {
    const servidor = instalarServidorFalso();
    entrarComoPerfil('GESTOR');
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'es' });
    servidor.responder([
      { metodo: 'get', url: '/estoque', status: 200, corpo: { dados: [{ ...ITEM, status: 'CRITICO' }], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
    ]);
    renderizarComProvedores(<Estoque />);

    expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeInTheDocument();
    expect(await screen.findByText('CON-001')).toBeInTheDocument();
    expect(screen.getByText('Conector RCA Macho')).toBeInTheDocument();
    expect(screen.getAllByText('Crítico').length).toBeGreaterThan(0);
    expect(screen.getByText('Saldo actual')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Origen del saldo de CON-001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument();
    expect(screen.queryByText('Saldo atual')).not.toBeInTheDocument();
  });
});
