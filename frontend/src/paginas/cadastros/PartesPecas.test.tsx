import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao, type Perfil } from '@/store/autenticacao';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { PartesPecas } from './PartesPecas';

const peca = {
  id: 1,
  codigo: 'CON-001',
  descricao: 'Conector RCA macho',
  unidade_medida: 'und',
  estoque_minimo: 50,
  estoque_maximo: 500,
  fornecedor_padrao_id: null,
  lead_time_compra: 7,
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

describe('PartesPecas', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
    entrarComo('GESTOR');
  });

  it('mostra o esqueleto enquanto carrega', () => {
    servidor.responder([
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaCom([]) },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
    ]);

    renderizarComProvedores(<PartesPecas />);

    expect(screen.getAllByTestId('esqueleto-tabela').length).toBeGreaterThan(0);
  });

  it('lista vazia convida a cadastrar', async () => {
    servidor.responder([
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaCom([]) },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
    ]);

    renderizarComProvedores(<PartesPecas />);

    expect(
      await screen.findByText('Nenhuma parte ou peça cadastrada. Cadastre a primeira para começar.'),
    ).toBeInTheDocument();
  });

  it('mostra o estoque min/max e o lead time em dias', async () => {
    servidor.responder([
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaCom([peca]) },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
    ]);

    renderizarComProvedores(<PartesPecas />);

    expect(await screen.findByText('50 / 500')).toBeInTheDocument();
    expect(screen.getByText('7 dias')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('falha na listagem mostra o erro e oferece nova tentativa', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/partes-pecas',
        status: 500,
        corpo: { sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' } },
      },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
    ]);

    renderizarComProvedores(<PartesPecas />);

    expect(await screen.findByText('Erro interno do servidor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('operador nao ve as acoes de escrita', async () => {
    entrarComo('OPERADOR');
    servidor.responder([
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaCom([peca]) },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
    ]);

    renderizarComProvedores(<PartesPecas />);

    await screen.findByText('50 / 500');
    expect(screen.queryByRole('button', { name: 'Nova peça' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inativar/ })).not.toBeInTheDocument();
  });

  it('cadastrar envia o corpo e avisa no verbo passado', async () => {
    servidor.responder([
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaCom([]) },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
      { metodo: 'post', url: '/partes-pecas', status: 201, corpo: { sucesso: true, dados: peca } },
    ]);

    renderizarComProvedores(<PartesPecas />);
    await screen.findByText(/Nenhuma parte ou peça cadastrada/);

    await userEvent.click(screen.getByRole('button', { name: 'Nova peça' }));

    const dialogo = screen.getByRole('dialog', { name: 'Nova peça' });
    await userEvent.type(within(dialogo).getByLabelText(/^Código/), 'CON-001');
    await userEvent.type(within(dialogo).getByLabelText(/Descrição/), 'Conector RCA macho');
    await userEvent.type(within(dialogo).getByLabelText(/Unidade/), 'und');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Peça cadastrada'));

    const envio = servidor.requisicoes.find((r) => r.metodo === 'post');
    expect(envio?.corpo).toMatchObject({
      codigo: 'CON-001',
      descricao: 'Conector RCA macho',
      unidade_medida: 'und',
      estoque_minimo: 0,
      estoque_maximo: 1,
      lead_time_compra: 7,
      fornecedor_padrao_id: null,
      ativo: true,
    });
  });

  it('erro 400 com detalhes marca o campo', async () => {
    servidor.responder([
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaCom([]) },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
      {
        metodo: 'post',
        url: '/partes-pecas',
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

    renderizarComProvedores(<PartesPecas />);
    await screen.findByText(/Nenhuma parte ou peça cadastrada/);
    await userEvent.click(screen.getByRole('button', { name: 'Nova peça' }));

    const dialogo = screen.getByRole('dialog', { name: 'Nova peça' });
    await userEvent.type(within(dialogo).getByLabelText(/^Código/), 'CON-001');
    await userEvent.type(within(dialogo).getByLabelText(/Descrição/), 'Conector RCA macho');
    await userEvent.type(within(dialogo).getByLabelText(/Unidade/), 'und');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByText('Código já cadastrado')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Nova peça' })).toBeInTheDocument();
  });

  it('conflito 409 mostra alerta e mantem o modal aberto', async () => {
    servidor.responder([
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaCom([]) },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
      {
        metodo: 'post',
        url: '/partes-pecas',
        status: 409,
        corpo: {
          sucesso: false,
          erro: { codigo: 'CONFLITO', mensagem: 'já existe uma peça com este código' },
        },
      },
    ]);

    renderizarComProvedores(<PartesPecas />);
    await screen.findByText(/Nenhuma parte ou peça cadastrada/);
    await userEvent.click(screen.getByRole('button', { name: 'Nova peça' }));

    const dialogo = screen.getByRole('dialog', { name: 'Nova peça' });
    await userEvent.type(within(dialogo).getByLabelText(/^Código/), 'CON-001');
    await userEvent.type(within(dialogo).getByLabelText(/Descrição/), 'Conector RCA macho');
    await userEvent.type(within(dialogo).getByLabelText(/Unidade/), 'und');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'já existe uma peça com este código',
    );
    expect(screen.getByRole('dialog', { name: 'Nova peça' })).toBeInTheDocument();
  });

  it('editar abre o modal preenchido', async () => {
    servidor.responder([
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaCom([peca]) },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
    ]);

    renderizarComProvedores(<PartesPecas />);
    await screen.findByText('50 / 500');

    await userEvent.click(screen.getByRole('button', { name: 'Editar CON-001' }));

    const dialogo = screen.getByRole('dialog', { name: 'Editar peça' });
    expect(within(dialogo).getByLabelText(/^Código/)).toHaveValue('CON-001');
  });

  it('inativar pede confirmacao antes de chamar a API', async () => {
    servidor.responder([
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaCom([peca]) },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
      { metodo: 'delete', url: '/partes-pecas/1', status: 204 },
    ]);

    renderizarComProvedores(<PartesPecas />);
    await screen.findByText('50 / 500');

    await userEvent.click(screen.getByRole('button', { name: 'Inativar CON-001' }));

    expect(servidor.requisicoes.some((r) => r.metodo === 'delete')).toBe(false);
    expect(screen.getByText(/deixa de aparecer nas listas de seleção/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Inativar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Peça inativada'));
  });
});
