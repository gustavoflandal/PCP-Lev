import { CartaoIndicador } from '@/componentes/paineis/CartaoIndicador';
import { GraficoBarras, GraficoBarrasHorizontais, GraficoLinha } from '@/componentes/paineis/Grafico';
import { GradeGraficos, GradeIndicadores, PaginaPainel } from '@/componentes/paineis/PaginaPainel';
import { t } from '@/i18n';
import { formatarMes, formatarValor, rotuloSituacaoPedidoCompra } from '@/lib/paineis';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { obterPainelCompras } from '@/servicos/paineis';
import type { PainelCompras as DadosCompras } from '@/tipos/paineis';

/** Painel de Compras: pedidos em aberto e em atraso, lead time real e pontualidade dos fornecedores. */
export function PainelCompras() {
  const podeVerPedidos = usePode(PERMISSOES.pedidosVisualizar);
  const paraPedidos = podeVerPedidos ? '/pedidos-compra' : undefined;

  return (
    <PaginaPainel<DadosCompras>
      titulo={t('Painel de compras')}
      descricao={t('Pedidos de compra em aberto, atrasos e pontualidade dos fornecedores.')}
      setor="compras"
      buscar={obterPainelCompras}
    >
      {({ dados, carregando }) => (
        <>
          <GradeIndicadores>
            <CartaoIndicador
              rotulo={t('PCs em aberto')}
              valor={dados?.em_aberto}
              complemento={dados && t('{valor} a receber', { valor: formatarValor(dados.valor_em_aberto, 'moeda') })}
              para={paraPedidos}
              carregando={carregando}
            />
            <CartaoIndicador rotulo={t('PCs em atraso')} valor={dados?.em_atraso} tom="warning" para={paraPedidos} carregando={carregando} />
            <CartaoIndicador
              rotulo={t('Lead time real médio')}
              valor={dados?.lead_time_medio_dias}
              formato="dias"
              complemento={t('Do pedido à última nota')}
              semDado={t('Nenhum pedido recebido no período.')}
              carregando={carregando}
            />
            <CartaoIndicador
              rotulo={t('Recebido no prazo')}
              valor={dados?.recebido_no_prazo_pct}
              formato="percentual"
              semDado={t('Nenhum pedido recebido no período.')}
              carregando={carregando}
            />
          </GradeIndicadores>

          <GradeGraficos>
            <GraficoBarras
              titulo={t('PCs por situação')}
              series={[{ nome: t('Pedidos'), pontos: dados?.por_situacao ?? [] }]}
              formatarRotulo={rotuloSituacaoPedidoCompra}
              rotuloCategoria={t('Situação')}
              vazio={t('Nenhum pedido de compra em aberto.')}
              carregando={carregando}
            />
            <GraficoLinha
              area
              titulo={t('Comprado por mês')}
              series={[{ nome: t('Valor emitido'), pontos: dados?.comprado_por_mes ?? [] }]}
              formato="moeda"
              formatarRotulo={formatarMes}
              rotuloCategoria={t('Mês')}
              vazio={t('Nenhum pedido de compra emitido no período.')}
              carregando={carregando}
            />
            <GraficoBarrasHorizontais
              titulo={t('Atrasos por fornecedor')}
              series={[{ nome: t('Pedidos em atraso'), pontos: dados?.atrasos_por_fornecedor ?? [] }]}
              rotuloCategoria={t('Fornecedor')}
              vazio={t('Nenhum fornecedor com pedido em atraso.')}
              carregando={carregando}
            />
            <GraficoBarrasHorizontais
              titulo={t('Lead time por fornecedor')}
              series={[{ nome: t('Lead time médio'), pontos: dados?.lead_time_por_fornecedor ?? [] }]}
              formato="dias"
              rotuloCategoria={t('Fornecedor')}
              vazio={t('Nenhum pedido recebido no período para medir o lead time.')}
              carregando={carregando}
            />
          </GradeGraficos>
        </>
      )}
    </PaginaPainel>
  );
}
