import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao } from '@/store/autenticacao';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { Usuarios } from './Usuarios';

const catalogo = [
  { codigo: 'fornecedores.visualizar', modulo: 'fornecedores', acao: 'visualizar', descricao: 'Ver', sensivel: false },
  { codigo: 'fornecedores.incluir', modulo: 'fornecedores', acao: 'incluir', descricao: 'Incluir', sensivel: false },
];

const perfis = [
  { codigo: 'ADMIN', nome: 'Administrador', descricao: '', sistema: true, permissoes: catalogo.map((p) => p.codigo), usuarios: 1 },
  { codigo: 'CONSULTA', nome: 'Consulta', descricao: '', sistema: true, permissoes: ['fornecedores.visualizar'], usuarios: 1 },
];

const maria = {
  id: 7, username: 'maria.souza', nome: 'Maria Souza', email: 'maria@exemplo.com', perfil: 'CONSULTA',
  situacao: 'ATIVO', telefone: '', setor: 'Compras', matricula: 'M-42', deve_trocar_senha: true, created_at: '2026-10-01T10:00:00Z',
};
const eu = { ...maria, id: 1, username: 'teste', nome: 'Usuário de Teste', perfil: 'ADMIN', deve_trocar_senha: false, matricula: undefined };

const paginacao = { pagina: 1, limite: 20, total: 2, total_paginas: 1 };

function responderPadrao(servidor: ServidorFalso, extras: Parameters<ServidorFalso['responder']>[0] = []) {
  servidor.responder([
    { metodo: 'get', url: '/usuarios/opcoes', status: 200, corpo: { dados: { perfis, permissoes: catalogo } } },
    { metodo: 'get', url: /^\/usuarios$/, status: 200, corpo: { dados: [eu, maria], paginacao } },
    ...extras,
  ]);
}

describe('Usuarios', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
    entrarComoPerfil('ADMIN');
  });

  it('lista com perfil, situacao e senha temporaria; filtra ativos por padrao', async () => {
    responderPadrao(servidor);

    renderizarComProvedores(<Usuarios />);

    const linha = (await screen.findByText('Maria Souza')).closest('tr')!;
    expect(within(linha).getByText('Consulta')).toBeInTheDocument();
    expect(within(linha).getByText('Senha temporária')).toBeInTheDocument();
    expect(within(linha).getByText('Nunca entrou')).toBeInTheDocument();
    const listagem = servidor.requisicoes.find((r) => r.url === '/usuarios');
    expect(listagem?.params).toMatchObject({ status: 'ATIVO', ordenar_por: 'nome' });
  });

  it('a propria linha nao tem acoes', async () => {
    responderPadrao(servidor);

    renderizarComProvedores(<Usuarios />);

    const linha = (await screen.findByText('Usuário de Teste')).closest('tr')!;
    expect(within(linha).queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(within(linha).getByText('Peça a outro administrador')).toBeInTheDocument();
  });

  it('cadastra com senha temporaria sugerida', async () => {
    responderPadrao(servidor, [{ metodo: 'post', url: '/usuarios', status: 201, corpo: { dados: { ...maria, id: 9, nome: 'Pedro Lima' } } }]);
    renderizarComProvedores(<Usuarios />);

    await userEvent.click(await screen.findByRole('button', { name: 'Novo usuário' }));
    const form = screen.getByRole('form', { name: 'Novo usuário' });
    await userEvent.type(within(form).getByLabelText(/Usuário \(login\)/), 'pedro.lima');
    await userEvent.type(within(form).getByLabelText(/Nome completo/), 'Pedro Lima');
    await userEvent.type(within(form).getByLabelText(/E-mail/), 'pedro@exemplo.com');
    await userEvent.selectOptions(within(form).getByLabelText(/Perfil/), 'CONSULTA');
    await userEvent.click(within(form).getByRole('button', { name: 'Cadastrar usuário' }));

    await waitFor(() => {
      const corpo = servidor.requisicoes.find((r) => r.metodo === 'post')?.corpo as Record<string, unknown>;
      expect(corpo).toMatchObject({ username: 'pedro.lima', nome: 'Pedro Lima', perfil: 'CONSULTA', matricula: null });
      expect(String(corpo.senha_temporaria)).toHaveLength(10);
    });
  });

  it('bloqueia pela acao Situacao', async () => {
    responderPadrao(servidor, [{ metodo: 'post', url: '/usuarios/7/situacao', status: 200, corpo: { dados: { ...maria, situacao: 'BLOQUEADO' } } }]);
    renderizarComProvedores(<Usuarios />);

    await userEvent.click(await screen.findByRole('button', { name: 'Situação de Maria Souza' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar situação' }));

    await waitFor(() => {
      expect(servidor.requisicoes.find((r) => r.url === '/usuarios/7/situacao')?.corpo).toEqual({
        situacao: 'BLOQUEADO', data_desligamento: null,
      });
    });
  });

  it('concede permissao individual com justificativa', async () => {
    const depois = {
      individuais: [{ codigo: 'fornecedores.incluir', concedida: true, justificativa: 'cobre as ferias do comprador', created_at: '2026-10-24T10:00:00Z' }],
      efetivas: ['fornecedores.incluir', 'fornecedores.visualizar'],
    };
    responderPadrao(servidor, [
      { metodo: 'get', url: '/usuarios/7/permissoes', status: 200, corpo: { dados: { individuais: [], efetivas: ['fornecedores.visualizar'] } } },
      { metodo: 'put', url: '/usuarios/7/permissoes/fornecedores.incluir', status: 200, corpo: { dados: depois } },
    ]);
    renderizarComProvedores(<Usuarios />);

    await userEvent.click(await screen.findByRole('button', { name: 'Permissões de Maria Souza' }));
    expect(await screen.findByText('Do perfil')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Conceder: Cadastrar' }));
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Justificativa/), 'cobre as ferias do comprador');
    await userEvent.click(confirmar);

    expect(await screen.findByText('Concedida individualmente')).toBeInTheDocument();
    expect(servidor.requisicoes.find((r) => r.metodo === 'put')?.corpo).toEqual({
      concedida: true, justificativa: 'cobre as ferias do comprador',
    });
  });
});
