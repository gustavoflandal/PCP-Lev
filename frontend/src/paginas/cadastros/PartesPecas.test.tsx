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

  it('mostra check quando ha foto/documento e icone de inexistente quando nao ha', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/partes-pecas',
        status: 200,
        corpo: paginaCom([
          { ...peca, qtd_fotos: 2, qtd_documentos: 0 },
          { ...peca, id: 2, codigo: 'CON-002', qtd_fotos: 0, qtd_documentos: 1 },
        ]),
      },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
    ]);

    renderizarComProvedores(<PartesPecas />);

    expect(await screen.findByRole('button', { name: 'Ver fotos de CON-001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver documentos de CON-002' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Sem documento cadastrado' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Sem foto cadastrada' })).toBeInTheDocument();
  });

  it('controla validade so fica habilitado com lote, e desmarca junto', async () => {
    servidor.responder([
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaCom([]) },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
    ]);

    renderizarComProvedores(<PartesPecas />);
    await screen.findByText(/Nenhuma parte ou peça cadastrada/);
    await userEvent.click(screen.getByRole('button', { name: 'Nova peça' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nova peça' });

    const validade = within(dialogo).getByLabelText('Controla validade');
    expect(validade).toBeDisabled();
    expect(within(dialogo).queryByLabelText(/Validade mínima/)).not.toBeInTheDocument();

    await userEvent.click(within(dialogo).getByLabelText('Controla lote'));
    expect(validade).toBeEnabled();
    await userEvent.click(validade);
    expect(within(dialogo).getByLabelText(/Validade mínima/)).toBeInTheDocument();

    await userEvent.click(within(dialogo).getByLabelText('Controla lote'));
    expect(validade).not.toBeChecked();
    expect(validade).toBeDisabled();
  });

  it('envia as flags de controle, a validade minima e a mascara de serie', async () => {
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
    await userEvent.type(within(dialogo).getByLabelText(/^Descrição/), 'Conector RCA macho');
    await userEvent.type(within(dialogo).getByLabelText(/^Unidade/), 'und');
    await userEvent.click(within(dialogo).getByLabelText('Controla número de série'));
    await userEvent.click(within(dialogo).getByLabelText('Controla lote'));
    await userEvent.click(within(dialogo).getByLabelText('Controla validade'));
    await userEvent.click(within(dialogo).getByLabelText('Item crítico (exige foto principal)'));
    const minimo = within(dialogo).getByLabelText(/Validade mínima/);
    await userEvent.clear(minimo);
    await userEvent.type(minimo, '180');
    await userEvent.type(within(dialogo).getByLabelText('Máscara do número de série'), 'SN-\\d{{6}');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Peça cadastrada'));
    const envio = servidor.requisicoes.find((r) => r.metodo === 'post');
    expect(envio?.corpo).toMatchObject({
      controla_numero_serie: true,
      controla_lote: true,
      controla_validade: true,
      item_critico: true,
      exige_certificado: false,
      validade_minima_dias: 180,
      mascara_serie: 'SN-\\d{6}',
    });
  });

  it('o check de fotos abre o mosaico, tambem para quem so consulta; nao ha botao de midia na tabela', async () => {
    entrarComo('OPERADOR');
    servidor.responder([
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaCom([{ ...peca, qtd_fotos: 1 }]) },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
      {
        metodo: 'get',
        url: '/anexos',
        status: 200,
        corpo: { sucesso: true, dados: [{ id: 1, tipo: 'FOTO', titulo: 'Frente', url: '/f1', miniatura_url: '/m1', arquivo: { nome_original: 'a.jpg' } }] },
      },
    ]);

    renderizarComProvedores(<PartesPecas />);
    expect(await screen.findByRole('button', { name: 'Ver fotos de CON-001' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mídia e documentos/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver fotos de CON-001' }));

    expect(await screen.findByRole('img', { name: /Foto da peça CON-001 — Frente/ })).toHaveAttribute('src', '/m1');
    const consulta = servidor.requisicoes.find((r) => r.url === '/anexos');
    expect(consulta?.params).toEqual({ entidade: 'parte_peca', entidade_id: 1 });
  });

  it('a inclusao de fotos fica na edicao da peca', async () => {
    servidor.responder([
      { metodo: 'get', url: '/partes-pecas', status: 200, corpo: paginaCom([peca]) },
      { metodo: 'get', url: '/fornecedores', status: 200, corpo: paginaCom([]) },
      { metodo: 'get', url: '/anexos', status: 200, corpo: { sucesso: true, dados: [] } },
    ]);

    renderizarComProvedores(<PartesPecas />);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar CON-001' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir fotos' }));

    expect(await screen.findByRole('dialog', { name: 'Fotos — CON-001' })).toBeInTheDocument();
  });
});
