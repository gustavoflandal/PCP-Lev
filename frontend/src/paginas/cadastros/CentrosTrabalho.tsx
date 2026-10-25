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

const horasBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function formatarCapacidade(horas: number | null | undefined): string {
  return horas === null || horas === undefined ? '—' : `${horasBR.format(horas)} h/dia`;
}

export function CentrosTrabalho() {
  const podeIncluir = usePode(PERMISSOES.centrosIncluir);
  const podeEditar = usePode(PERMISSOES.centrosEditar);
  const podeInativar = usePode(PERMISSOES.centrosInativar);

  const lista = useListagem<CentroTrabalho>('centros-trabalho', 'codigo');
  const crud = useCadastroCrud<CentroTrabalho>('centros-trabalho', {
    criado: 'Centro de trabalho cadastrado',
    atualizado: 'Centro de trabalho atualizado',
    inativado: 'Centro de trabalho inativado',
  });

  const colunas: Coluna<CentroTrabalho>[] = [
    {
      chave: 'codigo',
      rotulo: 'Código',
      ordenavel: true,
      renderizar: (c) => <span className="font-mono">{c.codigo}</span>,
    },
    {
      chave: 'nome',
      rotulo: 'Nome',
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
      rotulo: 'Etapa',
      ordenavel: true,
      renderizar: (c) => ROTULO_ETAPA[c.etapa] ?? c.etapa,
    },
    {
      chave: 'capacidade_horas_dia',
      rotulo: 'Capacidade',
      alinhamento: 'direita',
      renderizar: (c) => formatarCapacidade(c.capacidade_horas_dia),
    },
    { chave: 'ativo', rotulo: 'Situação', renderizar: (c) => <BadgeSituacao ativo={c.ativo} /> },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Centros de trabalho</h1>
        <p className="text-body text-texto-secondary">
          Bancadas e postos onde cada etapa da produção acontece.
        </p>
      </div>

      <BarraDeFiltros
        busca={lista.busca}
        aoBuscar={lista.definirBusca}
        rotuloBusca="Buscar por código ou nome"
        filtroAtivo={lista.filtroAtivo}
        aoFiltrarSituacao={lista.definirFiltroAtivo}
        filtrosExtras={
          <div className="w-[180px]">
            <Selecao
              rotulo="Etapa"
              placeholder="Todas"
              opcoes={OPCOES_ETAPA}
              value={lista.filtros.etapa ?? ''}
              onChange={(evento) => lista.definirFiltro('etapa', evento.target.value)}
            />
          </div>
        }
      >
        {podeIncluir && (
          <Botao icone="plus" onClick={crud.abrirNovo}>
            Novo centro de trabalho
          </Botao>
        )}
      </BarraDeFiltros>

      <div>
        <Tabela<CentroTrabalho>
          rotulo="Centros de trabalho"
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(c) => c.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio="Nenhum centro de trabalho encontrado. Ajuste os filtros ou cadastre um centro de trabalho."
          acoes={
            podeEditar || podeInativar
              ? (c) => (
                  <span className="flex items-center justify-end gap-2">
                    {podeEditar && (
                      <Botao
                        variante="fantasma"
                        icone="pencil"
                        aria-label={`Editar ${c.codigo}`}
                        onClick={() => crud.abrirEdicao(c)}
                      >
                        Editar
                      </Botao>
                    )}
                    {podeInativar && c.ativo && (
                      <Botao
                        variante="fantasma"
                        icone="trash-2"
                        aria-label={`Inativar ${c.codigo}`}
                        onClick={() => crud.pedirInativacao(c)}
                      >
                        Inativar
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
        titulo={crud.emEdicao ? 'Editar centro de trabalho' : 'Novo centro de trabalho'}
        descricao="Campos com * são obrigatórios."
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
        titulo="Inativar centro de trabalho"
        mensagem={
          crud.aInativar
            ? `Inativar o centro de trabalho ${crud.aInativar.codigo} · ${crud.aInativar.nome}? Ele deixa de aparecer nas listas de seleção. O histórico é preservado.`
            : ''
        }
        rotuloConfirmar="Inativar"
        rotuloOcupado="Inativando…"
        ocupado={crud.inativando}
        aoConfirmar={crud.confirmarInativacao}
        aoCancelar={crud.cancelarInativacao}
      />
    </div>
  );
}
