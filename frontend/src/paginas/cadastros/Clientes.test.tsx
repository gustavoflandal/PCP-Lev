import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao } from '@/store/autenticacao';
import { PREFERENCIAS_PADRAO, usePreferencias } from '@/store/preferencias';
import {
  entrarComoPerfil,
  instalarServidorFalso,
  renderizarComProvedores,
  type ServidorFalso,
} from '@/testes/utilitarios';
import { Clientes } from './Clientes';

const cliente = {
  id: 1,
  tipo: 'ORGAO_PUBLICO',
  razao_social: 'Departamento de Estradas de Rodagem',
  nome_fantasia: 'DER-SP',
  cnpj: '11222333000181',
  inscricao_estadual: '',
  contato_nome: 'Maria Souza',
  contato_email: 'maria@der.sp.gov.br',
  contato_telefone: '1133334444',
  endereco: 'Av. do Estado, 777',
  cidade: 'São Paulo',
  uf: 'SP',
  numero_contrato: 'CT-045/2026',
  vigencia_inicio: '2026-01-01',
  vigencia_fim: '2999-12-31',
  condicao_pagamento: '30 dias',
  observacoes: '',
  ativo: true,
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
};

function paginaCom(itens: unknown[]) {
  return {
    sucesso: true,
    dados: itens,
    paginacao: { pagina: 1, limite: 20, total: itens.length, total_paginas: 1 },
  };
}

describe('Clientes', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useToasts.setState({ itens: [] });
    useAutenticacao.getState().sair();
    servidor = instalarServidorFalso();
    entrarComoPerfil('GESTOR');
  });

  it('lista com CNPJ pontuado, tipo, cidade/UF e contrato', async () => {
    servidor.responder([{ metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([cliente]) }]);

    renderizarComProvedores(<Clientes />);

    expect(await screen.findByText('11.222.333/0001-81')).toBeInTheDocument();
    expect(screen.getByText('DER-SP')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Órgão público' })).toBeInTheDocument();
    expect(screen.getByText('São Paulo/SP')).toBeInTheDocument();
    expect(screen.getByText('CT-045/2026')).toBeInTheDocument();
    expect(screen.queryByText('Contrato vencido')).not.toBeInTheDocument();
  });

  it('lista vazia convida a cadastrar', async () => {
    servidor.responder([{ metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([]) }]);

    renderizarComProvedores(<Clientes />);

    expect(
      await screen.findByText('Nenhum cliente encontrado. Ajuste os filtros ou cadastre um cliente.'),
    ).toBeInTheDocument();
  });

  it('contrato com vigencia encerrada ganha o selo de aviso', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/clientes',
        status: 200,
        corpo: paginaCom([{ ...cliente, vigencia_inicio: '2020-01-01', vigencia_fim: '2020-12-31' }]),
      },
    ]);

    renderizarComProvedores(<Clientes />);

    expect(await screen.findByText('Contrato vencido')).toBeInTheDocument();
  });

  it('filtro por tipo vai na consulta', async () => {
    servidor.responder([{ metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([]) }]);

    renderizarComProvedores(<Clientes />);
    await screen.findByText(/Nenhum cliente encontrado/);

    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'CONCESSIONARIA');

    await waitFor(() =>
      expect(servidor.requisicoes.some((r) => r.params.tipo === 'CONCESSIONARIA')).toBe(true),
    );
  });

  it('sem permissao de incluir, o botao de novo cliente some', async () => {
    entrarComoPerfil('CONSULTA');
    servidor.responder([{ metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([cliente]) }]);

    renderizarComProvedores(<Clientes />);

    await screen.findByText('11.222.333/0001-81');
    expect(screen.queryByRole('button', { name: 'Novo cliente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inativar/ })).not.toBeInTheDocument();
  });

  it('vendas cadastra clientes', async () => {
    entrarComoPerfil('VENDAS');
    servidor.responder([{ metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([cliente]) }]);

    renderizarComProvedores(<Clientes />);

    await screen.findByText('11.222.333/0001-81');
    expect(screen.getByRole('button', { name: 'Novo cliente' })).toBeInTheDocument();
  });

  it('cadastrar envia o corpo com vigencia nula e avisa no verbo passado', async () => {
    servidor.responder([
      { metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([]) },
      { metodo: 'post', url: '/clientes', status: 201, corpo: { sucesso: true, dados: cliente } },
    ]);

    renderizarComProvedores(<Clientes />);
    await screen.findByText(/Nenhum cliente encontrado/);

    await userEvent.click(screen.getByRole('button', { name: 'Novo cliente' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo cliente' });
    await userEvent.selectOptions(within(dialogo).getByLabelText(/^Tipo/), 'ORGAO_PUBLICO');
    await userEvent.type(within(dialogo).getByLabelText(/Razão social/), 'Departamento de Estradas de Rodagem');
    await userEvent.type(within(dialogo).getByLabelText(/CNPJ/), '11.222.333/0001-81');
    await userEvent.selectOptions(within(dialogo).getByLabelText('UF'), 'SP');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Cliente cadastrado'));

    const envio = servidor.requisicoes.find((r) => r.metodo === 'post');
    expect(envio?.corpo).toMatchObject({
      tipo: 'ORGAO_PUBLICO',
      razao_social: 'Departamento de Estradas de Rodagem',
      cnpj: '11.222.333/0001-81',
      uf: 'SP',
      vigencia_inicio: null,
      vigencia_fim: null,
      ativo: true,
    });
  });

  it('sem tipo, o formulario pede a escolha e nao chama a API', async () => {
    servidor.responder([{ metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([]) }]);

    renderizarComProvedores(<Clientes />);
    await screen.findByText(/Nenhum cliente encontrado/);
    await userEvent.click(screen.getByRole('button', { name: 'Novo cliente' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo cliente' });
    await userEvent.type(within(dialogo).getByLabelText(/Razão social/), 'X');
    await userEvent.type(within(dialogo).getByLabelText(/CNPJ/), '11222333000181');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByText('Escolha o tipo de cliente')).toBeInTheDocument();
    expect(servidor.requisicoes.some((r) => r.metodo === 'post')).toBe(false);
  });

  it('conflito 409 de CNPJ mostra alerta e mantem o modal aberto', async () => {
    servidor.responder([
      { metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([]) },
      {
        metodo: 'post',
        url: '/clientes',
        status: 409,
        corpo: { sucesso: false, erro: { codigo: 'CONFLITO', mensagem: 'ja existe um cliente com este CNPJ' } },
      },
    ]);

    renderizarComProvedores(<Clientes />);
    await screen.findByText(/Nenhum cliente encontrado/);
    await userEvent.click(screen.getByRole('button', { name: 'Novo cliente' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo cliente' });
    await userEvent.selectOptions(within(dialogo).getByLabelText(/^Tipo/), 'INTEGRADOR');
    await userEvent.type(within(dialogo).getByLabelText(/Razão social/), 'Integradora LTDA');
    await userEvent.type(within(dialogo).getByLabelText(/CNPJ/), '11222333000181');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('ja existe um cliente com este CNPJ');
  });

  it('editar abre o modal preenchido com a vigencia', async () => {
    servidor.responder([{ metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([cliente]) }]);

    renderizarComProvedores(<Clientes />);
    await screen.findByText('11.222.333/0001-81');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Departamento de Estradas de Rodagem' }));

    const dialogo = screen.getByRole('dialog', { name: 'Editar cliente' });
    expect(within(dialogo).getByLabelText(/Razão social/)).toHaveValue('Departamento de Estradas de Rodagem');
    expect(within(dialogo).getByLabelText('Fim da vigência')).toHaveValue('2999-12-31');
  });

  it('inativar pede confirmacao antes de chamar a API', async () => {
    servidor.responder([
      { metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([cliente]) },
      { metodo: 'delete', url: '/clientes/1', status: 204 },
    ]);

    renderizarComProvedores(<Clientes />);
    await screen.findByText('11.222.333/0001-81');

    await userEvent.click(screen.getByRole('button', { name: 'Inativar Departamento de Estradas de Rodagem' }));
    expect(servidor.requisicoes.some((r) => r.metodo === 'delete')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Inativar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Cliente inativado'));
  });

  it('"Documentos" na linha abre o modal com as categorias de cliente (3.1)', async () => {
    servidor.responder([
      { metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([cliente]) },
      { metodo: 'get', url: '/anexos', status: 200, corpo: { sucesso: true, dados: [] } },
    ]);

    renderizarComProvedores(<Clientes />);
    await userEvent.click(await screen.findByRole('button', { name: 'Documentos de Departamento de Estradas de Rodagem' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Documentos — Departamento de Estradas de Rodagem' });
    expect(await within(dialogo).findByText(/Nenhum documento anexado/)).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Anexar documento' }));
    const opcoes = within(within(dialogo).getByRole('form', { name: 'Enviar documento' })).getAllByRole('option');
    expect(opcoes.map((o) => o.textContent)).toEqual(['Escolha a categoria', 'Contrato', 'Documentos Cadastrais', 'Termo de Aceite', 'Outro']);
  });

  it('link direto (?documentos=ID) abre os documentos do cliente', async () => {
    servidor.responder([
      { metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([cliente]) },
      { metodo: 'get', url: '/anexos', status: 200, corpo: { sucesso: true, dados: [anexoDe('cliente', 1, 'Contrato', 'Contrato CT-045')] } },
    ]);

    renderizarComProvedores(<Clientes />, { rota: '/clientes?documentos=1&nome=DER' });

    const dialogo = await screen.findByRole('dialog', { name: 'Documentos — DER' });
    expect(await within(dialogo).findByText('Contrato CT-045')).toBeInTheDocument();
    expect(servidor.requisicoes.find((r) => r.url === '/anexos')?.params).toEqual({ entidade: 'cliente', entidade_id: 1 });

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
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

describe('Clientes (espanhol)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useToasts.setState({ itens: [] });
    useAutenticacao.getState().sair();
    entrarComoPerfil('GESTOR');
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'es' });
  });
  afterEach(() => {
    usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'pt-BR' });
  });

  it('traduz titulo, cabecalhos, tipo e acoes; preserva os dados do banco', async () => {
    const servidor = instalarServidorFalso();
    servidor.responder([{ metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([cliente]) }]);

    renderizarComProvedores(<Clientes />);

    expect(await screen.findByText('Departamento de Estradas de Rodagem')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getByText('Razón social')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Organismo público')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Departamento de Estradas de Rodagem' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inactivar Departamento de Estradas de Rodagem' })).toBeInTheDocument();
    expect(screen.queryByText('Razão social')).not.toBeInTheDocument();
  });

  it('as mensagens de validacao do formulario saem em espanhol', async () => {
    const servidor = instalarServidorFalso();
    servidor.responder([{ metodo: 'get', url: '/clientes', status: 200, corpo: paginaCom([]) }]);
    renderizarComProvedores(<Clientes />);

    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo cliente' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Seleccione el tipo de cliente')).toBeInTheDocument();
    expect(screen.getByText('Ingrese el CNPJ')).toBeInTheDocument();
  });
});
