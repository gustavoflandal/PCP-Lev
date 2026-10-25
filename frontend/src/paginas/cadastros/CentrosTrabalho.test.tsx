import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { useAutenticacao } from '@/store/autenticacao';
import {
  entrarComoPerfil,
  instalarServidorFalso,
  renderizarComProvedores,
  type ServidorFalso,
} from '@/testes/utilitarios';
import { CentrosTrabalho } from './CentrosTrabalho';

const centro = {
  id: 7,
  codigo: 'MONT-01',
  nome: 'Bancada de montagem 1',
  etapa: 'MONTAGEM',
  capacidade_horas_dia: 7.5,
  descricao: 'Montagem de painéis de LED',
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

describe('CentrosTrabalho', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useToasts.setState({ itens: [] });
    useAutenticacao.getState().sair();
    servidor = instalarServidorFalso();
    entrarComoPerfil('GESTOR');
  });

  it('lista com codigo, etapa e capacidade', async () => {
    servidor.responder([{ metodo: 'get', url: '/centros-trabalho', status: 200, corpo: paginaCom([centro]) }]);

    renderizarComProvedores(<CentrosTrabalho />);

    expect(await screen.findByText('MONT-01')).toBeInTheDocument();
    expect(screen.getByText('Bancada de montagem 1')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Montagem' })).toBeInTheDocument();
    expect(screen.getByText('7,5 h/dia')).toBeInTheDocument();
  });

  it('sem producao.custos o campo custo por hora some e nao e enviado', async () => {
    useAutenticacao.getState().entrar({
      access_token: 't', token_type: 'Bearer', expires_in: 60,
      usuario: {
        id: 2, username: 'pcp', nome: 'PCP', perfil: 'PERSONALIZADO',
        tema: 'automatico', alto_contraste: false, densidade: 'compacta', tamanho_fonte: 'padrao',
      },
      permissoes: ['centros_trabalho.visualizar', 'centros_trabalho.incluir'],
      perfil_nome: 'Personalizado',
    });
    servidor.responder([
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: paginaCom([]) },
      { metodo: 'post', url: '/centros-trabalho', status: 201, corpo: { sucesso: true, dados: centro } },
    ]);

    renderizarComProvedores(<CentrosTrabalho />);
    await screen.findByText(/Nenhum centro de trabalho encontrado/);
    await userEvent.click(screen.getByRole('button', { name: 'Novo centro de trabalho' }));
    const dialogo = screen.getByRole('dialog', { name: 'Novo centro de trabalho' });
    expect(within(dialogo).queryByLabelText(/Custo por hora/)).not.toBeInTheDocument();

    await userEvent.type(within(dialogo).getByLabelText(/Código/), 'sep-01');
    await userEvent.type(within(dialogo).getByLabelText(/^Nome/), 'Separação 1');
    await userEvent.selectOptions(within(dialogo).getByLabelText(/^Etapa/), 'SEPARACAO');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(servidor.requisicoes.some((r) => r.metodo === 'post')).toBe(true));
    expect(servidor.requisicoes.find((r) => r.metodo === 'post')?.corpo).not.toHaveProperty('custo_hora');
  });

  it('capacidade nula aparece como travessao', async () => {
    servidor.responder([
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: paginaCom([{ ...centro, capacidade_horas_dia: null }]) },
    ]);

    renderizarComProvedores(<CentrosTrabalho />);

    await screen.findByText('MONT-01');
    expect(screen.getByRole('cell', { name: '—' })).toBeInTheDocument();
  });

  it('filtro por etapa vai na consulta', async () => {
    servidor.responder([{ metodo: 'get', url: '/centros-trabalho', status: 200, corpo: paginaCom([]) }]);

    renderizarComProvedores(<CentrosTrabalho />);
    await screen.findByText(/Nenhum centro de trabalho encontrado/);

    await userEvent.selectOptions(screen.getByLabelText('Etapa'), 'TESTES');

    await waitFor(() => expect(servidor.requisicoes.some((r) => r.params.etapa === 'TESTES')).toBe(true));
  });

  it('operador ve a lista, mas nao as acoes de escrita', async () => {
    entrarComoPerfil('OPERADOR');
    servidor.responder([{ metodo: 'get', url: '/centros-trabalho', status: 200, corpo: paginaCom([centro]) }]);

    renderizarComProvedores(<CentrosTrabalho />);

    await screen.findByText('MONT-01');
    expect(screen.queryByRole('button', { name: 'Novo centro de trabalho' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inativar/ })).not.toBeInTheDocument();
  });

  it('cadastrar envia codigo em caixa alta e capacidade decimal', async () => {
    servidor.responder([
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: paginaCom([]) },
      { metodo: 'post', url: '/centros-trabalho', status: 201, corpo: { sucesso: true, dados: centro } },
    ]);

    renderizarComProvedores(<CentrosTrabalho />);
    await screen.findByText(/Nenhum centro de trabalho encontrado/);
    await userEvent.click(screen.getByRole('button', { name: 'Novo centro de trabalho' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo centro de trabalho' });
    await userEvent.type(within(dialogo).getByLabelText(/Código/), 'mont-01');
    await userEvent.type(within(dialogo).getByLabelText(/^Nome/), 'Bancada de montagem 1');
    await userEvent.selectOptions(within(dialogo).getByLabelText(/^Etapa/), 'MONTAGEM');
    await userEvent.type(within(dialogo).getByLabelText(/Capacidade/), '7,5');
    await userEvent.type(within(dialogo).getByLabelText(/Custo por hora/), '62,50');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Centro de trabalho cadastrado'));

    const envio = servidor.requisicoes.find((r) => r.metodo === 'post');
    expect(envio?.corpo).toEqual({
      codigo: 'MONT-01',
      nome: 'Bancada de montagem 1',
      etapa: 'MONTAGEM',
      capacidade_horas_dia: 7.5,
      custo_hora: 62.5,
      descricao: '',
      ativo: true,
    });
  });

  it('capacidade acima de 24 horas e barrada no formulario', async () => {
    servidor.responder([{ metodo: 'get', url: '/centros-trabalho', status: 200, corpo: paginaCom([]) }]);

    renderizarComProvedores(<CentrosTrabalho />);
    await screen.findByText(/Nenhum centro de trabalho encontrado/);
    await userEvent.click(screen.getByRole('button', { name: 'Novo centro de trabalho' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo centro de trabalho' });
    await userEvent.type(within(dialogo).getByLabelText(/Código/), 'TST-01');
    await userEvent.type(within(dialogo).getByLabelText(/^Nome/), 'Teste');
    await userEvent.selectOptions(within(dialogo).getByLabelText(/^Etapa/), 'TESTES');
    await userEvent.type(within(dialogo).getByLabelText(/Capacidade/), '25');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByText(/maior que 0 e até 24 horas/)).toBeInTheDocument();
    expect(servidor.requisicoes.some((r) => r.metodo === 'post')).toBe(false);
  });

  it('conflito 409 de codigo mostra alerta e mantem o modal aberto', async () => {
    servidor.responder([
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: paginaCom([]) },
      {
        metodo: 'post',
        url: '/centros-trabalho',
        status: 409,
        corpo: { sucesso: false, erro: { codigo: 'CONFLITO', mensagem: 'ja existe um centro de trabalho com este codigo' } },
      },
    ]);

    renderizarComProvedores(<CentrosTrabalho />);
    await screen.findByText(/Nenhum centro de trabalho encontrado/);
    await userEvent.click(screen.getByRole('button', { name: 'Novo centro de trabalho' }));

    const dialogo = screen.getByRole('dialog', { name: 'Novo centro de trabalho' });
    await userEvent.type(within(dialogo).getByLabelText(/Código/), 'MONT-01');
    await userEvent.type(within(dialogo).getByLabelText(/^Nome/), 'Outra bancada');
    await userEvent.selectOptions(within(dialogo).getByLabelText(/^Etapa/), 'MONTAGEM');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('ja existe um centro de trabalho com este codigo');
  });

  it('editar trava o codigo e envia o original', async () => {
    servidor.responder([
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: paginaCom([centro]) },
      { metodo: 'put', url: '/centros-trabalho/7', status: 200, corpo: { sucesso: true, dados: centro } },
    ]);

    renderizarComProvedores(<CentrosTrabalho />);
    await screen.findByText('MONT-01');
    await userEvent.click(screen.getByRole('button', { name: 'Editar MONT-01' }));

    const dialogo = screen.getByRole('dialog', { name: 'Editar centro de trabalho' });
    expect(within(dialogo).getByLabelText(/Código/)).toBeDisabled();
    expect(within(dialogo).getByLabelText(/Capacidade/)).toHaveValue('7,5');

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Centro de trabalho atualizado'));
    const envio = servidor.requisicoes.find((r) => r.metodo === 'put');
    expect(envio?.corpo).toMatchObject({ codigo: 'MONT-01', capacidade_horas_dia: 7.5, etapa: 'MONTAGEM' });
  });
});
