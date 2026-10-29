import { CartaoIndicador } from '@/componentes/paineis/CartaoIndicador';
import { GraficoBarras, GraficoBarrasHorizontais } from '@/componentes/paineis/Grafico';
import { GradeGraficos, GradeIndicadores, PaginaPainel } from '@/componentes/paineis/PaginaPainel';
import { t } from '@/i18n';
import { formatarSemana, rotuloEtapa } from '@/lib/paineis';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { obterPainelProducao } from '@/servicos/paineis';
import type { PainelProducao as DadosProducao } from '@/tipos/paineis';

/** Painel de Produção: OPs por etapa, atrasos, lead time e horas apontadas. */
export function PainelProducao() {
  const podeVerOPs = usePode(PERMISSOES.producaoVisualizar);
  const paraOPs = podeVerOPs ? '/producao/ops' : undefined;

  return (
    <PaginaPainel<DadosProducao>
      titulo={t('Painel de produção')}
      descricao={t('Ordens de produção por etapa, atrasos, lead time e horas apontadas.')}
      setor="producao"
      buscar={obterPainelProducao}
    >
      {({ dados, carregando }) => (
        <>
          <GradeIndicadores>
            <CartaoIndicador rotulo={t('OPs abertas')} valor={dados?.abertas} para={paraOPs} carregando={carregando} />
            <CartaoIndicador rotulo={t('OPs liberadas')} valor={dados?.liberadas} para={paraOPs} carregando={carregando} />
            <CartaoIndicador rotulo={t('OPs concluídas no período')} valor={dados?.concluidas_periodo} carregando={carregando} />
            <CartaoIndicador rotulo={t('OPs em atraso')} valor={dados?.em_atraso} tom="warning" para={paraOPs} carregando={carregando} />
            <CartaoIndicador
              rotulo={t('Lead time médio')}
              valor={dados?.lead_time_medio_dias}
              formato="dias"
              complemento={t('Da liberação à conclusão')}
              semDado={t('Nenhuma OP concluída no período.')}
              carregando={carregando}
            />
            <CartaoIndicador rotulo={t('Horas apontadas')} valor={dados?.horas_apontadas} formato="horas" carregando={carregando} />
          </GradeIndicadores>

          <GradeGraficos>
            <GraficoBarras
              titulo={t('OPs por etapa')}
              series={[{ nome: t('OPs'), pontos: dados?.por_etapa ?? [] }]}
              formatarRotulo={rotuloEtapa}
              rotuloCategoria={t('Etapa')}
              vazio={t('Nenhuma OP aberta ou em andamento.')}
              carregando={carregando}
            />
            <GraficoBarras
              titulo={t('Concluídas por semana')}
              series={[{ nome: t('OPs concluídas'), pontos: dados?.concluidas_por_semana ?? [] }]}
              formatarRotulo={formatarSemana}
              rotuloCategoria={t('Semana de')}
              vazio={t('Nenhuma OP concluída no período.')}
              carregando={carregando}
            />
            <GraficoBarrasHorizontais
              titulo={t('Horas por centro de trabalho')}
              series={[{ nome: t('Horas apontadas'), pontos: dados?.horas_por_centro ?? [] }]}
              formato="horas"
              rotuloCategoria={t('Centro de trabalho')}
              vazio={t('Nenhuma hora apontada no período.')}
              carregando={carregando}
            />
            <GraficoBarrasHorizontais
              titulo={t('Atraso por produto')}
              series={[{ nome: t('OPs em atraso'), pontos: dados?.atraso_por_produto ?? [] }]}
              rotuloCategoria={t('Produto')}
              vazio={t('Nenhuma OP em atraso.')}
              carregando={carregando}
            />
          </GradeGraficos>
        </>
      )}
    </PaginaPainel>
  );
}
