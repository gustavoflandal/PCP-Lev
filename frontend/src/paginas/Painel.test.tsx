import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { PERMISSOES } from '@/lib/permissoes';
import { useAutenticacao } from '@/store/autenticacao';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type RotaFalsa, type ServidorFalso } from '@/testes/utilitarios';
import type { PainelInicio } from '@/tipos/paineis';
import { Painel } from './Painel';

const saudeOk: RotaFalsa = { metodo: 'get', url: '/saude', status: 200, corpo: { sucesso: true, dados: { status: 'ok', ambiente: 'test' } } };

const inicioCompleto: PainelInicio = {
  producao: {
    ops_em_atraso: 3,
    metrologia_a_vencer_30: 0,
    ops_por_etapa: [
      { rotulo: 'Aberta', valor: 2 },
      { rotulo: 'Separacao', valor: 1 },
      { rotulo: 'Montagem', valor: 4 },
      { rotulo: 'Testes', valor: 0 },
      { rotulo: 'Expedicao', valor: 1 },
    ],
  },
  compras: { pcs_a_receber: 5, pcs_em_atraso: 2 },
  estoque: { itens_criticos: 0, lotes_a_vencer_30: 1 },
  notas: { pendentes: 4 },
  vendas: { em_producao: 6, prontos_para_envio: 2, entregues_hoje: 1 },
};

function rotaInicio(dados: PainelInicio): RotaFalsa {
  return { metodo: 'get', url: '/paineis/inicio', status: 200, corpo: { sucesso: true, dados } };
}

function valorDoCartao(rotulo: string): string {
  const cartao = screen.getByRole('group', { name: rotulo });
  return cartao.querySelector('[data-valor-indicador]')?.textContent ?? '';
}

describe('Painel', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    servidor = instalarServidorFalso();
    entrarComoPerfil('GESTOR');
    servidor.responder([saudeOk, rotaInicio(inicioCompleto)]);
  });

  it('anuncia a tela', () => {
    renderizarComProvedores(<Painel />);

    expect(screen.getByRole('heading', { name: 'Painel', level: 1 })).toBeInTheDocument();
  });

  it('mostra os indicadores de cada modulo com os numeros do servidor', async () => {
    renderizarComProvedores(<Painel />);

    await screen.findByRole('group', { name: 'OPs em atraso' });
    expect(servidor.requisicoes.some((r) => r.url === '/paineis/inicio')).toBe(true);

    expect(valorDoCartao('OPs em atraso')).toBe('3');
    expect(valorDoCartao('Metrologia vencendo em 30 dias')).toBe('0');
    expect(valorDoCartao('PCs a receber')).toBe('5');
    expect(valorDoCartao('PCs em atraso')).toBe('2');
    expect(valorDoCartao('Insumos críticos')).toBe('0');
    expect(valorDoCartao('Lotes vencendo em 30 dias')).toBe('1');
    expect(valorDoCartao('Notas aguardando efetivação')).toBe('4');
    expect(valorDoCartao('Pedidos de venda em produção')).toBe('6');
    expect(valorDoCartao('Pedidos prontos para envio')).toBe('2');
    expect(valorDoCartao('Pedidos entregues hoje')).toBe('1');
  });

  it('cada cartao leva a tela correspondente', async () => {
    renderizarComProvedores(<Painel />);

    const cartao = await screen.findByRole('group', { name: 'OPs em atraso' });
    expect(within(cartao).getByRole('link')).toHaveAttribute('href', '/producao/ops');
    expect(within(screen.getByRole('group', { name: 'PCs em atraso' })).getByRole('link')).toHaveAttribute('href', '/pedidos-compra');
    expect(within(screen.getByRole('group', { name: 'Insumos críticos' })).getByRole('link')).toHaveAttribute('href', '/estoque');
    expect(within(screen.getByRole('group', { name: 'Lotes vencendo em 30 dias' })).getByRole('link')).toHaveAttribute('href', '/lotes');
    expect(within(screen.getByRole('group', { name: 'Notas aguardando efetivação' })).getByRole('link')).toHaveAttribute('href', '/notas-entrada');
    expect(within(screen.getByRole('group', { name: 'Pedidos entregues hoje' })).getByRole('link')).toHaveAttribute('href', '/pedidos-venda');
    expect(within(screen.getByRole('group', { name: 'Metrologia vencendo em 30 dias' })).getByRole('link')).toHaveAttribute('href', '/producao/metrologia');
  });

  it('atraso com numero maior que zero aparece como alerta; zero fica neutro', async () => {
    renderizarComProvedores(<Painel />);

    const atraso = await screen.findByRole('group', { name: 'OPs em atraso' });
    expect(atraso.querySelector('[data-valor-indicador]')).toHaveClass('text-estado-warning');
    expect(atraso.querySelector('[data-valor-indicador] svg')).not.toBeNull();

    const criticos = screen.getByRole('group', { name: 'Insumos críticos' });
    expect(criticos.querySelector('[data-valor-indicador]')).toHaveClass('text-texto-primary');
    expect(criticos.querySelector('[data-valor-indicador] svg')).toBeNull();
  });

  it('so mostra os blocos que o servidor mandou (permissao do modulo)', async () => {
    entrarComoPerfil('OPERADOR');
    servidor.responder([saudeOk, rotaInicio({ producao: inicioCompleto.producao })]);

    renderizarComProvedores(<Painel />);

    await screen.findByRole('group', { name: 'OPs em atraso' });
    expect(screen.queryByRole('group', { name: 'PCs a receber' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Insumos críticos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Notas aguardando efetivação' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Pedidos de venda em produção' })).not.toBeInTheDocument();
  });

  it('enquanto carrega, desenha esqueletos so dos blocos que a sessao pode ver', () => {
    useAutenticacao.getState().entrar({
      access_token: 't', token_type: 'Bearer', expires_in: 60,
      usuario: { id: 1, username: 'u', nome: 'U', perfil: 'GESTOR', tema: 'automatico', alto_contraste: false, densidade: 'compacta', tamanho_fonte: 'padrao' },
      permissoes: [PERMISSOES.pedidosVisualizar],
    });

    renderizarComProvedores(<Painel />);

    expect(screen.getAllByTestId('esqueleto-indicador')).toHaveLength(2);
    expect(screen.getByLabelText('PCs a receber: carregando')).toBeInTheDocument();
    expect(screen.queryByLabelText('OPs em atraso: carregando')).not.toBeInTheDocument();
  });

  it('sem nenhum modulo visivel, diz o que fazer em vez de uma grade vazia', async () => {
    useAutenticacao.getState().entrar({
      access_token: 't', token_type: 'Bearer', expires_in: 60,
      usuario: { id: 1, username: 'u', nome: 'U', perfil: 'GESTOR', tema: 'automatico', alto_contraste: false, densidade: 'compacta', tamanho_fonte: 'padrao' },
      permissoes: [],
    });
    servidor.responder([saudeOk, rotaInicio({})]);

    renderizarComProvedores(<Painel />);

    expect(await screen.findByText(/Nenhum indicador disponível para o seu perfil/)).toBeInTheDocument();
  });

  it('mostra o grafico de OPs por etapa com a tabela equivalente e os nomes das etapas', async () => {
    renderizarComProvedores(<Painel />);

    const grafico = await screen.findByRole('region', { name: 'OPs por etapa' });
    await userEvent.click(await within(grafico).findByRole('button', { name: 'Ver dados' }));

    const tabela = within(grafico).getByRole('table', { name: 'OPs por etapa' });
    expect(within(tabela).getByRole('rowheader', { name: 'Separação' })).toBeInTheDocument();
    expect(within(tabela).getByRole('rowheader', { name: 'Expedição' })).toBeInTheDocument();
    expect(within(tabela).getByRole('rowheader', { name: 'Aberta' })).toBeInTheDocument();
  });

  it('mostra quando foi a ultima atualizacao e permite atualizar agora', async () => {
    renderizarComProvedores(<Painel />);

    expect(await screen.findByText(/^Atualizado às \d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
    const antes = servidor.requisicoes.filter((r) => r.url === '/paineis/inicio').length;

    await userEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }));

    await screen.findByRole('button', { name: 'Atualizar agora' });
    expect(servidor.requisicoes.filter((r) => r.url === '/paineis/inicio').length).toBe(antes + 1);
  });

  it('falha ao carregar os indicadores: mensagem e Tentar de novo', async () => {
    servidor.responder([saudeOk, { metodo: 'get', url: '/paineis/inicio', status: 500, corpo: { sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'falha' } } }]);

    renderizarComProvedores(<Painel />);

    expect(await screen.findByText(/Não foi possível carregar os indicadores/)).toBeInTheDocument();

    servidor.responder([saudeOk, rotaInicio(inicioCompleto)]);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('group', { name: 'OPs em atraso' })).toBeInTheDocument();
  });

  it('nao tem mais o widget pendente do modulo de producao', async () => {
    renderizarComProvedores(<Painel />);

    await screen.findByRole('group', { name: 'OPs em atraso' });
    expect(screen.queryByText(/Sprint 6/)).not.toBeInTheDocument();
  });

  it('mostra o estado real da conexao', async () => {
    renderizarComProvedores(<Painel />);

    expect(screen.getByRole('heading', { name: 'Conexão com o servidor' })).toBeInTheDocument();
    expect(await screen.findByText(/Operacional · ambiente test/)).toBeInTheDocument();
  });

  it('servidor fora do ar aparece como falha', async () => {
    servidor.responder([
      {
        metodo: 'get',
        url: '/saude',
        status: 503,
        corpo: { sucesso: false, erro: { codigo: 'INDISPONIVEL', mensagem: 'Banco de dados indisponivel' } },
      },
      rotaInicio(inicioCompleto),
    ]);

    renderizarComProvedores(<Painel />);

    expect(await screen.findByText(/Servidor indisponível/)).toBeInTheDocument();
  });
});
