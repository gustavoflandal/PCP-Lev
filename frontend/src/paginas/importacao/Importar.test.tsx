import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { Importar } from './Importar';

function planilha(): File {
  return new File(['x'], 'cadastros.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('Importar', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
  });

  it('o botao fica desabilitado ate escolher a planilha', () => {
    renderizarComProvedores(<Importar />);

    expect(screen.getByRole('button', { name: 'Importar' })).toBeDisabled();
  });

  it('com problemas, nada e importado e a tabela mostra aba, linha e coluna', async () => {
    servidor.responder([
      {
        metodo: 'post', url: '/importacao', status: 200,
        corpo: {
          sucesso: true,
          dados: {
            importado: false,
            resumo: [],
            erros: [
              { aba: 'Partes e peças', linha: 4, coluna: 'CNPJ do fornecedor padrão', mensagem: 'fornecedor com CNPJ 45997418000153 não existe' },
              { aba: 'Produtos acabados', linha: 2, mensagem: 'o preco de venda deve ser maior que zero' },
            ],
          },
        },
      },
    ]);
    renderizarComProvedores(<Importar />);

    await userEvent.upload(screen.getByLabelText('Planilha (.xlsx)'), planilha());
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));

    expect(await screen.findByText(/Nada foi importado: a planilha tem 2 problema/)).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: 'Problemas da planilha' });
    expect(within(tabela).getByText('CNPJ do fornecedor padrão')).toBeInTheDocument();
    expect(within(tabela).getByText('4')).toBeInTheDocument();
    expect(within(tabela).getByText(/não existe/)).toBeInTheDocument();
    expect(useToasts.getState().itens).toHaveLength(0);
  });

  it('sem problemas, mostra o resumo e avisa que concluiu', async () => {
    servidor.responder([
      {
        metodo: 'post', url: '/importacao', status: 200,
        corpo: {
          sucesso: true,
          dados: {
            importado: true,
            erros: [],
            resumo: [{ aba: 'Clientes', lidas: 3, importadas: 2, ignoradas: 1 }],
          },
        },
      },
    ]);
    renderizarComProvedores(<Importar />);

    await userEvent.upload(screen.getByLabelText('Planilha (.xlsx)'), planilha());
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));

    expect(await screen.findByText('Importação concluída sem problemas.')).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: 'Resumo da importação' });
    expect(within(tabela).getByText('Clientes')).toBeInTheDocument();
    expect(useToasts.getState().itens[0]?.mensagem).toBe('Importação concluída');
  });

  it('erro da API (arquivo que nao e planilha) aparece como alerta', async () => {
    servidor.responder([
      {
        metodo: 'post', url: '/importacao', status: 400,
        corpo: { sucesso: false, erro: { codigo: 'REQUISICAO_INVALIDA', mensagem: 'O arquivo não é uma planilha Excel (.xlsx) válida' } },
      },
    ]);
    renderizarComProvedores(<Importar />);

    await userEvent.upload(screen.getByLabelText('Planilha (.xlsx)'), planilha());
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('não é uma planilha Excel');
  });
});
