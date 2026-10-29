import { CartaoIndicador } from '@/componentes/paineis/CartaoIndicador';
import { GraficoBarras, GraficoBarrasHorizontais, GraficoLinha } from '@/componentes/paineis/Grafico';
import { GradeGraficos, GradeIndicadores, PaginaPainel } from '@/componentes/paineis/PaginaPainel';
import { t } from '@/i18n';
import { formatarSemana } from '@/lib/paineis';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { obterPainelQualidade } from '@/servicos/paineis';
import type { PainelQualidade as DadosQualidade } from '@/tipos/paineis';

/** Painel de Qualidade: testes por unidade, taxa de aprovação e metrologia. */
export function PainelQualidade() {
  const podeVerProducao = usePode(PERMISSOES.producaoVisualizar);
  const paraMetrologia = podeVerProducao ? '/producao/metrologia' : undefined;

  return (
    <PaginaPainel<DadosQualidade>
      titulo={t('Painel de qualidade')}
      descricao={t('Unidades testadas, aprovação e verificação metrológica.')}
      setor="qualidade"
      buscar={obterPainelQualidade}
    >
      {({ dados, carregando }) => (
        <>
          <GradeIndicadores>
            <CartaoIndicador rotulo={t('Unidades testadas')} valor={dados?.testadas} carregando={carregando} />
            <CartaoIndicador rotulo={t('Aprovadas')} valor={dados?.aprovadas} carregando={carregando} />
            <CartaoIndicador rotulo={t('Reprovadas')} valor={dados?.reprovadas} tom="pending" carregando={carregando} />
            <CartaoIndicador
              rotulo={t('Taxa de aprovação')}
              valor={dados?.taxa_aprovacao_pct}
              formato="percentual"
              semDado={t('Nenhuma unidade testada no período.')}
              carregando={carregando}
            />
            <CartaoIndicador
              rotulo={t('Metrologia vencida')}
              valor={dados?.metrologia_vencida}
              tom="pending"
              para={paraMetrologia}
              carregando={carregando}
            />
            <CartaoIndicador
              rotulo={t('Metrologia vencendo em 30 dias')}
              valor={dados?.metrologia_a_vencer_30}
              tom="warning"
              para={paraMetrologia}
              carregando={carregando}
            />
          </GradeIndicadores>

          <GradeGraficos>
            <GraficoLinha
              titulo={t('Aprovação por semana')}
              series={[{ nome: t('Aprovação'), pontos: dados?.aprovacao_por_semana ?? [] }]}
              formato="percentual"
              formatarRotulo={formatarSemana}
              rotuloCategoria={t('Semana de')}
              vazio={t('Nenhuma unidade testada no período.')}
              carregando={carregando}
            />
            <GraficoBarrasHorizontais
              titulo={t('Reprovações por produto')}
              series={[{ nome: t('Unidades reprovadas'), pontos: dados?.reprovacoes_por_produto ?? [] }]}
              rotuloCategoria={t('Produto')}
              vazio={t('Nenhuma unidade reprovada no período.')}
              carregando={carregando}
            />
            <GraficoBarras
              titulo={t('Metrologia por faixa de vencimento')}
              series={[{ nome: t('Verificações'), pontos: dados?.metrologia_por_faixa ?? [] }]}
              rotuloCategoria={t('Vencimento')}
              vazio={t('Nenhuma verificação metrológica registrada.')}
              carregando={carregando}
            />
          </GradeGraficos>
        </>
      )}
    </PaginaPainel>
  );
}
