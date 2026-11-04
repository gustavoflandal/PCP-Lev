import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { ApisIntegracao } from './ApisIntegracao';

const CHAVE_ATIVA = {
  id: 1, nome: 'ERP Protheus', descricao: 'leitura geral', prefixo: 'pcp_ab12cd34', ativo: true,
  criado_por: 'admin', created_at: '2026-10-20T10:00:00Z', ultimo_uso: '2026-10-25T08:30:00Z',
};
const CHAVE_REVOGADA = {
  id: 2, nome: 'Teste antigo', descricao: '', prefixo: 'pcp_ffff0000', ativo: false,
  criado_por: 'admin', created_at: '2026-09-01T10:00:00Z', revogada_em: '2026-09-02T10:00:00Z', revogada_por: 'admin',
};

const ENDPOINTS = [
  {
    metodo: 'GET', caminho: '/api/integracao/v1/clientes', recurso: 'Clientes', descricao: 'Lista os clientes.',
    parametros: [{ nome: 'pagina', onde: 'consulta', descricao: 'Número da página, a partir de 1 (padrão 1).' }],
    exemplo: '{"sucesso":true,"dados":[]}',
  },
  {
    metodo: 'GET', caminho: '/api/integracao/v1/clientes/{id}', recurso: 'Clientes', descricao: 'Um cliente pelo identificador.',
    parametros: [{ nome: 'id', onde: 'caminho', descricao: 'Identificador numérico do registro.' }],
    exemplo: '{"sucesso":true,"dados":{"id":7}}',
  },
];

describe('ApisIntegracao', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    servidor = instalarServidorFalso();
    useToasts.setState({ itens: [] });
  });

  function responderListas(chaves = [CHAVE_ATIVA, CHAVE_REVOGADA]) {
    servidor.responder([
      { metodo: 'get', url: '/integracao/chaves', status: 200, corpo: { sucesso: true, dados: chaves } },
      { metodo: 'get', url: '/integracao/endpoints', status: 200, corpo: { sucesso: true, dados: ENDPOINTS } },
    ]);
  }

  it('lista as chaves (ativa e revogada) sem expor o segredo e documenta os endpoints', async () => {
    responderListas();
    renderizarComProvedores(<ApisIntegracao />);

    await screen.findByText('ERP Protheus');
    const tabelaChaves = screen.getByRole('table', { name: 'Chaves de API' });
    expect(within(tabelaChaves).getByText('ERP Protheus')).toBeInTheDocument();
    expect(within(tabelaChaves).getByText('pcp_ab12cd34…')).toBeInTheDocument();
    expect(within(tabelaChaves).getByText('Ativa')).toBeInTheDocument();
    expect(within(tabelaChaves).getByText('Revogada')).toBeInTheDocument();
    expect(within(tabelaChaves).getByText('Nunca usada')).toBeInTheDocument();
    // So a chave ativa oferece revogar.
    expect(screen.getByRole('button', { name: 'Revogar a chave ERP Protheus' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revogar a chave Teste antigo' })).not.toBeInTheDocument();

    await screen.findByText('/api/integracao/v1/clientes');
    const tabelaEndpoints = screen.getByRole('table', { name: 'Endpoints disponíveis' });
    expect(within(tabelaEndpoints).getByText('/api/integracao/v1/clientes')).toBeInTheDocument();
    expect(within(tabelaEndpoints).getByText('/api/integracao/v1/clientes/{id}')).toBeInTheDocument();
  });

  it('criar chave envia nome e descricao e mostra o segredo uma unica vez', async () => {
    responderListas([]);
    servidor.responder([
      { metodo: 'get', url: '/integracao/chaves', status: 200, corpo: { sucesso: true, dados: [] } },
      { metodo: 'get', url: '/integracao/endpoints', status: 200, corpo: { sucesso: true, dados: ENDPOINTS } },
      {
        metodo: 'post', url: '/integracao/chaves', status: 201,
        corpo: { sucesso: true, dados: { ...CHAVE_ATIVA, chave: 'pcp_segredo-completo-so-agora' } },
      },
    ]);
    renderizarComProvedores(<ApisIntegracao />);

    await userEvent.click(await screen.findByRole('button', { name: 'Nova chave' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Nova chave de API' });
    const criar = within(dialogo).getByRole('button', { name: 'Criar chave' });
    expect(criar).toBeDisabled();

    await userEvent.type(within(dialogo).getByLabelText(/Nome/), 'ERP Protheus');
    await userEvent.type(within(dialogo).getByLabelText('Descrição'), 'leitura geral');
    await userEvent.click(criar);

    await waitFor(() =>
      expect(servidor.requisicoes.find((r) => r.metodo === 'post')?.corpo).toEqual({ nome: 'ERP Protheus', descricao: 'leitura geral' }),
    );
    const criada = await screen.findByRole('dialog', { name: 'Chave criada' });
    expect(within(criada).getByLabelText('Chave de API')).toHaveTextContent('pcp_segredo-completo-so-agora');
    expect(within(criada).getByRole('alert')).toHaveTextContent(/não será mostrada de novo/);

    // Ao concluir, o segredo some da tela.
    await userEvent.click(within(criada).getByRole('button', { name: 'Concluir' }));
    await waitFor(() => expect(screen.queryByText('pcp_segredo-completo-so-agora')).not.toBeInTheDocument());
  });

  it('revogar pede confirmacao e chama DELETE da chave', async () => {
    responderListas();
    servidor.responder([
      { metodo: 'get', url: '/integracao/chaves', status: 200, corpo: { sucesso: true, dados: [CHAVE_ATIVA] } },
      { metodo: 'get', url: '/integracao/endpoints', status: 200, corpo: { sucesso: true, dados: ENDPOINTS } },
      { metodo: 'delete', url: '/integracao/chaves/1', status: 204 },
    ]);
    renderizarComProvedores(<ApisIntegracao />);

    await userEvent.click(await screen.findByRole('button', { name: 'Revogar a chave ERP Protheus' }));
    const confirmacao = await screen.findByRole('dialog', { name: 'Revogar chave de API' });
    expect(servidor.requisicoes.some((r) => r.metodo === 'delete')).toBe(false);
    await userEvent.click(within(confirmacao).getByRole('button', { name: 'Revogar' }));

    await waitFor(() => expect(servidor.requisicoes.some((r) => r.metodo === 'delete' && r.url === '/integracao/chaves/1')).toBe(true));
    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Chave revogada'));
  });

  it('clicar num endpoint abre parametros, exemplo de chamada e de resposta', async () => {
    responderListas();
    renderizarComProvedores(<ApisIntegracao />);

    await userEvent.click(await screen.findByRole('button', { name: 'Ver detalhes de /api/integracao/v1/clientes/{id}' }));

    const detalhe = await screen.findByRole('dialog', { name: 'GET /api/integracao/v1/clientes/{id}' });
    expect(within(detalhe).getByText('Identificador numérico do registro.')).toBeInTheDocument();
    expect(within(detalhe).getByText(/curl -H "X-API-Key: SUA_CHAVE" ".*\/api\/integracao\/v1\/clientes\/1"/)).toBeInTheDocument();
    expect(within(detalhe).getByText('{"sucesso":true,"dados":{"id":7}}')).toBeInTheDocument();
  });

  it('falha ao carregar as chaves mostra a mensagem com nova tentativa', async () => {
    servidor.responder([
      { metodo: 'get', url: '/integracao/chaves', status: 500, corpo: { sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'falha' } } },
      { metodo: 'get', url: '/integracao/endpoints', status: 200, corpo: { sucesso: true, dados: ENDPOINTS } },
    ]);
    renderizarComProvedores(<ApisIntegracao />);

    expect(await screen.findByText('Não foi possível carregar as chaves de API.')).toBeInTheDocument();
  });
});
