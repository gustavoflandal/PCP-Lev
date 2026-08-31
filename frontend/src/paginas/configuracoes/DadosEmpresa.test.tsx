import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutenticacao } from '@/store/autenticacao';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { DadosEmpresaPagina } from './DadosEmpresa';

const empresaVazia = {
  razao_social: '', nome_fantasia: '', cnpj: '', inscricao_estadual: '', inscricao_municipal: '',
  cnae: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  telefone: '', email: '', site: '', rodape_padrao: '', condicoes_gerais_compra: '', responsavel_tecnico: '',
  tem_logo_claro: false, tem_logo_escuro: false, tem_favicon: false, updated_at: '2026-08-31T10:00:00Z',
};

const respostaLoginAdmin = {
  access_token: 'token-abc', token_type: 'Bearer', expires_in: 28800,
  usuario: {
    id: 1, username: 'admin', nome: 'Admin', perfil: 'ADMIN' as const,
    tema: 'automatico' as const, alto_contraste: false, densidade: 'compacta' as const, tamanho_fonte: 'padrao' as const,
  },
};

describe('DadosEmpresaPagina', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    sessionStorage.clear();
    useAutenticacao.getState().sair();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('acesso restrito a administradores mostra a mensagem em vez do formulario', () => {
    useAutenticacao.getState().entrar({
      ...respostaLoginAdmin,
      usuario: { ...respostaLoginAdmin.usuario, perfil: 'GESTOR' },
    });
    servidor.responder([{ metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: empresaVazia } }]);

    renderizarComProvedores(<DadosEmpresaPagina />);

    expect(screen.getByRole('alert')).toHaveTextContent(/acesso restrito/i);
    expect(screen.queryByLabelText('Razão social')).not.toBeInTheDocument();
  });

  it('carrega os dados atuais e envia o corpo certo ao salvar', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      {
        metodo: 'get', url: '/configuracoes/empresa', status: 200,
        corpo: { dados: { ...empresaVazia, razao_social: 'Industria de Paineis VMS Ltda' } },
      },
      { metodo: 'put', url: '/configuracoes/empresa', status: 200, corpo: { dados: { ...empresaVazia, razao_social: 'Industria de Paineis VMS Ltda' } } },
    ]);

    renderizarComProvedores(<DadosEmpresaPagina />);

    expect(await screen.findByDisplayValue('Industria de Paineis VMS Ltda')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('CNPJ'), '11222333000181');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      const requisicao = servidor.requisicoes.find((r) => r.metodo === 'put' && r.url === '/configuracoes/empresa');
      expect(requisicao?.corpo).toMatchObject({
        razao_social: 'Industria de Paineis VMS Ltda',
        cnpj: '11222333000181',
      });
    });
  });

  it('erro de validacao do backend marca o campo certo', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([
      { metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: { ...empresaVazia, razao_social: 'Nome atual' } } },
      {
        metodo: 'put', url: '/configuracoes/empresa', status: 400,
        corpo: { sucesso: false, erro: { codigo: 'ERRO_VALIDACAO', mensagem: 'invalido', detalhes: [{ campo: 'cnpj', mensagem: 'CNPJ invalido' }] } },
      },
    ]);

    renderizarComProvedores(<DadosEmpresaPagina />);
    await screen.findByDisplayValue('Nome atual');

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('CNPJ invalido')).toBeInTheDocument();
  });

  it('Buscar CEP preenche o endereco a partir da resposta da ViaCEP', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: empresaVazia } }]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ logradouro: 'Rua das Industrias', bairro: 'Distrito Industrial', localidade: 'Sao Jose dos Campos', uf: 'SP' }),
      }),
    );

    renderizarComProvedores(<DadosEmpresaPagina />);
    await screen.findByLabelText('CEP');
    await userEvent.type(screen.getByLabelText('CEP'), '12345678');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar CEP' }));

    expect(await screen.findByDisplayValue('Rua das Industrias')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sao Jose dos Campos')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SP')).toBeInTheDocument();
  });

  it('Buscar CEP nao encontrado avisa sem quebrar o formulario', async () => {
    useAutenticacao.getState().entrar(respostaLoginAdmin);
    servidor.responder([{ metodo: 'get', url: '/configuracoes/empresa', status: 200, corpo: { dados: empresaVazia } }]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ erro: true }) }));

    renderizarComProvedores(<DadosEmpresaPagina />);
    await screen.findByLabelText('CEP');
    await userEvent.type(screen.getByLabelText('CEP'), '00000000');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar CEP' }));

    expect(await screen.findByLabelText('Logradouro')).toHaveValue('');
  });
});
