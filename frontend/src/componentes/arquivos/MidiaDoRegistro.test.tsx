import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import {
  entrarComoPerfil,
  instalarServidorFalso,
  renderizarComProvedores,
  type ServidorFalso,
} from '@/testes/utilitarios';
import { MidiaDoRegistro } from './MidiaDoRegistro';

const arquivoBase = {
  sha256: 'abc',
  tamanho: 1000,
  created_at: '2026-10-20T12:00:00Z',
};

function foto(id: number, principal: boolean) {
  return {
    id,
    entidade: 'parte_peca',
    entidade_id: 7,
    tipo: 'FOTO',
    categoria: '',
    titulo: '',
    descricao: '',
    versao: '',
    documento_chave: id,
    vigente: true,
    principal,
    ordem: id,
    arquivo: { ...arquivoBase, id: `uuid-${id}`, nome_original: `foto-${id}.jpg`, tipo_mime: 'image/jpeg', tem_miniatura: true },
    created_at: '2026-10-20T12:00:00Z',
    url: `/api/v1/arquivos/uuid-${id}/conteudo?exp=1&sig=x`,
    miniatura_url: `/api/v1/arquivos/uuid-${id}/conteudo?exp=1&sig=y&mini=1`,
  };
}

function documento(id: number, chave: number, vigente: boolean, versao: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    entidade: 'parte_peca',
    entidade_id: 7,
    tipo: 'DOCUMENTO',
    categoria: 'Datasheet',
    titulo: 'Datasheet do conector',
    descricao: '',
    versao,
    documento_chave: chave,
    vigente,
    principal: false,
    ordem: id,
    arquivo: { ...arquivoBase, id: `uuid-${id}`, nome_original: `ds-${versao}.pdf`, tipo_mime: 'application/pdf', tem_miniatura: false },
    created_at: '2026-10-20T12:00:00Z',
    url: `/api/v1/arquivos/uuid-${id}/conteudo?exp=1&sig=z`,
    ...extra,
  };
}

const vazio = { sucesso: true, dados: [], paginacao: { pagina: 1, limite: 200, total: 0, total_paginas: 0 } };

function rotasBase(anexos: unknown[]) {
  return [
    { metodo: 'get' as const, url: '/anexos', status: 200, corpo: { sucesso: true, dados: anexos } },
    { metodo: 'get' as const, url: '/fornecedores', status: 200, corpo: vazio },
  ];
}

describe('MidiaDoRegistro', () => {
  let servidor: ServidorFalso;
  const criarOriginal = URL.createObjectURL;
  const revogarOriginal = URL.revokeObjectURL;

  beforeEach(() => {
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
    entrarComoPerfil('GESTOR');
    // jsdom nao implementa URL de objeto (pre-visualizacao da foto).
    URL.createObjectURL = vi.fn(() => 'blob:previa');
    URL.revokeObjectURL = vi.fn();
  });

  // afterAll, nao afterEach: a desmontagem (cleanup do setup) ainda revoga a URL.
  afterAll(() => {
    URL.createObjectURL = criarOriginal;
    URL.revokeObjectURL = revogarOriginal;
  });

  it('lista a foto principal, a galeria e o documento vigente com historico', async () => {
    servidor.responder(
      rotasBase([
        foto(1, true),
        foto(2, false),
        documento(11, 10, true, 'B', { data_validade: '2020-01-31' }),
        documento(10, 10, false, 'A'),
      ]),
    );

    renderizarComProvedores(<MidiaDoRegistro entidade="parte_peca" entidadeId={7} codigo="CON-001" podeEditar />);

    const principal = await screen.findByRole('img', { name: 'Foto principal de CON-001' });
    expect(principal).toHaveAttribute('src', expect.stringContaining('mini=1'));
    expect(principal).toHaveAttribute('loading', 'lazy');
    // Clique na miniatura abre a imagem em tamanho real em nova aba.
    expect(principal.closest('a')).toHaveAttribute('href', '/api/v1/arquivos/uuid-1/conteudo?exp=1&sig=x');
    expect(principal.closest('a')).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('img', { name: 'Foto 1 da galeria de CON-001' })).toBeInTheDocument();
    expect(screen.getByText(/Galeria:/)).toHaveTextContent('Galeria: 1 de 10');

    expect(screen.getByText('Datasheet do conector')).toBeInTheDocument();
    expect(screen.getByText('versão B')).toBeInTheDocument();
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir Datasheet do conector' })).toHaveAttribute(
      'href',
      '/api/v1/arquivos/uuid-11/conteudo?exp=1&sig=z',
    );

    const historico = screen.getByRole('button', { name: /Versões anteriores \(1\)/ });
    expect(historico).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(historico);
    expect(historico).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/ds-A\.pdf/)).toBeInTheDocument();
  });

  it('envia a foto: POST /arquivos (multipart) e depois POST /anexos como principal', async () => {
    servidor.responder([
      ...rotasBase([]),
      {
        metodo: 'post',
        url: '/arquivos',
        status: 201,
        corpo: { sucesso: true, dados: { ...arquivoBase, id: 'uuid-novo', nome_original: 'painel.png', tipo_mime: 'image/png', tem_miniatura: true } },
      },
      { metodo: 'post', url: '/anexos', status: 201, corpo: { sucesso: true, dados: foto(3, true) } },
    ]);

    renderizarComProvedores(
      <MidiaDoRegistro entidade="parte_peca" entidadeId={7} codigo="CON-001" podeEditar itemCritico />,
    );

    expect(await screen.findByText(/Item crítico sem foto principal/)).toBeInTheDocument();

    const arquivo = new File(['png'], 'painel.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText(/Nova foto/), arquivo);

    expect(screen.getByRole('img', { name: 'Pré-visualização da foto a enviar' })).toHaveAttribute('src', 'blob:previa');
    expect(screen.getByRole('button', { name: 'Girar 90°' })).toBeInTheDocument();
    expect(screen.getByLabelText('Usar como foto principal')).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Enviar foto' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Foto enviada'));
    const posts = servidor.requisicoes.filter((r) => r.metodo === 'post');
    expect(posts.map((r) => r.url)).toEqual(['/arquivos', '/anexos']);
    expect(posts[0].corpo).toBeInstanceOf(FormData);
    expect((posts[0].corpo as FormData).get('arquivo')).toBeInstanceOf(Blob);
    expect(posts[1].corpo).toMatchObject({
      entidade: 'parte_peca',
      entidade_id: 7,
      arquivo_id: 'uuid-novo',
      tipo: 'FOTO',
      principal: true,
    });
  });

  it('recusa no cliente imagem fora dos tipos aceitos', async () => {
    servidor.responder(rotasBase([]));
    renderizarComProvedores(<MidiaDoRegistro entidade="parte_peca" entidadeId={7} codigo="CON-001" podeEditar />);

    const gif = new File(['gif'], 'animado.gif', { type: 'image/gif' });
    await userEvent.upload(await screen.findByLabelText(/Nova foto/), gif, { applyAccept: false });

    expect(screen.getByRole('alert')).toHaveTextContent('Envie uma foto em JPG, PNG ou WebP.');
    expect(servidor.requisicoes.some((r) => r.metodo === 'post')).toBe(false);
  });

  it('remover a foto principal de item critico mostra a mensagem do 409', async () => {
    servidor.responder([
      ...rotasBase([foto(1, true)]),
      {
        metodo: 'delete',
        url: '/anexos/1',
        status: 409,
        corpo: {
          sucesso: false,
          erro: { codigo: 'CONFLITO', mensagem: 'item critico precisa de foto principal -- envie outra antes de remover esta' },
        },
      },
    ]);

    renderizarComProvedores(
      <MidiaDoRegistro entidade="parte_peca" entidadeId={7} codigo="CON-001" podeEditar itemCritico />,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Remover foto: foto-1.jpg' }));
    const confirmacao = screen.getByRole('dialog', { name: 'Remover foto' });
    await userEvent.click(within(confirmacao).getByRole('button', { name: 'Remover' }));

    expect(await screen.findByText(/item critico precisa de foto principal/)).toBeInTheDocument();
  });

  it('nova versao envia o PDF com substitui_anexo_id', async () => {
    servidor.responder([
      ...rotasBase([documento(11, 11, true, 'A')]),
      {
        metodo: 'post',
        url: '/arquivos',
        status: 201,
        corpo: { sucesso: true, dados: { ...arquivoBase, id: 'uuid-pdf', nome_original: 'ds-b.pdf', tipo_mime: 'application/pdf', tem_miniatura: false } },
      },
      { metodo: 'post', url: '/anexos', status: 201, corpo: { sucesso: true, dados: documento(12, 11, true, 'B') } },
    ]);

    renderizarComProvedores(<MidiaDoRegistro entidade="parte_peca" entidadeId={7} codigo="CON-001" podeEditar />);

    await userEvent.click(await screen.findByRole('button', { name: 'Nova versão de Datasheet do conector' }));
    const formulario = screen.getByRole('form', { name: 'Nova versão do documento' });
    // Categoria e titulo vem da versao anterior.
    expect(within(formulario).getByLabelText(/Categoria/)).toHaveValue('Datasheet');

    const pdf = new File(['%PDF-1.4'], 'ds-b.pdf', { type: 'application/pdf' });
    await userEvent.upload(within(formulario).getByLabelText(/Arquivo PDF/), pdf);
    await userEvent.type(within(formulario).getByLabelText('Versão'), 'B');
    await userEvent.type(within(formulario).getByLabelText('Data de validade'), '2027-12-31');
    await userEvent.click(within(formulario).getByRole('button', { name: 'Enviar nova versão' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Nova versão enviada'));
    const anexo = servidor.requisicoes.find((r) => r.metodo === 'post' && r.url === '/anexos');
    expect(anexo?.corpo).toMatchObject({
      tipo: 'DOCUMENTO',
      arquivo_id: 'uuid-pdf',
      categoria: 'Datasheet',
      titulo: 'Datasheet do conector',
      versao: 'B',
      data_validade: '2027-12-31',
      data_emissao: null,
      substitui_anexo_id: 11,
    });
  });

  it('novo documento exige categoria antes de enviar', async () => {
    servidor.responder(rotasBase([]));
    renderizarComProvedores(<MidiaDoRegistro entidade="parte_peca" entidadeId={7} codigo="CON-001" podeEditar />);

    await userEvent.click(await screen.findByRole('button', { name: 'Novo documento' }));
    const formulario = screen.getByRole('form', { name: 'Novo documento' });
    const pdf = new File(['%PDF-1.4'], 'manual.pdf', { type: 'application/pdf' });
    await userEvent.upload(within(formulario).getByLabelText(/Arquivo PDF/), pdf);
    await userEvent.click(within(formulario).getByRole('button', { name: 'Enviar documento' }));

    expect(await within(formulario).findByText('Escolha a categoria do documento')).toBeInTheDocument();
    expect(servidor.requisicoes.some((r) => r.metodo === 'post')).toBe(false);
  });

  it('mostra a mensagem 400 da API ao anexar', async () => {
    servidor.responder([
      ...rotasBase([]),
      {
        metodo: 'post',
        url: '/arquivos',
        status: 400,
        corpo: { sucesso: false, erro: { codigo: 'ERRO_VALIDACAO', mensagem: 'arquivo grande demais: imagem ate 5 MB, PDF ate 25 MB, XML ate 2 MB' } },
      },
    ]);
    renderizarComProvedores(<MidiaDoRegistro entidade="parte_peca" entidadeId={7} codigo="CON-001" podeEditar />);

    await userEvent.upload(await screen.findByLabelText(/Nova foto/), new File(['jpg'], 'f.jpg', { type: 'image/jpeg' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar foto' }));

    expect(await screen.findByText(/arquivo grande demais/)).toBeInTheDocument();
  });

  it('sem permissao de editar fica so leitura', async () => {
    servidor.responder(rotasBase([foto(1, true), foto(2, false), documento(11, 11, true, 'A')]));

    renderizarComProvedores(
      <MidiaDoRegistro entidade="parte_peca" entidadeId={7} codigo="CON-001" podeEditar={false} />,
    );

    expect(await screen.findByText(/Somente consulta/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir Datasheet do conector' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nova foto/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remover|Tornar principal|Nova versão|Novo documento/ })).not.toBeInTheDocument();
  });

  it('produto acabado oferece a revisao da BOM', async () => {
    servidor.responder([
      ...rotasBase([]),
      {
        metodo: 'get',
        url: '/produtos-acabados/5/boms',
        status: 200,
        corpo: {
          sucesso: true,
          dados: [
            { id: 31, produto_acabado_id: 5, versao: 2, data_vigencia_inicio: '2026-09-01', ativo: true, itens: [], created_at: '', updated_at: '' },
          ],
        },
      },
    ]);
    renderizarComProvedores(<MidiaDoRegistro entidade="produto_acabado" entidadeId={5} codigo="RAD-01" podeEditar />);

    await userEvent.click(await screen.findByRole('button', { name: 'Novo documento' }));
    const bom = screen.getByLabelText('Revisão da BOM');
    expect(await within(bom).findByRole('option', { name: /Versão 2/ })).toBeInTheDocument();
  });
});
