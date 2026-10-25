import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToasts } from '@/componentes/ui/Toast';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import { DetalheOP } from './DetalheOP';

const serie1 = { id: 101, numero: 'RAD-200-2026-00001', status: 'Em Producao', resultado_teste: '' };
const serie2 = { id: 102, numero: 'RAD-200-2026-00002', status: 'Em Producao', resultado_teste: '' };

function op(extra: Record<string, unknown> = {}) {
  return {
    id: 40,
    numero_op: 'OP-2026-00001',
    pedido_venda_id: 1,
    numero_pedido: 'PV-001',
    cliente_nome: 'DER Teste',
    item_pedido_venda_id: 11,
    produto_acabado_id: 5,
    produto_codigo: 'RAD-200',
    produto_descricao: 'Radar fixo R-200',
    exige_metrologia: false,
    quantidade: 2,
    estrutura_produto_id: 3,
    estrutura_versao: 1,
    data_conclusao_prevista: '2999-12-01',
    etapa_atual: 'Separacao',
    status: 'Aberta',
    observacoes: '',
    created_at: '2026-10-24T12:00:00Z',
    reservas: [],
    apontamentos: [],
    series: [],
    historico: [],
    ...extra,
  };
}

const custo = {
  material_orcado: 500,
  material_realizado: 520,
  mao_de_obra: 120,
  horas_apontadas: 2,
  total_realizado: 640,
  custo_unitario: 320,
  incompleto: true,
  avisos: ['Peça GAB-01 sem custo médio (nunca comprada)'],
};

function centros() {
  return {
    sucesso: true,
    dados: [{ id: 9, codigo: 'SEP-01', nome: 'Bancada de separação', etapa: 'SEPARACAO', ativo: true }],
    paginacao: { pagina: 1, limite: 200, total: 1, total_paginas: 1 },
  };
}

function renderizar() {
  return renderizarComProvedores(
    <Routes>
      <Route path="/producao/ops/:id" element={<DetalheOP />} />
    </Routes>,
    { rota: '/producao/ops/40' },
  );
}

describe('DetalheOP', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    entrarComoPerfil('GESTOR');
    useToasts.setState({ itens: [] });
    servidor = instalarServidorFalso();
    // Toda tela da OP carrega os documentos (3.1): lista vazia salvo quando o teste diz outra coisa.
    const responder = servidor.responder;
    servidor.responder = (rotas) =>
      responder([...rotas, { metodo: 'get', url: '/anexos', status: 200, corpo: { sucesso: true, dados: [] } }]);
  });

  it('liberar sem material mostra a lista do que falta', async () => {
    servidor.responder([
      { metodo: 'get', url: '/ops/40', status: 200, corpo: { sucesso: true, dados: op() } },
      {
        metodo: 'post',
        url: '/ops/40/liberar',
        status: 409,
        corpo: {
          sucesso: false,
          erro: {
            codigo: 'MATERIAL_INSUFICIENTE',
            mensagem: 'nao ha material disponivel para liberar a OP',
            detalhes: [{ campo: 'GAB-01', mensagem: 'GAB-01 componente: necessaria 2, disponivel 1' }],
          },
        },
      },
    ]);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Liberar OP' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não há material disponível para liberar a OP');
    expect(within(alerta).getByText('GAB-01')).toBeInTheDocument();
    expect(alerta).toHaveTextContent('necessaria 2, disponivel 1');
  });

  it('libera a OP e mostra a trilha na Separacao', async () => {
    servidor.responder([
      { metodo: 'get', url: '/ops/40', status: 200, corpo: { sucesso: true, dados: op() } },
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: centros() },
      {
        metodo: 'post',
        url: '/ops/40/liberar',
        status: 200,
        corpo: { sucesso: true, dados: op({ status: 'Liberada', series: [serie1, serie2] }) },
      },
    ]);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Liberar OP' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('OP liberada'));
    const trilha = screen.getByRole('list', { name: 'Etapas da ordem de produção' });
    expect(within(trilha).getByRole('button', { current: 'step' })).toHaveTextContent('Separação');
    expect(screen.getByRole('link', { name: 'RAD-200-2026-00001' })).toHaveAttribute('href', '/rastreabilidade/RAD-200-2026-00001');
  });

  it('inicia o apontamento com centro da etapa atual, encerra e avanca', async () => {
    servidor.responder([
      { metodo: 'get', url: '/ops/40', status: 200, corpo: { sucesso: true, dados: op({ status: 'Liberada' }) } },
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: centros() },
      {
        metodo: 'post',
        url: '/ops/40/apontamentos',
        status: 200,
        corpo: {
          sucesso: true,
          dados: op({
            status: 'Liberada',
            apontamento_aberto: {
              id: 1, etapa: 'Separacao', centro_codigo: 'SEP-01', centro_nome: 'Bancada', operador_nome: 'Usuário de Teste',
              inicio: '2026-10-24T13:00:00Z', observacoes: '',
            },
          }),
        },
      },
    ]);
    renderizar();

    const selecao = await screen.findByLabelText(/Centro de trabalho \(Separação\)/);
    await screen.findByRole('option', { name: 'SEP-01 — Bancada de separação' });
    const pedidoCentros = servidor.requisicoes.find((r) => r.url === '/centros-trabalho');
    expect(pedidoCentros?.params).toMatchObject({ etapa: 'SEPARACAO', filtro_ativo: true });

    expect(screen.getByRole('button', { name: 'Iniciar apontamento' })).toBeDisabled();
    await userEvent.selectOptions(selecao, '9');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar apontamento' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Apontamento iniciado'));
    expect(servidor.requisicoes.find((r) => r.url === '/ops/40/apontamentos')?.corpo).toEqual({
      centro_trabalho_id: 9,
      observacoes: '',
    });
    expect(screen.getByText(/Em apontamento por Usuário de Teste no centro SEP-01/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Encerrar apontamento' })).toBeInTheDocument();

    // Avancar recusado: a mensagem 409 da API aparece em alerta.
    servidor.responder([
      {
        metodo: 'post',
        url: '/ops/40/avancar',
        status: 409,
        corpo: { sucesso: false, erro: { codigo: 'CONFLITO', mensagem: 'encerre ao menos um apontamento nesta etapa antes de avancar' } },
      },
      { metodo: 'get', url: '/ops/40', status: 200, corpo: { sucesso: true, dados: op({ status: 'Liberada' }) } },
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: centros() },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Avançar etapa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('encerre ao menos um apontamento nesta etapa');
  });

  it('operador so encerra o proprio apontamento', async () => {
    entrarComoPerfil('OPERADOR');
    const aberto = (operadorId: number) => ({
      id: 1, etapa: 'Separacao', centro_codigo: 'SEP-01', centro_nome: 'Bancada', operador_id: operadorId,
      operador_nome: 'Outra Pessoa', inicio: '2026-10-24T13:00:00Z', observacoes: '',
    });
    servidor.responder([
      { metodo: 'get', url: '/ops/40', status: 200, corpo: { sucesso: true, dados: op({ status: 'Liberada', apontamento_aberto: aberto(77) }) } },
    ]);
    const { unmount } = renderizar();
    await screen.findByText(/Em apontamento por Outra Pessoa/);
    expect(screen.queryByRole('button', { name: 'Encerrar apontamento' })).not.toBeInTheDocument();
    unmount();

    servidor.responder([
      { metodo: 'get', url: '/ops/40', status: 200, corpo: { sucesso: true, dados: op({ status: 'Liberada', apontamento_aberto: aberto(1) }) } },
      { metodo: 'post', url: '/ops/40/apontamentos/encerrar', status: 200, corpo: { sucesso: true, dados: op({ status: 'Liberada' }) } },
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: centros() },
    ]);
    renderizar();
    await userEvent.click(await screen.findByRole('button', { name: 'Encerrar apontamento' }));
    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Apontamento encerrado'));
  });

  it('na Expedicao o botao e "Concluir OP"', async () => {
    servidor.responder([
      { metodo: 'get', url: '/ops/40', status: 200, corpo: { sucesso: true, dados: op({ status: 'Liberada', etapa_atual: 'Expedicao' }) } },
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: centros() },
      { metodo: 'post', url: '/ops/40/avancar', status: 200, corpo: { sucesso: true, dados: op({ status: 'Concluida', etapa_atual: 'Expedicao' }) } },
    ]);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Concluir OP' }));
    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('OP concluída'));
  });

  it('em Testes registra aprovacao e exige resultado na reprovacao', async () => {
    entrarComoPerfil('QUALIDADE');
    servidor.responder([
      {
        metodo: 'get',
        url: '/ops/40',
        status: 200,
        corpo: { sucesso: true, dados: op({ status: 'Liberada', etapa_atual: 'Testes', series: [serie1, serie2] }) },
      },
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: centros() },
      { metodo: 'put', url: /\/series\/\d+\/teste/, status: 204 },
    ]);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar RAD-200-2026-00001' }));
    let dialogo = await screen.findByRole('dialog', { name: 'Aprovar unidade RAD-200-2026-00001' });
    await userEvent.type(within(dialogo).getByLabelText(/Resultado do teste/), 'Leitura conforme');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar aprovação' }));
    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Unidade aprovada'));
    expect(servidor.requisicoes.find((r) => r.url === '/series/101/teste')?.corpo).toEqual({
      aprovado: true,
      resultado: 'Leitura conforme',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Reprovar RAD-200-2026-00002' }));
    dialogo = await screen.findByRole('dialog', { name: 'Reprovar unidade RAD-200-2026-00002' });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar reprovação' }));
    expect(await within(dialogo).findByText(/obrigatório na reprovação/)).toBeInTheDocument();
    expect(servidor.requisicoes.some((r) => r.url === '/series/102/teste')).toBe(false);

    // QUALIDADE nao libera, nao avanca e nao cancela.
    expect(screen.queryByRole('button', { name: 'Avançar etapa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar OP' })).not.toBeInTheDocument();
  });

  it('produto com metrologia: registra a metrologia da unidade', async () => {
    entrarComoPerfil('QUALIDADE');
    servidor.responder([
      {
        metodo: 'get',
        url: '/ops/40',
        status: 200,
        corpo: { sucesso: true, dados: op({ status: 'Liberada', etapa_atual: 'Testes', exige_metrologia: true, series: [serie1] }) },
      },
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: centros() },
      { metodo: 'put', url: '/series/101/metrologia', status: 204 },
    ]);
    renderizar();

    expect(await screen.findByText('Pendente')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Metrologia de RAD-200-2026-00001' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.type(within(dialogo).getByLabelText(/aprovação de modelo/), 'INMETRO-123');
    await userEvent.type(within(dialogo).getByLabelText(/Nº do lacre/), 'L-1');
    await userEvent.type(within(dialogo).getByLabelText(/Data da verificação/), '2026-10-24');
    await userEvent.type(within(dialogo).getByLabelText(/^Validade/), '2027-10-24');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar metrologia' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('Metrologia registrada'));
    expect(servidor.requisicoes.find((r) => r.metodo === 'put')?.corpo).toEqual({
      numero_aprovacao_modelo: 'INMETRO-123',
      numero_lacre: 'L-1',
      data_verificacao: '2026-10-24',
      validade: '2027-10-24',
      observacoes: '',
    });
  });

  it('custo aparece quando a API o envia (GESTOR, com producao.custos)', async () => {
    servidor.responder([
      { metodo: 'get', url: '/ops/40', status: 200, corpo: { sucesso: true, dados: op({ status: 'Concluida', etapa_atual: 'Expedicao', custo }) } },
    ]);
    renderizar();

    const secao = await screen.findByRole('region', { name: 'Custo' });
    expect(within(secao).getByText('Material orçado')).toBeInTheDocument();
    expect(within(secao).getByText(/500,00/)).toBeInTheDocument();
    expect(within(secao).getByText(/640,00/)).toBeInTheDocument();
    expect(within(secao).getByText(/320,00/)).toBeInTheDocument();
    expect(within(secao).getByText(/Custo incompleto/)).toBeInTheDocument();
    expect(within(secao).getByText(/GAB-01 sem custo médio/)).toBeInTheDocument();
  });

  it('sem producao.custos a API omite o custo e a secao nao aparece', async () => {
    entrarComoPerfil('OPERADOR');
    servidor.responder([
      { metodo: 'get', url: '/ops/40', status: 200, corpo: { sucesso: true, dados: op({ status: 'Concluida', etapa_atual: 'Expedicao' }) } },
    ]);
    renderizar();

    await screen.findByText('OP-2026-00001');
    expect(screen.queryByRole('region', { name: 'Custo' })).not.toBeInTheDocument();
    expect(screen.queryByText('Material orçado')).not.toBeInTheDocument();
  });

  it('cancela a OP com confirmacao', async () => {
    servidor.responder([
      { metodo: 'get', url: '/ops/40', status: 200, corpo: { sucesso: true, dados: op() } },
      { metodo: 'post', url: '/ops/40/cancelar', status: 200, corpo: { sucesso: true, dados: op({ status: 'Cancelada' }) } },
    ]);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar OP' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar OP' }));

    await waitFor(() => expect(useToasts.getState().itens[0]?.mensagem).toBe('OP cancelada'));
    expect(await screen.findByText('OP cancelada', { selector: 'span' })).toBeInTheDocument();
  });

  it('mostra a foto do produto no cabecalho e a de cada peca na lista de material', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/ops/40',
        status: 200,
        corpo: {
          sucesso: true,
          dados: op({
            produto_foto_url: '/api/v1/arquivos/prod/conteudo?mini=1',
            reservas: [
              {
                parte_peca_id: 7, codigo: 'CON-001', descricao: 'Conector', quantidade_reservada: 4,
                quantidade_consumida: 0, status: 'Reservada', foto_url: '/api/v1/arquivos/peca/conteudo?mini=1',
              },
            ],
          }),
        },
      },
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: centros() },
    ]);

    renderizar();

    expect(await screen.findByRole('img', { name: 'Foto do produto RAD-200' })).toHaveAttribute(
      'src',
      '/api/v1/arquivos/prod/conteudo?mini=1',
    );
    const material = screen.getByRole('table', { name: 'Material da OP' });
    expect(within(material).getByRole('img', { name: 'Foto da peça CON-001' })).toHaveAttribute(
      'src',
      '/api/v1/arquivos/peca/conteudo?mini=1',
    );
  });

  it('documentos e laudos: OP concluida aceita anexo mas nao remove', async () => {
    servidor.responder([
      { metodo: 'get', url: '/ops/40', status: 200, corpo: { sucesso: true, dados: op({ status: 'Concluida', etapa_atual: 'Expedicao' }) } },
      { metodo: 'get', url: '/centros-trabalho', status: 200, corpo: centros() },
      { metodo: 'get', url: '/anexos', status: 200, corpo: { sucesso: true, dados: [anexoDe('ordem_producao', 40, 'Laudo de Teste', 'Laudo de bancada')] } },
    ]);
    renderizar();

    const secao = await screen.findByRole('region', { name: 'Documentos e laudos' });
    expect(await within(secao).findByText('Laudo de bancada')).toBeInTheDocument();
    expect(within(secao).getByRole('region', { name: /Laudo de Teste/ })).toBeInTheDocument();
    expect(within(secao).getByText(/Registro encerrado/)).toBeInTheDocument();
    expect(within(secao).queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument();
    expect(within(secao).getByRole('button', { name: 'Anexar documento' })).toBeInTheDocument();
    expect(servidor.requisicoes.find((r) => r.url === '/anexos')?.params).toEqual({ entidade: 'ordem_producao', entidade_id: 40 });
  });

  it('documentos e laudos: sem producao.apontar a secao e so consulta', async () => {
    entrarComoPerfil('CONSULTA');
    servidor.responder([
      { metodo: 'get', url: '/ops/40', status: 200, corpo: { sucesso: true, dados: op({ status: 'Liberada' }) } },
      { metodo: 'get', url: '/anexos', status: 200, corpo: { sucesso: true, dados: [anexoDe('ordem_producao', 40, 'Relatório de Inspeção', 'Inspeção final')] } },
    ]);
    renderizar();

    const secao = await screen.findByRole('region', { name: 'Documentos e laudos' });
    expect(await within(secao).findByText('Inspeção final')).toBeInTheDocument();
    expect(within(secao).queryByRole('button', { name: 'Anexar documento' })).not.toBeInTheDocument();
    expect(within(secao).queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument();
  });
});

function anexoDe(entidade: string, entidadeId: number, categoria: string, titulo: string) {
  return {
    id: 5, entidade, entidade_id: entidadeId, tipo: 'ANEXO', categoria, titulo, descricao: '', versao: '',
    documento_chave: 5, vigente: true, principal: false, ordem: 0,
    arquivo: { id: 'uuid-5', sha256: 'a', nome_original: 'doc.pdf', tipo_mime: 'application/pdf', tamanho: 1024, tem_miniatura: false, created_at: '2026-10-24T12:00:00Z' },
    created_at: '2026-10-24T12:00:00Z',
    url: '/api/v1/arquivos/uuid-5/conteudo?exp=1&sig=x',
  };
}
