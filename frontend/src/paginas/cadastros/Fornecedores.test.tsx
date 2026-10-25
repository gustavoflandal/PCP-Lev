import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao, type Perfil } from '@/store/autenticacao';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { Fornecedores } from './Fornecedores';

const fornecedor = {
  id: 1,
  razao_social: 'Componentes Eletronicos LTDA',
  cnpj: '11222333000181',
  contato_nome: 'Joao Silva',
  contato_email: 'joao@componentes.com.br',
  contato_telefone: '11999999999',
  endereco: 'Rua das Pecas, 100',
  lead_time_medio: 7,
  condicao_pagamento: '30 dias',
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

describe('Fornecedores', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
    entrarComo('GESTOR');
  });

  it('mostra o esqueleto enquanto carrega', () => {
    servidor.responder([{ metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) }]);

    renderizarComProvedores(<Fornecedores />);

    expect(screen.getAllByTestId('esqueleto-tabela').length).toBeGreaterThan(0);
  });

  it('lista vazia convida a cadastrar', async () => {
    servidor.responder([{ metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) }]);

    renderizarComProvedores(<Fornecedores />);

    expect(
      await screen.findByText('Nenhum fornecedor cadastrado. Cadastre o primeiro para começar.'),
    ).toBeInTheDocument();
  });

  it('mostra o CNPJ pontuado e o lead time em dias', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([fornecedor]) },
    ]);

    renderizarComProvedores(<Fornecedores />);

    expect(await screen.findByText('11.222.333/0001-81')).toBeInTheDocument();
    expect(screen.getByText('7 dias')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('falha na listagem mostra o erro e oferece nova tentativa', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/fornecedores',
        status: 500,
        corpo: { sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' } },
      },
    ]);

    renderizarComProvedores(<Fornecedores />);

    expect(await screen.findByText('Erro interno do servidor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('operador nao ve as acoes de escrita', async () => {
    entrarComo('OPERADOR');
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([fornecedor]) },
    ]);

    renderizarComProvedores(<Fornecedores />);

    await screen.findByText('11.222.333/0001-81');
    expect(screen.queryByRole('button', { name: 'Novo fornecedor' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inativar/ })).not.toBeInTheDocument();
  });

  it('cadastrar envia o corpo e avisa no verbo passado', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
      { metodo: 'post', url: '/fornecedores', status: 201, corpo: { sucesso: true, dados: fornecedor } },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await screen.findByText(/Nenhum fornecedor cadastrado/);

    await userEvent.click(screen.getByRole('button', { name: 'Novo fornecedor' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo fornecedor' });
    await userEvent.type(within(dialogo).getByLabelText(/Razão social/), 'Componentes Eletronicos LTDA');
    await userEvent.type(within(dialogo).getByLabelText(/CNPJ/), '11.222.333/0001-81');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Fornecedor cadastrado'));

    const envio = servidor.requisicoes.find((r) => r.metodo === 'post');
    expect(envio?.corpo).toMatchObject({
      razao_social: 'Componentes Eletronicos LTDA',
      cnpj: '11.222.333/0001-81',
      lead_time_medio: 7,
      ativo: true,
    });
  });

  it('erro 400 com detalhes marca o campo', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
      {
        metodo: 'post',
        url: '/fornecedores',
        status: 400,
        corpo: {
          sucesso: false,
          erro: {
            codigo: 'ERRO_VALIDACAO',
            mensagem: 'Dados invalidos',
            detalhes: [{ campo: 'razao_social', mensagem: 'Campo obrigatorio' }],
          },
        },
      },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await screen.findByText(/Nenhum fornecedor cadastrado/);
    await userEvent.click(screen.getByRole('button', { name: 'Novo fornecedor' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo fornecedor' });
    await userEvent.type(within(dialogo).getByLabelText(/Razão social/), 'X');
    await userEvent.type(within(dialogo).getByLabelText(/CNPJ/), '11222333000181');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByText('Campo obrigatorio')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Novo fornecedor' })).toBeInTheDocument();
  });

  it('conflito 409 mostra alerta e mantem o modal aberto', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
      {
        metodo: 'post',
        url: '/fornecedores',
        status: 409,
        corpo: {
          sucesso: false,
          erro: { codigo: 'CONFLITO', mensagem: 'ja existe um fornecedor com este CNPJ' },
        },
      },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await screen.findByText(/Nenhum fornecedor cadastrado/);
    await userEvent.click(screen.getByRole('button', { name: 'Novo fornecedor' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo fornecedor' });
    await userEvent.type(within(dialogo).getByLabelText(/Razão social/), 'Componentes Eletronicos LTDA');
    await userEvent.type(within(dialogo).getByLabelText(/CNPJ/), '11222333000181');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'ja existe um fornecedor com este CNPJ',
    );
    expect(screen.getByRole('dialog', { name: 'Novo fornecedor' })).toBeInTheDocument();
  });

  it('novo fornecedor nasce com o lead time padrao dos Parametros de negocio', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
      { metodo: 'get', url: '/configuracoes/negocio', status: 200, corpo: { dados: { lead_time_padrao_dias: 15 } } },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await screen.findByText(/Nenhum fornecedor cadastrado/);
    await userEvent.click(screen.getByRole('button', { name: 'Novo fornecedor' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo fornecedor' });
    await waitFor(() => expect(within(dialogo).getByLabelText(/Lead time médio/)).toHaveValue('15'));
  });

  it('editar mantem o lead time do cadastro, nao o padrao', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([{ ...fornecedor, lead_time_medio: 3 }]) },
      { metodo: 'get', url: '/configuracoes/negocio', status: 200, corpo: { dados: { lead_time_padrao_dias: 15 } } },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await screen.findByText('11.222.333/0001-81');
    await userEvent.click(screen.getByRole('button', { name: 'Editar Componentes Eletronicos LTDA' }));

    const dialogo = screen.getByRole('dialog', { name: 'Editar fornecedor' });
    // Da tempo ao GET dos parametros responder antes de conferir.
    await waitFor(() => expect(servidor.requisicoes.some((r) => r.url === '/configuracoes/negocio')).toBe(true));
    expect(within(dialogo).getByLabelText(/Lead time médio/)).toHaveValue('3');
  });

  it('editar abre o modal preenchido', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([fornecedor]) },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await screen.findByText('11.222.333/0001-81');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Componentes Eletronicos LTDA' }));

    const dialogo = screen.getByRole('dialog', { name: 'Editar fornecedor' });
    expect(within(dialogo).getByLabelText(/Razão social/)).toHaveValue('Componentes Eletronicos LTDA');
  });

  it('inativar pede confirmacao antes de chamar a API', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([fornecedor]) },
      { metodo: 'delete', url: '/fornecedores/1', status: 204 },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await screen.findByText('11.222.333/0001-81');

    await userEvent.click(
      screen.getByRole('button', { name: 'Inativar Componentes Eletronicos LTDA' }),
    );

    expect(servidor.requisicoes.some((r) => r.metodo === 'delete')).toBe(false);
    expect(screen.getByText(/deixa de aparecer nas listas de seleção/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Inativar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Fornecedor inativado'));
  });

  it('"Documentos" na linha abre o modal com os anexos do fornecedor (3.1)', async () => {
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([fornecedor]) },
      {
        metodo: 'get',
        url: '/anexos',
        status: 200,
        corpo: { sucesso: true, dados: [anexoDe('fornecedor', 1, 'Certificado de Qualidade', 'ISO 9001')] },
      },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await userEvent.click(await screen.findByRole('button', { name: 'Documentos de Componentes Eletronicos LTDA' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Documentos — Componentes Eletronicos LTDA' });
    expect(await within(dialogo).findByText('ISO 9001')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Anexar documento' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Remover ISO 9001' })).toBeInTheDocument();
    expect(servidor.requisicoes.find((r) => r.url === '/anexos')?.params).toEqual({ entidade: 'fornecedor', entidade_id: 1 });
  });

  it('quem so visualiza fornecedores abre os documentos em consulta', async () => {
    entrarComo('QUALIDADE');
    servidor.responder([
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([fornecedor]) },
      {
        metodo: 'get',
        url: '/anexos',
        status: 200,
        corpo: { sucesso: true, dados: [anexoDe('fornecedor', 1, 'Contrato', 'Contrato de fornecimento')] },
      },
    ]);

    renderizarComProvedores(<Fornecedores />);
    await userEvent.click(await screen.findByRole('button', { name: 'Documentos de Componentes Eletronicos LTDA' }));

    const dialogo = await screen.findByRole('dialog');
    expect(await within(dialogo).findByText('Contrato de fornecimento')).toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: 'Anexar documento' })).not.toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument();
  });
});

function anexoDe(entidade: string, entidadeId: number, categoria: string, titulo: string) {
  return {
    id: 5, entidade, entidade_id: entidadeId, tipo: 'ANEXO', categoria, titulo, descricao: '', versao: '',
    documento_chave: 5, vigente: true, principal: false, ordem: 0,
    arquivo: { id: 'uuid-5', sha256: 'a', nome_original: 'doc.pdf', tipo_mime: 'application/pdf', tamanho: 1024, tem_miniatura: false, created_at: '2026-10-24T12:00:00Z' },
    created_at: '2026-10-24T12:00:00Z',
    url: '/api/v1/arquivos/uuid-5/conteudo?exp=1&sig=x',
  };
}
