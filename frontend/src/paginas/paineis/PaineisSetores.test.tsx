import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { PERMISSOES } from '@/lib/permissoes';
import { useAutenticacao } from '@/store/autenticacao';
import { useModoTV } from '@/store/modoTV';
import { entrarComoPerfil, instalarServidorFalso, renderizarComProvedores, type ServidorFalso } from '@/testes/utilitarios';
import type { PainelEstoque as DadosEstoque, PainelProducao as DadosProducao, PainelQualidade as DadosQualidade, PainelVendas as DadosVendas } from '@/tipos/paineis';
import { PainelEstoque } from './PainelEstoque';
import { PainelProducao } from './PainelProducao';
import { PainelQualidade } from './PainelQualidade';
import { PainelVendas } from './PainelVendas';

const estoqueComCustos: DadosEstoque = {
  valor_em_estoque: 98765.4,
  itens_criticos: 3,
  notas_pendentes: 2,
  lotes_vencidos: 1,
  lotes_a_vencer_30: 4,
  entradas_por_mes: [{ rotulo: '2026-10', valor: 1500 }],
  notas_por_situacao: [{ rotulo: 'Conferida', valor: 2 }],
  lotes_por_vencimento: [
    { rotulo: 'Vencidos', valor: 1 },
    { rotulo: 'Até 30 dias', valor: 4 },
  ],
  top_valor_em_estoque: [{ rotulo: 'Placa LED', valor: 50000 }],
};

// Sem `producao.custos`: valor null e o top 10 nem vem (omitempty).
const estoqueSemCustos: DadosEstoque = { ...estoqueComCustos, valor_em_estoque: null };
delete estoqueSemCustos.top_valor_em_estoque;

function abrirDados(titulo: string) {
  const grafico = screen.getByRole('region', { name: titulo });
  return userEvent.click(within(grafico).getByRole('button', { name: 'Ver dados' })).then(() => grafico);
}

describe('paineis de setor', () => {
  let servidor: ServidorFalso;

  beforeEach(() => {
    sessionStorage.clear();
    useAutenticacao.getState().sair();
    useModoTV.setState({ ativo: false });
    servidor = instalarServidorFalso();
    entrarComoPerfil('GESTOR');
  });

  describe('recebimento e estoque', () => {
    it('com permissao de custos, mostra o valor em estoque e o top 10', async () => {
      servidor.responder([{ metodo: 'get', url: '/paineis/estoque', status: 200, corpo: { sucesso: true, dados: estoqueComCustos } }]);
      renderizarComProvedores(<PainelEstoque />, { rota: '/paineis/estoque' });

      expect(await screen.findByRole('group', { name: 'Valor em estoque' })).toHaveTextContent(/R\$\s98\.765,40/);
      expect(screen.getByRole('region', { name: 'Itens com maior valor em estoque' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Lotes vencidos' }).querySelector('[data-valor-indicador]')).toHaveClass('text-estado-pending');

      const faixas = await abrirDados('Lotes por faixa de vencimento');
      expect(within(faixas).getByRole('rowheader', { name: 'Até 30 dias' })).toBeInTheDocument();
    });

    it('sem a permissao de custos, o cartao e o grafico de valor nao aparecem', async () => {
      useAutenticacao.getState().entrar({
        access_token: 't', token_type: 'Bearer', expires_in: 60,
        usuario: { id: 1, username: 'u', nome: 'U', perfil: 'ALMOXARIFE', tema: 'automatico', alto_contraste: false, densidade: 'compacta', tamanho_fonte: 'padrao' },
      });
      servidor.responder([{ metodo: 'get', url: '/paineis/estoque', status: 200, corpo: { sucesso: true, dados: estoqueSemCustos } }]);
      renderizarComProvedores(<PainelEstoque />, { rota: '/paineis/estoque' });

      expect(screen.getAllByTestId('esqueleto-indicador')).toHaveLength(4);
      expect(screen.queryByLabelText('Valor em estoque: carregando')).not.toBeInTheDocument();
      await screen.findByRole('group', { name: 'Itens críticos' });
      expect(screen.queryByRole('group', { name: 'Valor em estoque' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Itens com maior valor em estoque' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('group')).toHaveLength(4);
    });

    it('enquanto carrega, a permissao de custos decide o esqueleto do valor', () => {
      useAutenticacao.getState().entrar({
        access_token: 't', token_type: 'Bearer', expires_in: 60,
        usuario: { id: 1, username: 'u', nome: 'U', perfil: 'GESTOR', tema: 'automatico', alto_contraste: false, densidade: 'compacta', tamanho_fonte: 'padrao' },
        permissoes: [PERMISSOES.paineisEstoque],
      });
      servidor.responder([]);
      renderizarComProvedores(<PainelEstoque />, { rota: '/paineis/estoque' });

      expect(screen.queryByLabelText('Valor em estoque: carregando')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('esqueleto-indicador')).toHaveLength(4);
    });
  });

  it('producao: etapas com acento e semanas como "20/10"', async () => {
    const dados: DadosProducao = {
      abertas: 2, liberadas: 5, concluidas_periodo: 9, em_atraso: 1, lead_time_medio_dias: null, horas_apontadas: 42.5,
      por_etapa: [{ rotulo: 'Separacao', valor: 2 }, { rotulo: 'Montagem', valor: 3 }],
      concluidas_por_semana: [{ rotulo: '2026-10-13', valor: 4 }, { rotulo: '2026-10-20', valor: 5 }],
      horas_por_centro: [{ rotulo: 'MONT-01', valor: 30 }],
      atraso_por_produto: [],
    };
    servidor.responder([{ metodo: 'get', url: '/paineis/producao', status: 200, corpo: { sucesso: true, dados } }]);
    renderizarComProvedores(<PainelProducao />, { rota: '/paineis/producao' });

    expect(await screen.findByRole('group', { name: 'Horas apontadas' })).toHaveTextContent('42,5 h');
    expect(screen.getByRole('group', { name: 'Lead time médio' })).toHaveTextContent('Nenhuma OP concluída no período.');
    expect(within(screen.getByRole('group', { name: 'OPs em atraso' })).getByRole('link')).toHaveAttribute('href', '/producao/ops');

    const etapas = await abrirDados('OPs por etapa');
    expect(within(etapas).getByRole('rowheader', { name: 'Separação' })).toBeInTheDocument();

    const semanas = await abrirDados('Concluídas por semana');
    expect(within(semanas).getByRole('rowheader', { name: '20/10' })).toBeInTheDocument();
    expect(within(semanas).getByRole('columnheader', { name: 'Semana de' })).toBeInTheDocument();

    expect(within(screen.getByRole('region', { name: 'Atraso por produto' })).getByText('Nenhuma OP em atraso.')).toBeInTheDocument();
  });

  it('vendas: situacoes, meses e OTD', async () => {
    const dados: DadosVendas = {
      carteira: 150000, em_atraso: 0, entregue_periodo: 80000, otd_pct: 87.5,
      por_situacao: [{ rotulo: 'Em Producao', valor: 3 }, { rotulo: 'Pronto para Envio', valor: 1 }],
      entregue_por_mes: [{ rotulo: '2026-10', valor: 80000 }],
      otd_por_mes: [{ rotulo: '2026-10', valor: 87.5 }],
      principais_clientes: [{ rotulo: 'Prefeitura de Exemplo', valor: 150000 }],
    };
    servidor.responder([{ metodo: 'get', url: '/paineis/vendas', status: 200, corpo: { sucesso: true, dados } }]);
    renderizarComProvedores(<PainelVendas />, { rota: '/paineis/vendas' });

    expect(await screen.findByRole('group', { name: 'Entregas no prazo (OTD)' })).toHaveTextContent('87,5%');
    expect(screen.getByRole('group', { name: 'Carteira' })).toHaveTextContent(/R\$\s150\.000,00/);

    const situacoes = await abrirDados('Pedidos por situação');
    expect(within(situacoes).getByRole('rowheader', { name: 'Em produção' })).toBeInTheDocument();
    expect(within(situacoes).getByRole('rowheader', { name: 'Pronto para envio' })).toBeInTheDocument();

    const otd = await abrirDados('Entregas no prazo por mês (OTD)');
    expect(within(otd).getByRole('rowheader', { name: 'out/26' })).toBeInTheDocument();
    expect(within(otd).getByRole('cell', { name: '87,5%' })).toBeInTheDocument();
  });

  it('qualidade: taxa de aprovacao e faixas de metrologia', async () => {
    const dados: DadosQualidade = {
      testadas: 40, aprovadas: 38, reprovadas: 2, taxa_aprovacao_pct: 95, metrologia_vencida: 0, metrologia_a_vencer_30: 3,
      aprovacao_por_semana: [{ rotulo: '2026-10-20', valor: 95 }],
      reprovacoes_por_produto: [{ rotulo: 'Radar R1', valor: 2 }],
      metrologia_por_faixa: [{ rotulo: 'Vencida', valor: 0 }, { rotulo: 'Até 30 dias', valor: 3 }],
    };
    servidor.responder([{ metodo: 'get', url: '/paineis/qualidade', status: 200, corpo: { sucesso: true, dados } }]);
    renderizarComProvedores(<PainelQualidade />, { rota: '/paineis/qualidade' });

    expect(await screen.findByRole('group', { name: 'Taxa de aprovação' })).toHaveTextContent('95%');
    expect(screen.getByRole('group', { name: 'Reprovadas' }).querySelector('[data-valor-indicador]')).toHaveClass('text-estado-pending');
    expect(screen.getByRole('group', { name: 'Metrologia vencida' }).querySelector('[data-valor-indicador]')).toHaveClass('text-texto-primary');

    const faixas = await abrirDados('Metrologia por faixa de vencimento');
    expect(within(faixas).getByRole('rowheader', { name: 'Até 30 dias' })).toBeInTheDocument();
  });
});
