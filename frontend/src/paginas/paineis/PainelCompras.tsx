import { CartaoIndicador } from '@/componentes/paineis/CartaoIndicador';
import { GraficoBarras, GraficoBarrasHorizontais, GraficoLinha } from '@/componentes/paineis/Grafico';
import { GradeGraficos, GradeIndicadores, PaginaPainel } from '@/componentes/paineis/PaginaPainel';
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
      titulo="Painel de compras"
      descricao="Pedidos de compra em aberto, atrasos e pontualidade dos fornecedores."
      setor="compras"
      buscar={obterPainelCompras}
    >
      {({ dados, carregando }) => (
        <>
          <GradeIndicadores>
            <CartaoIndicador
              rotulo="PCs em aberto"
              valor={dados?.em_aberto}
              complemento={dados && `${formatarValor(dados.valor_em_aberto, 'moeda')} a receber`}
              para={paraPedidos}
              carregando={carregando}
            />
            <CartaoIndicador rotulo="PCs em atraso" valor={dados?.em_atraso} tom="warning" para={paraPedidos} carregando={carregando} />
            <CartaoIndicador
              rotulo="Lead time real médio"
              valor={dados?.lead_time_medio_dias}
              formato="dias"
              complemento="Do pedido à última nota"
              semDado="Nenhum pedido recebido no período."
              carregando={carregando}
            />
            <CartaoIndicador
              rotulo="Recebido no prazo"
              valor={dados?.recebido_no_prazo_pct}
              formato="percentual"
              semDado="Nenhum pedido recebido no período."
              carregando={carregando}
            />
          </GradeIndicadores>

          <GradeGraficos>
            <GraficoBarras
              titulo="PCs por situação"
              series={[{ nome: 'Pedidos', pontos: dados?.por_situacao ?? [] }]}
              formatarRotulo={rotuloSituacaoPedidoCompra}
              rotuloCategoria="Situação"
              vazio="Nenhum pedido de compra em aberto."
              carregando={carregando}
            />
            <GraficoLinha
              area
              titulo="Comprado por mês"
              series={[{ nome: 'Valor emitido', pontos: dados?.comprado_por_mes ?? [] }]}
              formato="moeda"
              formatarRotulo={formatarMes}
              rotuloCategoria="Mês"
              vazio="Nenhum pedido de compra emitido no período."
              carregando={carregando}
            />
            <GraficoBarrasHorizontais
              titulo="Atrasos por fornecedor"
              series={[{ nome: 'Pedidos em atraso', pontos: dados?.atrasos_por_fornecedor ?? [] }]}
              rotuloCategoria="Fornecedor"
              vazio="Nenhum fornecedor com pedido em atraso."
              carregando={carregando}
            />
            <GraficoBarrasHorizontais
              titulo="Lead time por fornecedor"
              series={[{ nome: 'Lead time médio', pontos: dados?.lead_time_por_fornecedor ?? [] }]}
              formato="dias"
              rotuloCategoria="Fornecedor"
              vazio="Nenhum pedido recebido no período para medir o lead time."
              carregando={carregando}
            />
          </GradeGraficos>
        </>
      )}
    </PaginaPainel>
  );
}
