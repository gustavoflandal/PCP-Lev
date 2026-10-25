import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { BuscaRastreabilidade, FichaRastreabilidade } from './Rastreabilidade';

const ficha = {
  serie: {
    id: 101,
    numero: 'RAD-200-2026-00001',
    status: 'Expedido',
    resultado_teste: 'Leitura de velocidade conforme',
    testado_por: 'Ana Qualidade',
    testado_em: '2026-10-24T15:00:00Z',
    expedido_em: '2026-10-25T10:00:00Z',
    metrologia: {
      numero_aprovacao_modelo: 'INMETRO-123',
      data_verificacao: '2026-10-24',
      numero_lacre: 'L-0',
      validade: '2027-10-24',
      observacoes: '',
    },
  },
  ordem_producao: {
    id: 40,
    numero_op: 'OP-2026-00001',
    pedido_venda_id: 1,
    numero_pedido: 'PV-001',
    cliente_nome: 'DER Teste',
    item_pedido_venda_id: 11,
    produto_acabado_id: 5,
    produto_codigo: 'RAD-200',
    produto_descricao: 'Radar fixo R-200',
    exige_metrologia: true,
    quantidade: 2,
    estrutura_produto_id: 3,
    estrutura_versao: 1,
    data_conclusao_prevista: '2026-11-01',
    data_conclusao_real: '2026-10-25',
    etapa_atual: 'Expedicao',
    status: 'Concluida',
    observacoes: '',
    created_at: '2026-10-24T12:00:00Z',
  },
  data_pedido: '2026-10-20',
  componentes: [
    { codigo: 'PLACA-01', descricao: 'Placa principal', quantidade_por_unidade: 2 },
    { codigo: 'GAB-01', descricao: 'Gabinete', quantidade_por_unidade: 1 },
  ],
  apontamentos: [
    {
      id: 1, etapa: 'Montagem', centro_codigo: 'MON-01', centro_nome: 'Bancada de montagem', operador_nome: 'João Operador',
      inicio: '2026-10-24T13:00:00Z', fim: '2026-10-24T14:00:00Z', duracao_minutos: 60, observacoes: '',
    },
  ],
  historico: [{ etapa_nova: 'Separacao', data_hora: '2026-10-24T12:30:00Z', usuario: 'gestor' }],
};

function renderizar(rota: string) {
  return renderizarComProvedores(
    <Routes>
      <Route path="/rastreabilidade" element={<BuscaRastreabilidade />} />
      <Route path="/rastreabilidade/:numero" element={<FichaRastreabilidade />} />
    </Routes>,
    { rota },
  );
}

describe('Rastreabilidade', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    entrarComoPerfil('CONSULTA');
    servidor = instalarServidorFalso();
  });

  it('digitar (ou bipar) o numero e Enter abre a ficha', async () => {
    servidor.responder([{ metodo: 'get', url: '/rastreabilidade/RAD-200-2026-00001', status: 200, corpo: { sucesso: true, dados: ficha } }]);
    renderizar('/rastreabilidade');

    await userEvent.type(screen.getByLabelText(/Número de série/), 'rad-200-2026-00001{Enter}');

    expect(await screen.findByRole('heading', { name: 'RAD-200-2026-00001' })).toBeInTheDocument();
  });

  it('ficha as-built: OP, pedido, cliente, componentes, apontamentos, teste, metrologia e QR Code', async () => {
    servidor.responder([{ metodo: 'get', url: '/rastreabilidade/RAD-200-2026-00001', status: 200, corpo: { sucesso: true, dados: ficha } }]);
    renderizar('/rastreabilidade/RAD-200-2026-00001');

    expect(await screen.findByRole('heading', { name: 'RAD-200-2026-00001' })).toBeInTheDocument();
    expect(screen.getByText('Expedido')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OP-2026-00001' })).toHaveAttribute('href', '/producao/ops/40');
    expect(screen.getByRole('link', { name: 'PV-001' })).toHaveAttribute('href', '/pedidos-venda/1');
    expect(screen.getByText('DER Teste')).toBeInTheDocument();
    expect(screen.getByText('PLACA-01')).toBeInTheDocument();
    expect(screen.getByText('João Operador')).toBeInTheDocument();
    expect(screen.getByText('Leitura de velocidade conforme')).toBeInTheDocument();
    expect(screen.getByText('INMETRO-123')).toBeInTheDocument();
    expect(screen.getByText('L-0')).toBeInTheDocument();

    const qr = screen.getByRole('img', { name: 'QR Code da ficha da unidade RAD-200-2026-00001' });
    expect(qr.querySelector('path')?.getAttribute('d')).toMatch(/^M\d/);
  });

  it('numero inexistente avisa e oferece nova busca', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/rastreabilidade/XYZ',
        status: 404,
        corpo: { sucesso: false, erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'numero de serie nao encontrado' } },
      },
    ]);
    renderizar('/rastreabilidade/XYZ');

    expect(await screen.findByRole('alert')).toHaveTextContent('Número de série XYZ não encontrado');
    expect(screen.getByLabelText(/Número de série/)).toHaveValue('XYZ');
  });

  it('componentes com serie e lotes consumidos levam a nota, ao lote e ao fornecedor (v1.2)', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/rastreabilidade/RAD-200-2026-00001',
        status: 200,
        corpo: {
          sucesso: true,
          dados: {
            ...ficha,
            series_componentes: [
              { peca_codigo: 'CONECTOR', peca_descricao: 'Conector serial', numero: 'SN-0001', numero_lote: 'L-A', nota: '101/1', nota_id: 5,
                fornecedor_nome: 'Eletronica Fornecedora', data_entrada: '2026-10-20' },
            ],
            lotes_consumidos: [
              { lote_id: 4, peca_codigo: 'PLACA', numero_lote: 'L-77', validade: '2027-05-01', quantidade: 2, fornecedor_nome: 'Placas SA', notas: 'NF 90/1' },
            ],
          },
        },
      },
    ]);
    renderizar('/rastreabilidade/RAD-200-2026-00001');

    const series = await screen.findByRole('region', { name: 'Componentes com série' });
    expect(within(series).getByText('SN-0001')).toBeInTheDocument();
    expect(within(series).getByRole('link', { name: 'NF 101/1' })).toHaveAttribute('href', '/notas-entrada/5');
    expect(within(series).getByText('Eletronica Fornecedora')).toBeInTheDocument();

    const lotes = screen.getByRole('region', { name: 'Lotes consumidos' });
    expect(within(lotes).getByRole('link', { name: 'L-77' })).toHaveAttribute('href', '/lotes/4');
    expect(within(lotes).getByText('NF 90/1')).toBeInTheDocument();
    expect(within(lotes).getByText('Placas SA')).toBeInTheDocument();
  });

  it('ficha sem rastro de componentes (anterior a v1.2) diz que nao ha', async () => {
    servidor.responder([{ metodo: 'get', url: '/rastreabilidade/RAD-200-2026-00001', status: 200, corpo: { sucesso: true, dados: ficha } }]);
    renderizar('/rastreabilidade/RAD-200-2026-00001');

    expect(await screen.findByText('Nenhum componente com número de série instalado nesta unidade.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum lote de componente consumido pela OP desta unidade.')).toBeInTheDocument();
  });

  it('laudos e inspecoes da OP com o link assinado de /arquivos/:id/url (3.1)', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/rastreabilidade/RAD-200-2026-00001',
        status: 200,
        corpo: {
          sucesso: true,
          dados: {
            ...ficha,
            documentos: [
              {
                anexo_id: 1, categoria: 'Laudo de Teste', titulo: 'Laudo de bancada', arquivo_id: 'uuid-laudo',
                nome_arquivo: 'laudo.pdf', data_emissao: '2026-10-24', created_at: '2026-10-24T16:00:00Z',
              },
              {
                anexo_id: 2, categoria: 'Relatório de Inspeção', titulo: '', arquivo_id: 'uuid-insp',
                nome_arquivo: 'inspecao-final.pdf', created_at: '2026-10-24T17:00:00Z',
              },
            ],
          },
        },
      },
      {
        metodo: 'get',
        url: '/arquivos/uuid-laudo/url',
        status: 200,
        corpo: { sucesso: true, dados: { url: '/api/v1/arquivos/uuid-laudo/conteudo?exp=1&sig=a', expira_em: '2026-10-24T18:05:00Z' } },
      },
      {
        metodo: 'get',
        url: '/arquivos/uuid-insp/url',
        status: 403,
        corpo: { sucesso: false, erro: { codigo: 'ACESSO_NEGADO', mensagem: 'Seu perfil nao tem permissao para estes anexos' } },
      },
    ]);
    renderizar('/rastreabilidade/RAD-200-2026-00001');

    const bloco = await screen.findByRole('region', { name: 'Laudos e inspeções' });
    expect(within(bloco).getByText('Laudo de bancada')).toBeInTheDocument();
    expect(within(bloco).getByText('Laudo de Teste')).toBeInTheDocument();
    expect(within(bloco).getByText(/emissão 24\/10\/2026/)).toBeInTheDocument();
    expect(await within(bloco).findByRole('link', { name: 'Abrir Laudo de bancada' })).toHaveAttribute(
      'href',
      '/api/v1/arquivos/uuid-laudo/conteudo?exp=1&sig=a',
    );
    // Sem titulo, vale o nome do arquivo; falha da URL aparece em texto.
    expect(within(bloco).getAllByText('inspecao-final.pdf').length).toBeGreaterThan(0);
    expect(await within(bloco).findByText('Seu perfil nao tem permissao para estes anexos')).toBeInTheDocument();
  });

  it('ficha sem laudos diz que nao ha', async () => {
    servidor.responder([{ metodo: 'get', url: '/rastreabilidade/RAD-200-2026-00001', status: 200, corpo: { sucesso: true, dados: ficha } }]);
    renderizar('/rastreabilidade/RAD-200-2026-00001');

    expect(await screen.findByText('Nenhum laudo de teste ou relatório de inspeção anexado à OP desta unidade.')).toBeInTheDocument();
  });
});
