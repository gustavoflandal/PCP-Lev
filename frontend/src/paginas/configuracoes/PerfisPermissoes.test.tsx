import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao } from '@/store/autenticacao';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { PerfisPermissoes } from './PerfisPermissoes';

const catalogo = [
  { codigo: 'estoque.visualizar', modulo: 'estoque', acao: 'visualizar', descricao: 'Ver estoque', sensivel: false },
  { codigo: 'estoque.ajustar', modulo: 'estoque', acao: 'ajustar', descricao: 'Ajustar', sensivel: true },
  { codigo: 'cotacoes.visualizar', modulo: 'cotacoes', acao: 'visualizar', descricao: 'Ver cotacoes', sensivel: false },
];

const perfis = [
  { codigo: 'ADMIN', nome: 'Administrador', descricao: '', sistema: true, permissoes: catalogo.map((p) => p.codigo), usuarios: 1 },
  { codigo: 'ALMOXARIFE', nome: 'Almoxarife', descricao: 'Estoque', sistema: true, permissoes: ['estoque.visualizar'], usuarios: 0 },
  { codigo: 'TEMP', nome: 'Temporário', descricao: '', sistema: false, permissoes: [], usuarios: 0 },
];

function responderPadrao(servidor: ServidorFalso, extras: Parameters<ServidorFalso['responder']>[0] = []) {
  servidor.responder([
    { metodo: 'get', url: '/acesso/perfis', status: 200, corpo: { dados: perfis } },
    { metodo: 'get', url: '/acesso/permissoes', status: 200, corpo: { dados: catalogo } },
    ...extras,
  ]);
}

describe('PerfisPermissoes', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
  });

  it('sem configuracoes.perfis, acesso restrito e nada consultado', () => {
    entrarComoPerfil('GESTOR');

    renderizarComProvedores(<PerfisPermissoes />);

    expect(screen.getByRole('alert')).toHaveTextContent(/acesso restrito/i);
    expect(servidor.requisicoes).toHaveLength(0);
  });

  it('Administrador aparece so para leitura, com tudo marcado', async () => {
    entrarComoPerfil('ADMIN');
    responderPadrao(servidor);

    renderizarComProvedores(<PerfisPermissoes />);

    const matriz = await screen.findByRole('form', { name: 'Permissões do perfil Administrador' });
    for (const caixa of within(matriz).getAllByRole('checkbox')) {
      expect(caixa).toBeChecked();
      expect(caixa).toBeDisabled();
    }
    expect(within(matriz).queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
  });

  it('marcar uma permissao e salvar envia o conjunto inteiro, na ordem do catalogo', async () => {
    entrarComoPerfil('ADMIN');
    responderPadrao(servidor, [{ metodo: 'put', url: '/acesso/perfis/ALMOXARIFE', status: 200, corpo: { dados: perfis[1] } }]);

    renderizarComProvedores(<PerfisPermissoes />);
    await userEvent.click(await screen.findByRole('button', { name: /Almoxarife/ }));
    const matriz = screen.getByRole('form', { name: 'Permissões do perfil Almoxarife' });
    expect(within(matriz).getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await userEvent.click(within(matriz).getByRole('checkbox', { name: /Ajustar saldo manualmente/ }));
    await userEvent.click(within(matriz).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(servidor.requisicoes.find((r) => r.metodo === 'put')?.corpo).toEqual({
        nome: 'Almoxarife', descricao: 'Estoque', permissoes: ['estoque.visualizar', 'estoque.ajustar'],
      });
    });
  });

  it('permissao sensivel e sinalizada', async () => {
    entrarComoPerfil('ADMIN');
    responderPadrao(servidor);

    renderizarComProvedores(<PerfisPermissoes />);
    await userEvent.click(await screen.findByRole('button', { name: /Almoxarife/ }));

    const linha = screen.getByRole('checkbox', { name: /Ajustar saldo manualmente/ }).closest('label');
    expect(linha).toHaveTextContent('Sensível');
  });

  it('trocar de perfil com alteracao nao salva pede confirmacao', async () => {
    entrarComoPerfil('ADMIN');
    responderPadrao(servidor);

    renderizarComProvedores(<PerfisPermissoes />);
    await userEvent.click(await screen.findByRole('button', { name: /Almoxarife/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Ajustar saldo manualmente/ }));
    await userEvent.click(screen.getByRole('button', { name: /Temporário/ }));

    expect(screen.getByRole('dialog', { name: 'Descartar alterações?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(await screen.findByRole('form', { name: 'Permissões do perfil Temporário' })).toBeInTheDocument();
  });

  it('perfil do sistema nao oferece excluir; personalizado sem usuarios oferece', async () => {
    entrarComoPerfil('ADMIN');
    responderPadrao(servidor);

    renderizarComProvedores(<PerfisPermissoes />);
    await userEvent.click(await screen.findByRole('button', { name: /Almoxarife/ }));
    expect(screen.queryByRole('button', { name: 'Excluir perfil' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Temporário/ }));
    expect(screen.getByRole('button', { name: 'Excluir perfil' })).toBeEnabled();
  });

  it('novo perfil copiando permissoes de outro', async () => {
    entrarComoPerfil('ADMIN');
    responderPadrao(servidor, [{
      metodo: 'post', url: '/acesso/perfis', status: 201,
      corpo: { dados: { codigo: 'ALMOX_JR', nome: 'Almoxarife júnior', descricao: '', sistema: false, permissoes: ['estoque.visualizar'], usuarios: 0 } },
    }]);

    renderizarComProvedores(<PerfisPermissoes />);
    await userEvent.click(await screen.findByRole('button', { name: 'Novo perfil' }));
    const dialogo = screen.getByRole('dialog', { name: 'Novo perfil' });
    await userEvent.type(within(dialogo).getByLabelText(/Código/), 'almox jr');
    await userEvent.type(within(dialogo).getByLabelText('Nome'), 'Almoxarife júnior');
    await userEvent.selectOptions(within(dialogo).getByLabelText('Copiar permissões de'), 'ALMOXARIFE');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Criar perfil' }));

    await waitFor(() => {
      expect(servidor.requisicoes.find((r) => r.metodo === 'post')?.corpo).toEqual({
        codigo: 'ALMOX_JR', nome: 'Almoxarife júnior', descricao: '', permissoes: ['estoque.visualizar'],
      });
    });
  });
});
