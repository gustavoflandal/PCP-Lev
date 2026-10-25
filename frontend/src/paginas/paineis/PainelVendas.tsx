import { CartaoIndicador } from '@/componentes/paineis/CartaoIndicador';
import { GraficoBarras, GraficoBarrasHorizontais, GraficoLinha } from '@/componentes/paineis/Grafico';
import { GradeGraficos, GradeIndicadores, PaginaPainel } from '@/componentes/paineis/PaginaPainel';
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
      titulo="Painel de vendas e expedição"
      descricao="Carteira de pedidos de venda, entregas e pontualidade."
      setor="vendas"
      buscar={obterPainelVendas}
    >
      {({ dados, carregando }) => (
        <>
          <GradeIndicadores>
            <CartaoIndicador
              rotulo="Carteira"
              valor={dados?.carteira}
              formato="moeda"
              complemento="Pedidos ainda não entregues"
              para={paraPedidos}
              carregando={carregando}
            />
            <CartaoIndicador rotulo="Pedidos em atraso" valor={dados?.em_atraso} tom="warning" para={paraPedidos} carregando={carregando} />
            <CartaoIndicador rotulo="Entregue no período" valor={dados?.entregue_periodo} formato="moeda" carregando={carregando} />
            <CartaoIndicador
              rotulo="Entregas no prazo (OTD)"
              valor={dados?.otd_pct}
              formato="percentual"
              semDado="Nenhuma entrega no período."
              carregando={carregando}
            />
          </GradeIndicadores>

          <GradeGraficos>
            <GraficoBarras
              titulo="Pedidos por situação"
              series={[{ nome: 'Pedidos', pontos: dados?.por_situacao ?? [] }]}
              formatarRotulo={rotuloSituacaoPedidoVenda}
              rotuloCategoria="Situação"
              vazio="Nenhum pedido de venda na carteira."
              carregando={carregando}
            />
            <GraficoLinha
              area
              titulo="Entregue por mês"
              series={[{ nome: 'Valor entregue', pontos: dados?.entregue_por_mes ?? [] }]}
              formato="moeda"
              formatarRotulo={formatarMes}
              rotuloCategoria="Mês"
              vazio="Nenhuma entrega no período."
              carregando={carregando}
            />
            <GraficoLinha
              titulo="Entregas no prazo por mês (OTD)"
              series={[{ nome: 'No prazo', pontos: dados?.otd_por_mes ?? [] }]}
              formato="percentual"
              formatarRotulo={formatarMes}
              rotuloCategoria="Mês"
              vazio="Nenhuma entrega no período para medir a pontualidade."
              carregando={carregando}
            />
            <GraficoBarrasHorizontais
              titulo="Principais clientes por valor"
              series={[{ nome: 'Valor', pontos: dados?.principais_clientes ?? [] }]}
              formato="moeda"
              rotuloCategoria="Cliente"
              vazio="Nenhum pedido de venda no período."
              carregando={carregando}
            />
          </GradeGraficos>
        </>
      )}
    </PaginaPainel>
  );
}
