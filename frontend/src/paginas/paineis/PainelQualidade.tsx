import { CartaoIndicador } from '@/componentes/paineis/CartaoIndicador';
import { GraficoBarras, GraficoBarrasHorizontais, GraficoLinha } from '@/componentes/paineis/Grafico';
import { GradeGraficos, GradeIndicadores, PaginaPainel } from '@/componentes/paineis/PaginaPainel';
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
      titulo="Painel de qualidade"
      descricao="Unidades testadas, aprovação e verificação metrológica."
      setor="qualidade"
      buscar={obterPainelQualidade}
    >
      {({ dados, carregando }) => (
        <>
          <GradeIndicadores>
            <CartaoIndicador rotulo="Unidades testadas" valor={dados?.testadas} carregando={carregando} />
            <CartaoIndicador rotulo="Aprovadas" valor={dados?.aprovadas} carregando={carregando} />
            <CartaoIndicador rotulo="Reprovadas" valor={dados?.reprovadas} tom="pending" carregando={carregando} />
            <CartaoIndicador
              rotulo="Taxa de aprovação"
              valor={dados?.taxa_aprovacao_pct}
              formato="percentual"
              semDado="Nenhuma unidade testada no período."
              carregando={carregando}
            />
            <CartaoIndicador
              rotulo="Metrologia vencida"
              valor={dados?.metrologia_vencida}
              tom="pending"
              para={paraMetrologia}
              carregando={carregando}
            />
            <CartaoIndicador
              rotulo="Metrologia vencendo em 30 dias"
              valor={dados?.metrologia_a_vencer_30}
              tom="warning"
              para={paraMetrologia}
              carregando={carregando}
            />
          </GradeIndicadores>

          <GradeGraficos>
            <GraficoLinha
              titulo="Aprovação por semana"
              series={[{ nome: 'Aprovação', pontos: dados?.aprovacao_por_semana ?? [] }]}
              formato="percentual"
              formatarRotulo={formatarSemana}
              rotuloCategoria="Semana de"
              vazio="Nenhuma unidade testada no período."
              carregando={carregando}
            />
            <GraficoBarrasHorizontais
              titulo="Reprovações por produto"
              series={[{ nome: 'Unidades reprovadas', pontos: dados?.reprovacoes_por_produto ?? [] }]}
              rotuloCategoria="Produto"
              vazio="Nenhuma unidade reprovada no período."
              carregando={carregando}
            />
            <GraficoBarras
              titulo="Metrologia por faixa de vencimento"
              series={[{ nome: 'Verificações', pontos: dados?.metrologia_por_faixa ?? [] }]}
              rotuloCategoria="Vencimento"
              vazio="Nenhuma verificação metrológica registrada."
              carregando={carregando}
            />
          </GradeGraficos>
        </>
      )}
    </PaginaPainel>
  );
}
