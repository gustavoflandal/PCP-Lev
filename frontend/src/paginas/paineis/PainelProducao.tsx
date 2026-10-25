import { CartaoIndicador } from '@/componentes/paineis/CartaoIndicador';
import { GraficoBarras, GraficoBarrasHorizontais } from '@/componentes/paineis/Grafico';
import { GradeGraficos, GradeIndicadores, PaginaPainel } from '@/componentes/paineis/PaginaPainel';
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
      titulo="Painel de produção"
      descricao="Ordens de produção por etapa, atrasos, lead time e horas apontadas."
      setor="producao"
      buscar={obterPainelProducao}
    >
      {({ dados, carregando }) => (
        <>
          <GradeIndicadores>
            <CartaoIndicador rotulo="OPs abertas" valor={dados?.abertas} para={paraOPs} carregando={carregando} />
            <CartaoIndicador rotulo="OPs liberadas" valor={dados?.liberadas} para={paraOPs} carregando={carregando} />
            <CartaoIndicador rotulo="OPs concluídas no período" valor={dados?.concluidas_periodo} carregando={carregando} />
            <CartaoIndicador rotulo="OPs em atraso" valor={dados?.em_atraso} tom="warning" para={paraOPs} carregando={carregando} />
            <CartaoIndicador
              rotulo="Lead time médio"
              valor={dados?.lead_time_medio_dias}
              formato="dias"
              complemento="Da liberação à conclusão"
              semDado="Nenhuma OP concluída no período."
              carregando={carregando}
            />
            <CartaoIndicador rotulo="Horas apontadas" valor={dados?.horas_apontadas} formato="horas" carregando={carregando} />
          </GradeIndicadores>

          <GradeGraficos>
            <GraficoBarras
              titulo="OPs por etapa"
              series={[{ nome: 'OPs', pontos: dados?.por_etapa ?? [] }]}
              formatarRotulo={rotuloEtapa}
              rotuloCategoria="Etapa"
              vazio="Nenhuma OP aberta ou em andamento."
              carregando={carregando}
            />
            <GraficoBarras
              titulo="Concluídas por semana"
              series={[{ nome: 'OPs concluídas', pontos: dados?.concluidas_por_semana ?? [] }]}
              formatarRotulo={formatarSemana}
              rotuloCategoria="Semana de"
              vazio="Nenhuma OP concluída no período."
              carregando={carregando}
            />
            <GraficoBarrasHorizontais
              titulo="Horas por centro de trabalho"
              series={[{ nome: 'Horas apontadas', pontos: dados?.horas_por_centro ?? [] }]}
              formato="horas"
              rotuloCategoria="Centro de trabalho"
              vazio="Nenhuma hora apontada no período."
              carregando={carregando}
            />
            <GraficoBarrasHorizontais
              titulo="Atraso por produto"
              series={[{ nome: 'OPs em atraso', pontos: dados?.atraso_por_produto ?? [] }]}
              rotuloCategoria="Produto"
              vazio="Nenhuma OP em atraso."
              carregando={carregando}
            />
          </GradeGraficos>
        </>
      )}
    </PaginaPainel>
  );
}
