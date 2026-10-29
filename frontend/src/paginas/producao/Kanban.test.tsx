import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PREFERENCIAS_PADRAO, usePreferencias } from '@/store/preferencias';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { Kanban } from './Kanban';

function op(id: number, numero: string, etapa: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    numero_op: numero,
    pedido_venda_id: 1,
    numero_pedido: 'PV-001',
    cliente_nome: 'DER Teste',
    item_pedido_venda_id: id,
    produto_acabado_id: 5,
    produto_codigo: 'RAD-200',
    produto_descricao: 'Radar fixo R-200',
    exige_metrologia: false,
    quantidade: 3,
    estrutura_produto_id: 1,
    estrutura_versao: 1,
    data_conclusao_prevista: '2999-01-01',
    etapa_atual: etapa,
    status: 'Liberada',
    observacoes: '',
    created_at: '2026-10-24T12:00:00Z',
    ...extra,
  };
}

describe('Kanban', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    entrarComoPerfil('OPERADOR');
    servidor = instalarServidorFalso();
  });

  it('agrupa as OPs nas quatro colunas fixas, com atraso e apontamento em andamento', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/kanban',
        status: 200,
        corpo: {
          sucesso: true,
          dados: [
            op(1, 'OP-2026-00001', 'Separacao', {
              apontamento_aberto: {
                id: 1, etapa: 'Separacao', centro_codigo: 'SEP-01', centro_nome: 'Bancada', operador_nome: 'Maria',
                inicio: '2026-10-24T13:00:00Z', observacoes: '',
              },
            }),
            op(2, 'OP-2026-00002', 'Separacao'),
            op(3, 'OP-2026-00003', 'Testes', { data_conclusao_prevista: '2020-01-01' }),
          ],
        },
      },
    ]);

    renderizarComProvedores(<Kanban />);

    const separacao = await screen.findByRole('region', { name: 'Etapa Separação' });
    expect(await within(separacao).findByRole('link', { name: 'OP OP-2026-00001' })).toHaveAttribute('href', '/producao/ops/1');
    expect(within(separacao).getByRole('link', { name: 'OP OP-2026-00002' })).toBeInTheDocument();
    expect(within(separacao).getByText('2 OPs')).toBeInTheDocument();
    expect(within(separacao).getByText(/Em apontamento: Maria · SEP-01/)).toBeInTheDocument();

    const testes = screen.getByRole('region', { name: 'Etapa Testes' });
    expect(within(testes).getByRole('link', { name: 'OP OP-2026-00003' })).toBeInTheDocument();
    expect(within(testes).getByText('Atrasada')).toBeInTheDocument();

    expect(within(screen.getByRole('region', { name: 'Etapa Montagem' })).getByText('Nenhuma OP nesta etapa.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Etapa Expedição' })).getByText('Nenhuma OP nesta etapa.')).toBeInTheDocument();
  });

  it('erro da API aparece em alerta', async () => {
    servidor.responder([
      { metodo: 'get', url: '/kanban', status: 500, corpo: { sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'falha no servidor' } } },
    ]);
    renderizarComProvedores(<Kanban />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('o cartao mostra a foto do produto', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/kanban',
        status: 200,
        corpo: { sucesso: true, dados: [op(1, 'OP-2026-00001', 'Montagem', { produto_foto_url: '/api/v1/arquivos/x/conteudo?mini=1' })] },
      },
    ]);

    renderizarComProvedores(<Kanban />);

    const cartao = await screen.findByRole('link', { name: 'OP OP-2026-00001' });
    expect(within(cartao).getByRole('img', { name: 'Foto do produto RAD-200' })).toHaveAttribute(
      'src',
      '/api/v1/arquivos/x/conteudo?mini=1',
    );
  });

  describe('em espanhol', () => {
    afterEach(() => usePreferencias.getState().aplicar(PREFERENCIAS_PADRAO));

    it('traduz titulo, etapas e mensagens de vazio', async () => {
      usePreferencias.getState().aplicar({ ...PREFERENCIAS_PADRAO, idioma: 'es' });
      servidor.responder([
        { metodo: 'get', url: '/kanban', status: 200, corpo: { sucesso: true, dados: [op(1, 'OP-2026-00001', 'Separacao')] } },
      ]);
      renderizarComProvedores(<Kanban />);

      expect(screen.getByRole('heading', { name: 'Kanban de producción' })).toBeInTheDocument();
      const separacion = await screen.findByRole('region', { name: 'Etapa Separación' });
      expect(await within(separacion).findByRole('link', { name: 'OP OP-2026-00001' })).toBeInTheDocument();
      expect(within(separacion).getByText('1 OP')).toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: 'Etapa Despacho' })).getByText('Ninguna OP en esta etapa.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    });
  });
});
