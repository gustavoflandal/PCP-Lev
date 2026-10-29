import { CartaoIndicador } from '@/componentes/paineis/CartaoIndicador';
import { GraficoBarras, GraficoBarrasHorizontais, GraficoLinha } from '@/componentes/paineis/Grafico';
import { GradeGraficos, GradeIndicadores, PaginaPainel } from '@/componentes/paineis/PaginaPainel';
import { t } from '@/i18n';
import { formatarMes, rotuloSituacaoPedidoVenda } from '@/lib/paineis';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { obterPainelVendas } from '@/servicos/paineis';
import type { PainelVendas as DadosVendas } from '@/tipos/paineis';

/** Painel de Vendas e expedição: carteira, atrasos, entregas e pontualidade (OTD). */
export function PainelVendas() {
  const podeVerPedidos = usePode(PERMISSOES.vendasVisualizar);
  const paraPedidos = podeVerPedidos ? '/pedidos-venda' : undefined;

  return (
    <PaginaPainel<DadosVendas>
      titulo={t('Painel de vendas e expedição')}
      descricao={t('Carteira de pedidos de venda, entregas e pontualidade.')}
      setor="vendas"
      buscar={obterPainelVendas}
    >
      {({ dados, carregando }) => (
        <>
          <GradeIndicadores>
            <CartaoIndicador
              rotulo={t('Carteira')}
              valor={dados?.carteira}
              formato="moeda"
              complemento={t('Pedidos ainda não entregues')}
              para={paraPedidos}
              carregando={carregando}
            />
            <CartaoIndicador rotulo={t('Pedidos em atraso')} valor={dados?.em_atraso} tom="warning" para={paraPedidos} carregando={carregando} />
            <CartaoIndicador rotulo={t('Entregue no período')} valor={dados?.entregue_periodo} formato="moeda" carregando={carregando} />
            <CartaoIndicador
              rotulo={t('Entregas no prazo (OTD)')}
              valor={dados?.otd_pct}
              formato="percentual"
              semDado={t('Nenhuma entrega no período.')}
              carregando={carregando}
            />
          </GradeIndicadores>

          <GradeGraficos>
            <GraficoBarras
              titulo={t('Pedidos por situação')}
              series={[{ nome: t('Pedidos'), pontos: dados?.por_situacao ?? [] }]}
              formatarRotulo={rotuloSituacaoPedidoVenda}
              rotuloCategoria={t('Situação')}
              vazio={t('Nenhum pedido de venda na carteira.')}
              carregando={carregando}
            />
            <GraficoLinha
              area
              titulo={t('Entregue por mês')}
              series={[{ nome: t('Valor entregue'), pontos: dados?.entregue_por_mes ?? [] }]}
              formato="moeda"
              formatarRotulo={formatarMes}
              rotuloCategoria={t('Mês')}
              vazio={t('Nenhuma entrega no período.')}
              carregando={carregando}
            />
            <GraficoLinha
              titulo={t('Entregas no prazo por mês (OTD)')}
              series={[{ nome: t('No prazo'), pontos: dados?.otd_por_mes ?? [] }]}
              formato="percentual"
              formatarRotulo={formatarMes}
              rotuloCategoria={t('Mês')}
              vazio={t('Nenhuma entrega no período para medir a pontualidade.')}
              carregando={carregando}
            />
            <GraficoBarrasHorizontais
              titulo={t('Principais clientes por valor')}
              series={[{ nome: t('Valor'), pontos: dados?.principais_clientes ?? [] }]}
              formato="moeda"
              rotuloCategoria={t('Cliente')}
              vazio={t('Nenhum pedido de venda no período.')}
              carregando={carregando}
            />
          </GradeGraficos>
        </>
      )}
    </PaginaPainel>
  );
}
