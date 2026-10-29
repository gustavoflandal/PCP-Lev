import { CartaoIndicador } from '@/componentes/paineis/CartaoIndicador';
import { GraficoBarras, GraficoBarrasHorizontais, GraficoLinha } from '@/componentes/paineis/Grafico';
import { GradeGraficos, GradeIndicadores, PaginaPainel } from '@/componentes/paineis/PaginaPainel';
import { t } from '@/i18n';
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
      titulo={t('Painel de recebimento e estoque')}
      descricao={t('Entradas por nota fiscal, itens críticos e validade dos lotes.')}
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
                  rotulo={t('Valor em estoque')}
                  valor={dados?.valor_em_estoque}
                  formato="moeda"
                  complemento={t('Pelo custo médio ponderado')}
                  carregando={carregando}
                />
              )}
              <CartaoIndicador
                rotulo={t('Itens críticos')}
                valor={dados?.itens_criticos}
                tom="warning"
                para={podeVerEstoque ? '/estoque' : undefined}
                carregando={carregando}
              />
              <CartaoIndicador
                rotulo={t('Notas aguardando efetivação')}
                valor={dados?.notas_pendentes}
                complemento={t('Rascunho ou conferida')}
                para={podeVerNotas ? '/notas-entrada' : undefined}
                carregando={carregando}
              />
              <CartaoIndicador
                rotulo={t('Lotes vencidos')}
                valor={dados?.lotes_vencidos}
                tom="pending"
                para={podeVerEstoque ? '/lotes' : undefined}
                carregando={carregando}
              />
              <CartaoIndicador
                rotulo={t('Lotes vencendo em 30 dias')}
                valor={dados?.lotes_a_vencer_30}
                tom="warning"
                para={podeVerEstoque ? '/lotes' : undefined}
                carregando={carregando}
              />
            </GradeIndicadores>

            <GradeGraficos>
              <GraficoLinha
                area
                titulo={t('Entradas por mês')}
                series={[{ nome: t('Valor efetivado'), pontos: dados?.entradas_por_mes ?? [] }]}
                formato="moeda"
                formatarRotulo={formatarMes}
                rotuloCategoria={t('Mês')}
                vazio={t('Nenhuma nota fiscal efetivada no período.')}
                carregando={carregando}
              />
              <GraficoBarras
                titulo={t('Notas por situação')}
                series={[{ nome: t('Notas'), pontos: dados?.notas_por_situacao ?? [] }]}
                formatarRotulo={rotuloSituacaoNota}
                rotuloCategoria={t('Situação')}
                vazio={t('Nenhuma nota fiscal de entrada lançada no período.')}
                carregando={carregando}
              />
              <GraficoBarras
                titulo={t('Lotes por faixa de vencimento')}
                series={[{ nome: t('Lotes'), pontos: dados?.lotes_por_vencimento ?? [] }]}
                rotuloCategoria={t('Vencimento')}
                vazio={t('Nenhum lote com validade em estoque.')}
                carregando={carregando}
              />
              {mostraCustos && (
                <GraficoBarrasHorizontais
                  titulo={t('Itens com maior valor em estoque')}
                  series={[{ nome: t('Valor em estoque'), pontos: dados?.top_valor_em_estoque ?? [] }]}
                  formato="moeda"
                  rotuloCategoria={t('Item')}
                  vazio={t('Nenhum item com saldo em estoque.')}
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
