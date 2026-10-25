import { CartaoIndicador } from '@/componentes/paineis/CartaoIndicador';
import { GraficoBarras, GraficoBarrasHorizontais, GraficoLinha } from '@/componentes/paineis/Grafico';
import { GradeGraficos, GradeIndicadores, PaginaPainel } from '@/componentes/paineis/PaginaPainel';
import { formatarMes, rotuloSituacaoNota } from '@/lib/paineis';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { obterPainelEstoque } from '@/servicos/paineis';
import type { PainelEstoque as DadosEstoque } from '@/tipos/paineis';

/**
 * Painel de Recebimento e estoque. Os valores de custo (valor em estoque e
 * o top 10 por valor) so aparecem com `producao.custos` -- sem ela o
 * backend nem manda, e o cartao e o grafico nao aparecem.
 */
export function PainelEstoque() {
  const podeVerCustos = usePode(PERMISSOES.producaoCustos);
  const podeVerEstoque = usePode(PERMISSOES.estoqueVisualizar);
  const podeVerNotas = usePode(PERMISSOES.notasVisualizar);

  return (
    <PaginaPainel<DadosEstoque>
      titulo="Painel de recebimento e estoque"
      descricao="Entradas por nota fiscal, itens críticos e validade dos lotes."
      setor="estoque"
      buscar={obterPainelEstoque}
    >
      {({ dados, carregando }) => {
        // Enquanto carrega, a permissao decide; depois, o que o servidor mandou.
        const mostraCustos = dados ? dados.valor_em_estoque !== null : podeVerCustos;
        return (
          <>
            <GradeIndicadores>
              {mostraCustos && (
                <CartaoIndicador
                  rotulo="Valor em estoque"
                  valor={dados?.valor_em_estoque}
                  formato="moeda"
                  complemento="Pelo custo médio ponderado"
                  carregando={carregando}
                />
              )}
              <CartaoIndicador
                rotulo="Itens críticos"
                valor={dados?.itens_criticos}
                tom="warning"
                para={podeVerEstoque ? '/estoque' : undefined}
                carregando={carregando}
              />
              <CartaoIndicador
                rotulo="Notas aguardando efetivação"
                valor={dados?.notas_pendentes}
                complemento="Rascunho ou conferida"
                para={podeVerNotas ? '/notas-entrada' : undefined}
                carregando={carregando}
              />
              <CartaoIndicador
                rotulo="Lotes vencidos"
                valor={dados?.lotes_vencidos}
                tom="pending"
                para={podeVerEstoque ? '/lotes' : undefined}
                carregando={carregando}
              />
              <CartaoIndicador
                rotulo="Lotes vencendo em 30 dias"
                valor={dados?.lotes_a_vencer_30}
                tom="warning"
                para={podeVerEstoque ? '/lotes' : undefined}
                carregando={carregando}
              />
            </GradeIndicadores>

            <GradeGraficos>
              <GraficoLinha
                area
                titulo="Entradas por mês"
                series={[{ nome: 'Valor efetivado', pontos: dados?.entradas_por_mes ?? [] }]}
                formato="moeda"
                formatarRotulo={formatarMes}
                rotuloCategoria="Mês"
                vazio="Nenhuma nota fiscal efetivada no período."
                carregando={carregando}
              />
              <GraficoBarras
                titulo="Notas por situação"
                series={[{ nome: 'Notas', pontos: dados?.notas_por_situacao ?? [] }]}
                formatarRotulo={rotuloSituacaoNota}
                rotuloCategoria="Situação"
                vazio="Nenhuma nota fiscal de entrada lançada no período."
                carregando={carregando}
              />
              <GraficoBarras
                titulo="Lotes por faixa de vencimento"
                series={[{ nome: 'Lotes', pontos: dados?.lotes_por_vencimento ?? [] }]}
                rotuloCategoria="Vencimento"
                vazio="Nenhum lote com validade em estoque."
                carregando={carregando}
              />
              {mostraCustos && (
                <GraficoBarrasHorizontais
                  titulo="Itens com maior valor em estoque"
                  series={[{ nome: 'Valor em estoque', pontos: dados?.top_valor_em_estoque ?? [] }]}
                  formato="moeda"
                  rotuloCategoria="Item"
                  vazio="Nenhum item com saldo em estoque."
                  carregando={carregando}
                />
              )}
            </GradeGraficos>
          </>
        );
      }}
    </PaginaPainel>
  );
}
