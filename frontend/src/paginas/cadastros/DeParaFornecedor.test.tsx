import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { FORNECEDOR, PECAS, pagina } from '@/testes/fixturasRecebimento';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { Fornecedores } from './Fornecedores';

const vinculo = {
  id: 9, fornecedor_id: 1, parte_peca_id: 3, peca_codigo: 'PARAFUSO', peca_descricao: 'Parafuso M3',
  codigo_fornecedor: 'CX-M3', descricao_fornecedor: 'Parafuso M3 cx 100', unidade_fornecedor: 'CX', fator_conversao: 100,
};

function rotas(vinculos: unknown[]) {
  return [
    { metodo: 'get' as const, url: '/fornecedores', status: 200, corpo: pagina([{ ...FORNECEDOR, lead_time_medio: 5 }]) },
    { metodo: 'get' as const, url: '/fornecedores/1/de-para', status: 200, corpo: { sucesso: true, dados: vinculos } },
    { metodo: 'get' as const, url: '/partes-pecas', status: 200, corpo: pagina(PECAS) },
  ];
}

describe('Fornecedores — itens do fornecedor (de-para)', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    useToasts.setState({ itens: [] });
    entrarComoPerfil('GESTOR');
  });

  it('lista os vinculos e cadastra um novo', async () => {
    servidor.responder([
      ...rotas([vinculo]),
      { metodo: 'post', url: '/fornecedores/1/de-para', status: 200, corpo: { sucesso: true, dados: { ...vinculo, id: 10 } } },
    ]);
    renderizarComProvedores(<Fornecedores />);

    await userEvent.click(await screen.findByRole('button', { name: /Itens do fornecedor \(de-para\) de Eletrônica/ }));
    const modal = screen.getByRole('dialog', { name: /Itens do fornecedor \(de-para\)/ });
    const tabela = await within(modal).findByRole('table', { name: 'Vínculos de-para' });
    expect(await within(tabela).findByText('CX-M3')).toBeInTheDocument();
    expect(within(tabela).getByText('100')).toBeInTheDocument();

    await waitFor(() => expect(within(modal).getByRole('option', { name: 'CONECTOR — Conector serial' })).toBeInTheDocument());
    await userEvent.type(within(modal).getByLabelText(/^Código do fornecedor/), 'CN-9');
    await userEvent.selectOptions(within(modal).getByLabelText(/^Peça/), '2');
    await userEvent.type(within(modal).getByLabelText(/^Unidade do fornecedor/), 'PCT');
    await userEvent.clear(within(modal).getByLabelText(/^Fator de conversão/));
    await userEvent.type(within(modal).getByLabelText(/^Fator de conversão/), '10');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar vínculo' }));

    await waitFor(() =>
      expect(servidor.requisicoes.find((r) => r.metodo === 'post')?.corpo).toEqual({
        parte_peca_id: 2,
        codigo_fornecedor: 'CN-9',
        descricao_fornecedor: '',
        unidade_fornecedor: 'PCT',
        fator_conversao: 10,
      }),
    );
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Vínculo salvo');
  });

  it('remove um vinculo com confirmacao', async () => {
    servidor.responder([...rotas([vinculo]), { metodo: 'delete', url: '/de-para/9', status: 204 }]);
    renderizarComProvedores(<Fornecedores />);

    await userEvent.click(await screen.findByRole('button', { name: /Itens do fornecedor \(de-para\) de Eletrônica/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remover vínculo CX-M3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remover' }));

    await waitFor(() => expect(servidor.requisicoes.some((r) => r.metodo === 'delete' && r.url === '/de-para/9')).toBe(true));
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Vínculo removido');
  });

  it('so com notas_entrada.visualizar a lista e so leitura', async () => {
    entrarComoPerfil('QUALIDADE');
    servidor.responder(rotas([vinculo]));
    renderizarComProvedores(<Fornecedores />);

    await userEvent.click(await screen.findByRole('button', { name: /Itens do fornecedor \(de-para\) de Eletrônica/ }));
    const modal = screen.getByRole('dialog', { name: /Itens do fornecedor \(de-para\)/ });
    expect(await within(modal).findByText('CX-M3')).toBeInTheDocument();
    expect(within(modal).queryByRole('button', { name: 'Salvar vínculo' })).not.toBeInTheDocument();
    expect(within(modal).queryByRole('button', { name: /Remover vínculo/ })).not.toBeInTheDocument();
  });
});
