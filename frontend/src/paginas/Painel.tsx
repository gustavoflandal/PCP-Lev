import { useQuery } from '@tanstack/react-query';
import { BarraAtualizacao } from '@/componentes/paineis/BarraControles';
import { CartaoIndicador } from '@/componentes/paineis/CartaoIndicador';
import { GraficoBarras } from '@/componentes/paineis/Grafico';
import { GradeIndicadores } from '@/componentes/paineis/PaginaPainel';
import { Botao } from '@/componentes/ui/Botao';
import { Cartao } from '@/componentes/ui/Cartao';
import { icones } from '@/componentes/ui/icones';
import { t } from '@/i18n';
import { rotuloEtapa } from '@/lib/paineis';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { api } from '@/servicos/api';
import { obterPainelInicio } from '@/servicos/paineis';
import { useAutenticacao } from '@/store/autenticacao';
import type { PainelInicio } from '@/tipos/paineis';

interface RespostaSaude {
  dados: { status: string; ambiente: string };
}

/** O Painel inicial se atualiza sozinho a cada minuto. */
const ATUALIZAR_MS = 60_000;

type Bloco = keyof PainelInicio;

/**
 * Painel inicial (RF6.1): os numeros de "agora" de cada modulo que o usuario
 * ve. O servidor so manda os blocos permitidos; enquanto a resposta nao
 * chega, a permissao da sessao decide quais esqueletos desenhar.
 */
export function Painel() {
  const usuario = useAutenticacao((estado) => estado.usuario);
  const pode = {
    producao: usePode(PERMISSOES.producaoVisualizar),
    compras: usePode(PERMISSOES.pedidosVisualizar),
    estoque: usePode(PERMISSOES.estoqueVisualizar),
    notas: usePode(PERMISSOES.notasVisualizar),
    vendas: usePode(PERMISSOES.vendasVisualizar),
  } satisfies Record<Bloco, boolean>;

  const saude = useQuery({
    queryKey: ['saude'],
    queryFn: async () => (await api.get<RespostaSaude>('/saude')).data.dados,
    refetchInterval: ATUALIZAR_MS,
  });

  const inicio = useQuery({
    queryKey: ['paineis', 'inicio'],
    queryFn: obterPainelInicio,
    refetchInterval: ATUALIZAR_MS,
    staleTime: 0,
  });

  const dados = inicio.data;
  const carregando = dados === undefined;
  const mostra = (bloco: Bloco) => (dados ? Boolean(dados[bloco]) : pode[bloco]);
  // Link so para a tela que a sessao pode abrir.
  const link = (bloco: Bloco, rota: string) => (pode[bloco] ? rota : undefined);
  const nenhumBloco = (Object.keys(pode) as Bloco[]).every((b) => !mostra(b));

  const IconeOk = icones['check-circle-2'];
  const IconeFalha = icones['alert-triangle'];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title text-texto-primary">{t('Painel')}</h1>
          <p className="text-body text-texto-secondary">
            {usuario ? t('Sessão aberta como {nome}.', { nome: usuario.nome }) : t('Sessão aberta.')}
          </p>
        </div>
        <BarraAtualizacao
          atualizadoEm={inicio.dataUpdatedAt}
          atualizando={inicio.isFetching}
          aoAtualizar={() => void inicio.refetch()}
        />
      </div>

      {inicio.isError && carregando ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-cartao border border-borda-subtle bg-surface-raised p-4">
          <p className="flex items-center gap-2 text-body text-estado-pending">
            <IconeFalha size={16} aria-hidden="true" />
            {t('Não foi possível carregar os indicadores. Verifique a conexão e tente de novo.')}
          </p>
          <Botao variante="secundaria" icone="refresh-cw" onClick={() => void inicio.refetch()}>
            {t('Tentar de novo')}
          </Botao>
        </div>
      ) : (
        <>
          {inicio.isError && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-campo border border-estado-warning bg-estado-warning-bg px-3 py-2 text-body text-estado-warning"
            >
              <IconeFalha size={16} aria-hidden="true" />
              {t('Não foi possível atualizar agora. Os números mostrados são os da última atualização.')}
            </p>
          )}

          {nenhumBloco ? (
            <p className="text-body text-texto-secondary">
              {t('Nenhum indicador disponível para o seu perfil. Peça ao administrador acesso aos módulos que você acompanha.')}
            </p>
          ) : (
            <GradeIndicadores>
              {mostra('producao') && (
                <>
                  <CartaoIndicador
                    rotulo={t('OPs em atraso')}
                    valor={dados?.producao?.ops_em_atraso}
                    tom="warning"
                    para={link('producao', '/producao/ops')}
                    carregando={carregando}
                  />
                  <CartaoIndicador
                    rotulo={t('Metrologia vencendo em 30 dias')}
                    valor={dados?.producao?.metrologia_a_vencer_30}
                    tom="warning"
                    para={link('producao', '/producao/metrologia')}
                    carregando={carregando}
                  />
                </>
              )}
              {mostra('compras') && (
                <>
                  <CartaoIndicador
                    rotulo={t('PCs a receber')}
                    valor={dados?.compras?.pcs_a_receber}
                    para={link('compras', '/pedidos-compra')}
                    carregando={carregando}
                  />
                  <CartaoIndicador
                    rotulo={t('PCs em atraso')}
                    valor={dados?.compras?.pcs_em_atraso}
                    tom="warning"
                    para={link('compras', '/pedidos-compra')}
                    carregando={carregando}
                  />
                </>
              )}
              {mostra('estoque') && (
                <>
                  <CartaoIndicador
                    rotulo={t('Insumos críticos')}
                    valor={dados?.estoque?.itens_criticos}
                    tom="warning"
                    para={link('estoque', '/estoque')}
                    carregando={carregando}
                  />
                  <CartaoIndicador
                    rotulo={t('Lotes vencendo em 30 dias')}
                    valor={dados?.estoque?.lotes_a_vencer_30}
                    tom="warning"
                    para={link('estoque', '/lotes')}
                    carregando={carregando}
                  />
                </>
              )}
              {mostra('notas') && (
                <CartaoIndicador
                  rotulo={t('Notas aguardando efetivação')}
                  valor={dados?.notas?.pendentes}
                  complemento={t('Rascunho ou conferida')}
                  para={link('notas', '/notas-entrada')}
                  carregando={carregando}
                />
              )}
              {mostra('vendas') && (
                <>
                  <CartaoIndicador
                    rotulo={t('Pedidos de venda em produção')}
                    valor={dados?.vendas?.em_producao}
                    para={link('vendas', '/pedidos-venda')}
                    carregando={carregando}
                  />
                  <CartaoIndicador
                    rotulo={t('Pedidos prontos para envio')}
                    valor={dados?.vendas?.prontos_para_envio}
                    para={link('vendas', '/pedidos-venda')}
                    carregando={carregando}
                  />
                  <CartaoIndicador
                    rotulo={t('Pedidos entregues hoje')}
                    valor={dados?.vendas?.entregues_hoje}
                    para={link('vendas', '/pedidos-venda')}
                    carregando={carregando}
                  />
                </>
              )}
            </GradeIndicadores>
          )}

          {mostra('producao') && (
            <GraficoBarras
              titulo={t('OPs por etapa')}
              series={[{ nome: t('OPs'), pontos: dados?.producao?.ops_por_etapa ?? [] }]}
              formatarRotulo={rotuloEtapa}
              rotuloCategoria={t('Etapa')}
              vazio={t('Nenhuma OP aberta ou em andamento.')}
              carregando={carregando}
            />
          )}
        </>
      )}

      <Cartao titulo={t('Conexão com o servidor')}>
        {saude.isPending && <p className="text-body text-texto-secondary">{t('Verificando…')}</p>}

        {saude.isError && (
          <p className="flex items-center gap-2 text-body text-estado-pending">
            <IconeFalha size={16} aria-hidden="true" />
            {t('Servidor indisponível. As telas de operação não funcionarão até a conexão voltar.')}
          </p>
        )}

        {saude.data && (
          <p className="flex items-center gap-2 text-body text-estado-done">
            <IconeOk size={16} aria-hidden="true" />
            {t('Operacional · ambiente {ambiente}', { ambiente: saude.data.ambiente })}
          </p>
        )}
      </Cartao>
    </div>
  );
}
