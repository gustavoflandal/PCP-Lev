import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao, type Perfil } from '@/store/autenticacao';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { ProdutosAcabados } from './ProdutosAcabados';

const produto = {
  id: 1,
  codigo: 'RAD-001',
  descricao: 'Radar de trânsito fixo',
  unidade_medida: 'und',
  preco_venda: 5000,
  lead_time_producao: 15,
  ativo: true,
  created_at: '2026-08-29T12:00:00Z',
  updated_at: '2026-08-29T12:00:00Z',
};

function paginaCom(itens: unknown[]) {
  return {
    sucesso: true,
    dados: itens,
    paginacao: { pagina: 1, limite: 20, total: itens.length, total_paginas: 1 },
  };
}

function entrarComo(perfil: Perfil) {
  useAutenticacao.getState().entrar({
    access_token: 'token-abc',
    token_type: 'Bearer',
    expires_in: 28800,
    usuario: { id: 1, username: 'gestor01', nome: 'Gustavo Landal', perfil, tema: 'automatico', alto_contraste: false, densidade: 'confortavel', tamanho_fonte: 'padrao' },
  });
}

describe('ProdutosAcabados', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
    entrarComo('GESTOR');
  });

  it('mostra o esqueleto enquanto carrega', () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados', status: 200, corpo: paginaCom([]) },
    ]);

    renderizarComProvedores(<ProdutosAcabados />);

    expect(screen.getAllByTestId('esqueleto-tabela').length).toBeGreaterThan(0);
  });

  it('lista vazia convida a cadastrar', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados', status: 200, corpo: paginaCom([]) },
    ]);

    renderizarComProvedores(<ProdutosAcabados />);

    expect(
      await screen.findByText('Nenhum produto acabado cadastrado. Cadastre o primeiro para começar.'),
    ).toBeInTheDocument();
  });

  it('mostra o preco formatado em reais e o lead time em dias', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados', status: 200, corpo: paginaCom([produto]) },
    ]);

    renderizarComProvedores(<ProdutosAcabados />);

    expect(await screen.findByText('R$ 5.000,00')).toBeInTheDocument();
    expect(screen.getByText('15 dias')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('falha na listagem mostra o erro e oferece nova tentativa', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/produtos-acabados',
        status: 500,
        corpo: { sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' } },
      },
    ]);

    renderizarComProvedores(<ProdutosAcabados />);

    expect(await screen.findByText('Erro interno do servidor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('operador nao ve as acoes de escrita', async () => {
    entrarComo('OPERADOR');
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados', status: 200, corpo: paginaCom([produto]) },
    ]);

    renderizarComProvedores(<ProdutosAcabados />);

    await screen.findByText('R$ 5.000,00');
    expect(screen.queryByRole('button', { name: 'Novo produto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inativar/ })).not.toBeInTheDocument();
  });

  it('cadastrar envia o corpo e avisa no verbo passado', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados', status: 200, corpo: paginaCom([]) },
      { metodo: 'post', url: '/produtos-acabados', status: 201, corpo: { sucesso: true, dados: produto } },
    ]);

    renderizarComProvedores(<ProdutosAcabados />);
    await screen.findByText(/Nenhum produto acabado cadastrado/);

    await userEvent.click(screen.getByRole('button', { name: 'Novo produto' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo produto' });
    await userEvent.type(within(dialogo).getByLabelText(/^Código/), 'RAD-001');
    await userEvent.type(within(dialogo).getByLabelText(/Descrição/), 'Radar de trânsito fixo');
    await userEvent.type(within(dialogo).getByLabelText(/Unidade/), 'und');
    await userEvent.clear(within(dialogo).getByLabelText(/Preço de venda/));
    await userEvent.type(within(dialogo).getByLabelText(/Preço de venda/), '5000');
    await userEvent.clear(within(dialogo).getByLabelText(/Lead time de produção/));
    await userEvent.type(within(dialogo).getByLabelText(/Lead time de produção/), '15');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Produto cadastrado'));

    const envio = servidor.requisicoes.find((r) => r.metodo === 'post');
    expect(envio?.corpo).toMatchObject({
      codigo: 'RAD-001',
      descricao: 'Radar de trânsito fixo',
      unidade_medida: 'und',
      preco_venda: 5000,
      lead_time_producao: 15,
      ativo: true,
    });
  });

  it('erro 400 com detalhes marca o campo', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados', status: 200, corpo: paginaCom([]) },
      {
        metodo: 'post',
        url: '/produtos-acabados',
        status: 400,
        corpo: {
          sucesso: false,
          erro: {
            codigo: 'ERRO_VALIDACAO',
            mensagem: 'Dados invalidos',
            detalhes: [{ campo: 'codigo', mensagem: 'Código já cadastrado' }],
          },
        },
      },
    ]);

    renderizarComProvedores(<ProdutosAcabados />);
    await screen.findByText(/Nenhum produto acabado cadastrado/);
    await userEvent.click(screen.getByRole('button', { name: 'Novo produto' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo produto' });
    await userEvent.type(within(dialogo).getByLabelText(/^Código/), 'RAD-001');
    await userEvent.type(within(dialogo).getByLabelText(/Descrição/), 'Radar de trânsito fixo');
    await userEvent.type(within(dialogo).getByLabelText(/Unidade/), 'und');
    await userEvent.clear(within(dialogo).getByLabelText(/Preço de venda/));
    await userEvent.type(within(dialogo).getByLabelText(/Preço de venda/), '5000');
    await userEvent.clear(within(dialogo).getByLabelText(/Lead time de produção/));
    await userEvent.type(within(dialogo).getByLabelText(/Lead time de produção/), '15');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByText('Código já cadastrado')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Novo produto' })).toBeInTheDocument();
  });

  it('conflito 409 mostra alerta e mantem o modal aberto', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados', status: 200, corpo: paginaCom([]) },
      {
        metodo: 'post',
        url: '/produtos-acabados',
        status: 409,
        corpo: {
          sucesso: false,
          erro: { codigo: 'CONFLITO', mensagem: 'já existe um produto com este código' },
        },
      },
    ]);

    renderizarComProvedores(<ProdutosAcabados />);
    await screen.findByText(/Nenhum produto acabado cadastrado/);
    await userEvent.click(screen.getByRole('button', { name: 'Novo produto' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo produto' });
    await userEvent.type(within(dialogo).getByLabelText(/^Código/), 'RAD-001');
    await userEvent.type(within(dialogo).getByLabelText(/Descrição/), 'Radar de trânsito fixo');
    await userEvent.type(within(dialogo).getByLabelText(/Unidade/), 'und');
    await userEvent.clear(within(dialogo).getByLabelText(/Preço de venda/));
    await userEvent.type(within(dialogo).getByLabelText(/Preço de venda/), '5000');
    await userEvent.clear(within(dialogo).getByLabelText(/Lead time de produção/));
    await userEvent.type(within(dialogo).getByLabelText(/Lead time de produção/), '15');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'já existe um produto com este código',
    );
    expect(screen.getByRole('dialog', { name: 'Novo produto' })).toBeInTheDocument();
  });

  it('editar abre o modal preenchido', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados', status: 200, corpo: paginaCom([produto]) },
    ]);

    renderizarComProvedores(<ProdutosAcabados />);
    await screen.findByText('R$ 5.000,00');

    await userEvent.click(screen.getByRole('button', { name: 'Editar RAD-001' }));

    const dialogo = screen.getByRole('dialog', { name: 'Editar produto' });
    expect(within(dialogo).getByLabelText(/^Código/)).toHaveValue('RAD-001');
  });

  it('inativar pede confirmacao antes de chamar a API', async () => {
    servidor.responder([
      { metodo: 'get', url: '/produtos-acabados', status: 200, corpo: paginaCom([produto]) },
      { metodo: 'delete', url: '/produtos-acabados/1', status: 204 },
    ]);

    renderizarComProvedores(<ProdutosAcabados />);
    await screen.findByText('R$ 5.000,00');

    await userEvent.click(screen.getByRole('button', { name: 'Inativar RAD-001' }));

    expect(servidor.requisicoes.some((r) => r.metodo === 'delete')).toBe(false);
    expect(screen.getByText(/deixa de aparecer nas listas de seleção/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Inativar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Produto inativado'));
  });
});
