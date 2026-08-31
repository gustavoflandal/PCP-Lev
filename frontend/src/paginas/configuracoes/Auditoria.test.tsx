import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao } from '@/store/autenticacao';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { Auditoria } from './Auditoria';

const respostaLoginAdmin = {
  access_token: 'token-abc', token_type: 'Bearer', expires_in: 28800,
  usuario: {
    id: 1, username: 'admin', nome: 'Admin', perfil: 'ADMIN' as const,
    tema: 'automatico' as const, alto_contraste: false, densidade: 'compacta' as const, tamanho_fonte: 'padrao' as const,
  },
};

const paginaVazia = { dados: [], paginacao: { pagina: 1, limite: 20, total: 0, total_paginas: 0 } };

const registroUpdate = {
  id: 1, tabela: 'fornecedores', operacao: 'UPDATE', registro_id: 7,
  dados_antigos: { razao_social: 'Nome Antigo', ativo: true },
  dados_novos: { razao_social: 'Nome Novo', ativo: true },
  usuario_id: 1, usuario_nome: 'Administrador do Sistema',
  data_hora: '2026-08-31T13:00:00Z', endereco_ip: '203.0.113.7',
};

const registroInsert = {
  id: 2, tabela: 'fornecedores', operacao: 'INSERT', registro_id: 8,
  dados_novos: { razao_social: 'Fornecedor Novo' },
  usuario_id: 1, usuario_nome: 'Administrador do Sistema',
  data_hora: '2026-08-31T14:00:00Z', endereco_ip: '203.0.113.7',
};

describe('Auditoria', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    useToasts.setState({ itens: [] });
  });

  it('acesso restrito a administradores mostra a mensagem em vez da tabela', () => {
    useAutenticacao.getState().entrar({
      ...respostaLoginAdmin,
      usuario: { ...respostaLoginAdmin.usuario, perfil: 'GESTOR' },
    });
    servidor.responder([{ metodo: 'get', url: '/auditoria', status: 200, corpo: paginaVazia }]);

    renderizarComProvedores(<Auditoria />);

    expect(screen.getByRole('alert')).toHaveTextContent(/acesso restrito/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('lista os registros com usuario, tabela e acao', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/auditoria', status: 200, corpo: { dados: [registroUpdate], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
    ]);

    renderizarComProvedores(<Auditoria />);

    expect(await screen.findByText('Administrador do Sistema')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Fornecedores' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Alterado' })).toBeInTheDocument();
  });

  it('filtrar por tabela envia o parametro certo e volta para a pagina 1', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/auditoria', status: 200, corpo: paginaVazia }]);

    renderizarComProvedores(<Auditoria />);
    await screen.findByRole('table');

    await userEvent.selectOptions(screen.getByLabelText('Tabela'), 'fornecedores');

    await waitFor(() => {
      const requisicao = servidor.requisicoes.filter((r) => r.url === '/auditoria').at(-1);
      expect(requisicao?.params).toMatchObject({ tabela: 'fornecedores', pagina: 1 });
    });
  });

  it('Ver detalhes de um UPDATE mostra o campo alterado com antes e depois', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/auditoria', status: 200, corpo: { dados: [registroUpdate], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
    ]);

    renderizarComProvedores(<Auditoria />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ver detalhes' }));

    expect(screen.getByText('razao_social')).toBeInTheDocument();
    expect(screen.getByText('Nome Antigo')).toBeInTheDocument();
    expect(screen.getByText('Nome Novo')).toBeInTheDocument();
    // "ativo" nao mudou (true nos dois lados) -- nao deve aparecer no diff.
    expect(screen.queryByText('ativo')).not.toBeInTheDocument();
  });

  it('Ver detalhes de um INSERT mostra so o valor novo, sem "anterior"', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/auditoria', status: 200, corpo: { dados: [registroInsert], paginacao: { pagina: 1, limite: 20, total: 1, total_paginas: 1 } } },
    ]);

    renderizarComProvedores(<Auditoria />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ver detalhes' }));

    expect(screen.getByText('razao_social')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor Novo')).toBeInTheDocument();
  });

  it('exportar CSV baixa o arquivo com os filtros aplicados', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    URL.createObjectURL = () => 'blob:teste';
    URL.revokeObjectURL = () => {};
    const cliqueEspiao = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    servidor.responder([
      { metodo: 'get', url: '/auditoria', status: 200, corpo: paginaVazia },
      { metodo: 'get', url: '/auditoria/exportar', status: 200, corpo: new Blob(['data_hora;usuario']) },
    ]);
    renderizarComProvedores(<Auditoria />);
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    await waitFor(() => expect(cliqueEspiao).toHaveBeenCalledTimes(1));
    cliqueEspiao.mockRestore();
  });

  it('exportar CSV com falha na API mostra toast de erro', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/auditoria', status: 200, corpo: paginaVazia },
      { metodo: 'get', url: '/auditoria/exportar', status: 500, corpo: { sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' } } },
    ]);
    renderizarComProvedores(<Auditoria />);
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Erro interno do servidor'));
  });
});
