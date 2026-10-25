import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { hojeAAAAMMDD } from '@/tipos/producao';
import {
  entrarComoPerfil,
  instalarServidorFalso,
  renderizarComProvedores,
  type ServidorFalso,
} from '@/testes/utilitarios';
import { AnexosDoRegistro } from './AnexosDoRegistro';

/** Data AAAA-MM-DD a `dias` de hoje (fuso do navegador, como o selo). */
function daquiA(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return hojeAAAAMMDD(d);
}

function anexo(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    entidade: 'fornecedor',
    entidade_id: 3,
    tipo: 'ANEXO',
    categoria: 'Contrato',
    titulo: `Documento ${id}`,
    descricao: '',
    versao: '',
    documento_chave: id,
    vigente: true,
    principal: false,
    ordem: 0,
    arquivo: {
      id: `uuid-${id}`,
      sha256: 'abc',
      nome_original: `doc-${id}.pdf`,
      tipo_mime: 'application/pdf',
      tamanho: 2048,
      tem_miniatura: false,
      created_at: '2026-10-20T12:00:00Z',
    },
    created_at: '2026-10-20T12:00:00Z',
    created_by: 'compras01',
    url: `/api/v1/arquivos/uuid-${id}/conteudo?exp=1&sig=x`,
    ...extra,
  };
}

const arquivoEnviado = {
  id: 'uuid-novo',
  sha256: 'def',
  nome_original: 'iso-9001.pdf',
  tipo_mime: 'application/pdf',
  tamanho: 4096,
  tem_miniatura: false,
  created_at: '2026-10-24T12:00:00Z',
};

function listar(anexos: unknown[]) {
  return { metodo: 'get' as const, url: '/anexos', status: 200, corpo: { sucesso: true, dados: anexos } };
}

describe('AnexosDoRegistro', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
    entrarComoPerfil('GESTOR');
  });

  it('agrupa por categoria na ordem da lista fechada, com arquivo, tamanho, autor, validade, abrir e baixar', async () => {
    servidor.responder([
      listar([
        anexo(1, { categoria: 'Tabela de Preços', titulo: 'Tabela 2026' }),
        anexo(2, { categoria: 'Certificado de Qualidade', titulo: 'ISO 9001', data_validade: daquiA(-3) }),
        anexo(3, { categoria: 'Certificado de Qualidade', titulo: 'RoHS', data_validade: daquiA(10), data_emissao: '2026-01-10' }),
      ]),
    ]);

    renderizarComProvedores(<AnexosDoRegistro entidade="fornecedor" entidadeId={3} podeEditar />);

    const certificados = await screen.findByRole('region', { name: /Certificado de Qualidade/ });
    const tabela = screen.getByRole('region', { name: /Tabela de Preços/ });
    // Certificado vem antes de Tabela de Preços (ordem de CategoriasFornecedor).
    expect(certificados.compareDocumentPosition(tabela) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(within(certificados).getByText('ISO 9001')).toBeInTheDocument();
    expect(within(certificados).getByText('Vencido')).toBeInTheDocument();
    expect(within(certificados).getByText('Vence em 10 dias')).toBeInTheDocument();
    expect(within(certificados).getByText(/Emissão 10\/01\/2026/)).toBeInTheDocument();
    expect(within(certificados).getAllByText(/por compras01/)).toHaveLength(2);
    expect(within(certificados).getByText('doc-2.pdf')).toBeInTheDocument();
    expect(within(certificados).getAllByText('2 KB')).toHaveLength(2);

    expect(screen.getByRole('link', { name: 'Abrir ISO 9001' })).toHaveAttribute('href', '/api/v1/arquivos/uuid-2/conteudo?exp=1&sig=x');
    expect(screen.getByRole('link', { name: 'Abrir ISO 9001' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Baixar ISO 9001' })).toHaveAttribute('download', 'doc-2.pdf');
    expect(servidor.requisicoes[0].params).toEqual({ entidade: 'fornecedor', entidade_id: 3 });
  });

  it('vazio sugere o que anexar; sem permissao, so consulta', async () => {
    servidor.responder([listar([])]);
    const { unmount } = renderizarComProvedores(<AnexosDoRegistro entidade="pedido_venda" entidadeId={1} podeEditar />);
    expect(await screen.findByText(/Nenhum documento anexado\. Anexe o contrato ou edital/)).toBeInTheDocument();
    unmount();

    servidor.responder([listar([anexo(1)])]);
    renderizarComProvedores(<AnexosDoRegistro entidade="fornecedor" entidadeId={3} podeEditar={false} />);
    expect(await screen.findByText('Documento 1')).toBeInTheDocument();
    expect(screen.getByText(/Somente consulta/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anexar documento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nova versão/ })).not.toBeInTheDocument();
    // Abrir e baixar valem para quem so consulta.
    expect(screen.getByRole('link', { name: 'Baixar Documento 1' })).toBeInTheDocument();
  });

  it('envia: categoria obrigatoria, POST /arquivos e POST /anexos tipo ANEXO com validade', async () => {
    servidor.responder([
      listar([]),
      { metodo: 'post', url: '/arquivos', status: 201, corpo: { sucesso: true, dados: arquivoEnviado } },
      { metodo: 'post', url: '/anexos', status: 201, corpo: { sucesso: true, dados: anexo(9) } },
    ]);

    renderizarComProvedores(<AnexosDoRegistro entidade="fornecedor" entidadeId={3} podeEditar />);

    await userEvent.click(await screen.findByRole('button', { name: 'Anexar documento' }));
    const formulario = screen.getByRole('form', { name: 'Enviar documento' });
    const categoria = within(formulario).getByLabelText(/Categoria/);
    expect(within(categoria).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Escolha a categoria',
      'Contrato',
      'Certificado de Qualidade',
      'Documentos Cadastrais',
      'Tabela de Preços',
      'Outro',
    ]);

    await userEvent.upload(
      within(formulario).getByLabelText(/Arquivo/),
      new File(['%PDF-1.4'], 'iso-9001.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(within(formulario).getByRole('button', { name: 'Enviar documento' }));
    expect(await within(formulario).findByText('Escolha a categoria do documento')).toBeInTheDocument();
    expect(servidor.requisicoes.some((r) => r.metodo === 'post')).toBe(false);

    await userEvent.selectOptions(categoria, 'Certificado de Qualidade');
    await userEvent.type(within(formulario).getByLabelText('Data de emissão'), '2026-01-10');
    await userEvent.type(within(formulario).getByLabelText('Data de validade'), '2027-01-10');
    await userEvent.click(within(formulario).getByRole('button', { name: 'Enviar documento' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Documento enviado'));
    const posts = servidor.requisicoes.filter((r) => r.metodo === 'post');
    expect(posts.map((r) => r.url)).toEqual(['/arquivos', '/anexos']);
    expect(posts[0].corpo).toBeInstanceOf(FormData);
    expect(posts[1].corpo).toMatchObject({
      entidade: 'fornecedor',
      entidade_id: 3,
      arquivo_id: 'uuid-novo',
      tipo: 'ANEXO',
      categoria: 'Certificado de Qualidade',
      // Titulo em branco vira o nome do arquivo (sem extensao).
      titulo: 'iso-9001',
      data_emissao: '2026-01-10',
      data_validade: '2027-01-10',
      substitui_anexo_id: null,
    });
    expect(screen.queryByRole('form', { name: 'Enviar documento' })).not.toBeInTheDocument();
  });

  it('recusa no navegador arquivo que nao e PDF nem imagem', async () => {
    servidor.responder([listar([])]);
    renderizarComProvedores(<AnexosDoRegistro entidade="cliente" entidadeId={3} podeEditar />);

    await userEvent.click(await screen.findByRole('button', { name: 'Anexar documento' }));
    const formulario = screen.getByRole('form', { name: 'Enviar documento' });
    await userEvent.upload(
      within(formulario).getByLabelText(/Arquivo/),
      new File(['x'], 'planilha.xlsx', { type: 'application/vnd.ms-excel' }),
      { applyAccept: false },
    );

    expect(await within(formulario).findByText('Envie um PDF ou uma imagem JPG, PNG ou WebP.')).toBeInTheDocument();
  });

  it('nova versao manda substitui_anexo_id e o historico mostra as versoes anteriores', async () => {
    servidor.responder([
      listar([
        anexo(10, { vigente: false, documento_chave: 10, titulo: 'Contrato de fornecimento', arquivo: { ...anexo(10).arquivo, nome_original: 'contrato-v1.pdf' } }),
        anexo(11, { documento_chave: 10, titulo: 'Contrato de fornecimento', arquivo: { ...anexo(11).arquivo, nome_original: 'contrato-v2.pdf' } }),
      ]),
      { metodo: 'post', url: '/arquivos', status: 201, corpo: { sucesso: true, dados: arquivoEnviado } },
      { metodo: 'post', url: '/anexos', status: 201, corpo: { sucesso: true, dados: anexo(12) } },
    ]);

    renderizarComProvedores(<AnexosDoRegistro entidade="fornecedor" entidadeId={3} podeEditar />);

    const historico = await screen.findByRole('button', { name: 'Versões anteriores (1)' });
    expect(screen.queryByText('contrato-v1.pdf')).not.toBeInTheDocument();
    await userEvent.click(historico);
    expect(historico).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('contrato-v1.pdf')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Nova versão de Contrato de fornecimento' }));
    const formulario = screen.getByRole('form', { name: 'Nova versão de Contrato de fornecimento' });
    expect(within(formulario).getByLabelText(/Categoria/)).toHaveValue('Contrato');
    await userEvent.upload(
      within(formulario).getByLabelText(/Arquivo/),
      new File(['%PDF-1.4'], 'contrato-v3.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(within(formulario).getByRole('button', { name: 'Enviar nova versão' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Nova versão enviada'));
    const anexado = servidor.requisicoes.find((r) => r.metodo === 'post' && r.url === '/anexos');
    expect(anexado?.corpo).toMatchObject({ substitui_anexo_id: 11, categoria: 'Contrato', titulo: 'Contrato de fornecimento' });
  });

  it('remove com confirmacao (DELETE /anexos/:id)', async () => {
    servidor.responder([listar([anexo(5)]), { metodo: 'delete', url: '/anexos/5', status: 204 }]);
    renderizarComProvedores(<AnexosDoRegistro entidade="pedido_compra" entidadeId={1} podeEditar />);

    await userEvent.click(await screen.findByRole('button', { name: 'Remover Documento 5' }));
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('Remover "Documento 5"?');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Remover' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Documento removido'));
    expect(servidor.requisicoes.some((r) => r.metodo === 'delete' && r.url === '/anexos/5')).toBe(true);
  });

  it('409 ao remover mostra a mensagem da API', async () => {
    servidor.responder([
      listar([anexo(5)]),
      {
        metodo: 'delete',
        url: '/anexos/5',
        status: 409,
        corpo: {
          sucesso: false,
          erro: { codigo: 'CONFLITO', mensagem: 'o registro esta encerrado: os anexos dele ficam como registro e nao podem ser removidos' },
        },
      },
    ]);
    renderizarComProvedores(<AnexosDoRegistro entidade="pedido_compra" entidadeId={1} podeEditar />);

    await userEvent.click(await screen.findByRole('button', { name: 'Remover Documento 5' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remover' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('o registro esta encerrado');
  });

  it('registro encerrado: sem remover, com aviso, e ainda anexa', async () => {
    servidor.responder([listar([anexo(5, { entidade: 'ordem_producao', categoria: 'Laudo de Teste' })])]);
    renderizarComProvedores(<AnexosDoRegistro entidade="ordem_producao" entidadeId={40} podeEditar encerrado />);

    expect(await screen.findByText('Documento 5')).toBeInTheDocument();
    expect(screen.getByText(/Registro encerrado: os documentos ficam como registro/)).toHaveTextContent('Ainda é possível anexar.');
    expect(screen.queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anexar documento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova versão de Documento 5' })).toBeInTheDocument();
  });

  it('falha ao listar mostra a mensagem e tenta de novo', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/anexos',
        status: 403,
        corpo: { sucesso: false, erro: { codigo: 'ACESSO_NEGADO', mensagem: 'Seu perfil nao tem permissao para estes anexos' } },
      },
    ]);
    renderizarComProvedores(<AnexosDoRegistro entidade="cliente" entidadeId={3} podeEditar={false} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Seu perfil nao tem permissao para estes anexos');
    servidor.responder([listar([])]);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Nenhum documento anexado.')).toBeInTheDocument();
  });
});
