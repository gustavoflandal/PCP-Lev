import { BadgeSituacao } from '@/componentes/ui/Badge';
import { BarraDeFiltros } from '@/componentes/ui/BarraDeFiltros';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useCadastroCrud } from '@/hooks/useCadastroCrud';
import { useListagem } from '@/hooks/useListagem';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { OPCOES_ETAPA, ROTULO_ETAPA, type CentroTrabalho } from '@/tipos/cadastros';
import { FormularioCentroTrabalho } from './FormularioCentroTrabalho';
import { t, td } from '@/i18n';

const horasBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function formatarCapacidade(horas: number | null | undefined): string {
  return horas === null || horas === undefined ? '—' : t('{valor} h/dia', { valor: horasBR.format(horas) });
}

export function CentrosTrabalho() {
  const podeIncluir = usePode(PERMISSOES.centrosIncluir);
  const podeEditar = usePode(PERMISSOES.centrosEditar);
  const podeInativar = usePode(PERMISSOES.centrosInativar);

  const lista = useListagem<CentroTrabalho>('centros-trabalho', 'codigo');
  const crud = useCadastroCrud<CentroTrabalho>('centros-trabalho', {
    criado: t('Centro de trabalho cadastrado'),
    atualizado: t('Centro de trabalho atualizado'),
    inativado: t('Centro de trabalho inativado'),
  });

  const colunas: Coluna<CentroTrabalho>[] = [
    {
      chave: 'codigo',
      rotulo: t('Código'),
      ordenavel: true,
      renderizar: (c) => <span className="font-mono">{c.codigo}</span>,
    },
    {
      chave: 'nome',
      rotulo: t('Nome'),
      ordenavel: true,
      renderizar: (c) => (
        <span className="flex flex-col">
          <span>{c.nome}</span>
          {c.descricao && <span className="text-label text-texto-secondary">{c.descricao}</span>}
        </span>
      ),
    },
    {
      chave: 'etapa',
      rotulo: t('Etapa'),
      ordenavel: true,
      renderizar: (c) => td(ROTULO_ETAPA[c.etapa] ?? c.etapa),
    },
    {
      chave: 'capacidade_horas_dia',
      rotulo: t('Capacidade'),
      alinhamento: 'direita',
      renderizar: (c) => formatarCapacidade(c.capacidade_horas_dia),
    },
    { chave: 'ativo', rotulo: t('Situação'), renderizar: (c) => <BadgeSituacao ativo={c.ativo} /> },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Centros de trabalho')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Bancadas e postos onde cada etapa da produção acontece.')}
        </p>
      </div>

      <BarraDeFiltros
        busca={lista.busca}
        aoBuscar={lista.definirBusca}
        rotuloBusca={t('Buscar por código ou nome')}
        filtroAtivo={lista.filtroAtivo}
        aoFiltrarSituacao={lista.definirFiltroAtivo}
        filtrosExtras={
          <div className="w-[180px]">
            <Selecao
              rotulo={t('Etapa')}
              placeholder={t('Todas')}
              opcoes={OPCOES_ETAPA.map((o) => ({ ...o, rotulo: td(o.rotulo) }))}
              value={lista.filtros.etapa ?? ''}
              onChange={(evento) => lista.definirFiltro('etapa', evento.target.value)}
            />
          </div>
        }
      >
        {podeIncluir && (
          <Botao icone="plus" onClick={crud.abrirNovo}>
            {t('Novo centro de trabalho')}
          </Botao>
        )}
      </BarraDeFiltros>

      <div>
        <Tabela<CentroTrabalho>
          rotulo={t('Centros de trabalho')}
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(c) => c.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio={t('Nenhum centro de trabalho encontrado. Ajuste os filtros ou cadastre um centro de trabalho.')}
          acoes={
            podeEditar || podeInativar
              ? (c) => (
                  <span className="flex items-center justify-end gap-2">
                    {podeEditar && (
                      <Botao
                        variante="fantasma"
                        icone="pencil"
                        aria-label={t('Editar {codigo}', { codigo: c.codigo })}
                        onClick={() => crud.abrirEdicao(c)}
                      >
                        {t('Editar')}
                      </Botao>
                    )}
                    {podeInativar && c.ativo && (
                      <Botao
                        variante="fantasma"
                        icone="trash-2"
                        aria-label={t('Inativar {codigo}', { codigo: c.codigo })}
                        onClick={() => crud.pedirInativacao(c)}
                      >
                        {t('Inativar')}
                      </Botao>
                    )}
                  </span>
                )
              : undefined
          }
        />
        <Paginacao
          pagina={lista.paginacao.pagina}
          totalPaginas={lista.paginacao.total_paginas}
          total={lista.paginacao.total}
          aoMudar={lista.definirPagina}
        />
      </div>

      <Modal
        aberto={crud.formularioAberto}
        aoFechar={crud.fecharFormulario}
        titulo={crud.emEdicao ? t('Editar centro de trabalho') : t('Novo centro de trabalho')}
        descricao={t('Campos com * são obrigatórios.')}
      >
        <FormularioCentroTrabalho
          key={crud.emEdicao?.id ?? 'novo'}
          inicial={crud.emEdicao ?? undefined}
          ocupado={crud.salvando}
          erroGeral={crud.erroGeral}
          errosPorCampo={crud.errosPorCampo}
          aoEnviar={crud.salvar}
          aoCancelar={crud.fecharFormulario}
        />
      </Modal>

      <Confirmacao
        aberto={crud.aInativar !== null}
        titulo={t('Inativar centro de trabalho')}
        mensagem={
          crud.aInativar
            ? t('Inativar o centro de trabalho {codigo} · {nome}? Ele deixa de aparecer nas listas de seleção. O histórico é preservado.', { codigo: crud.aInativar.codigo, nome: crud.aInativar.nome })
            : ''
        }
        rotuloConfirmar={t('Inativar')}
        rotuloOcupado={t('Inativando…')}
        ocupado={crud.inativando}
        aoConfirmar={crud.confirmarInativacao}
        aoCancelar={crud.cancelarInativacao}
      />
    </div>
  );
}
