import { BarraDeFiltros } from '@/componentes/ui/BarraDeFiltros';
import { BadgeSituacao } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useCadastroCrud } from '@/hooks/useCadastroCrud';
import { useListagem } from '@/hooks/useListagem';
import { formatarDias } from '@/lib/formato';
import { podeGerenciarCadastros } from '@/lib/permissoes';
import { useAutenticacao } from '@/store/autenticacao';
import type { PartePeca } from '@/tipos/cadastros';
import { FormularioPeca } from './FormularioPeca';

export function PartesPecas() {
  const perfil = useAutenticacao((estado) => estado.usuario?.perfil);
  const podeGerenciar = podeGerenciarCadastros(perfil);

  const lista = useListagem<PartePeca>('partes-pecas', 'codigo');
  const crud = useCadastroCrud<PartePeca>('partes-pecas', {
    criado: 'Peça cadastrada',
    atualizado: 'Peça atualizada',
    inativado: 'Peça inativada',
  });

  const colunas: Coluna<PartePeca>[] = [
    {
      chave: 'codigo',
      rotulo: 'Código',
      ordenavel: true,
      renderizar: (p) => <span className="font-mono">{p.codigo}</span>,
    },
    {
      chave: 'descricao',
      rotulo: 'Descrição',
      ordenavel: true,
      renderizar: (p) => p.descricao,
    },
    {
      chave: 'unidade_medida',
      rotulo: 'Unidade',
      renderizar: (p) => p.unidade_medida,
    },
    {
      chave: 'estoque_minimo',
      rotulo: 'Estoque mín./máx.',
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (p) => `${p.estoque_minimo} / ${p.estoque_maximo}`,
    },
    {
      chave: 'lead_time_compra',
      rotulo: 'Lead time',
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (p) => formatarDias(p.lead_time_compra),
    },
    { chave: 'ativo', rotulo: 'Situação', renderizar: (p) => <BadgeSituacao ativo={p.ativo} /> },
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Partes e peças</h1>
        <p className="text-body text-texto-secondary">
          Componentes comprados e consumidos na montagem.
        </p>
      </div>

      <BarraDeFiltros
        busca={lista.busca}
        aoBuscar={lista.definirBusca}
        rotuloBusca="Buscar por código ou descrição"
        filtroAtivo={lista.filtroAtivo}
        aoFiltrarSituacao={lista.definirFiltroAtivo}
      >
        {podeGerenciar && (
          <Botao icone="plus" onClick={crud.abrirNovo}>
            Nova peça
          </Botao>
        )}
      </BarraDeFiltros>

      <div>
        <Tabela<PartePeca>
          rotulo="Partes e peças"
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(p) => p.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio="Nenhuma parte ou peça cadastrada. Cadastre a primeira para começar."
          acoes={
            podeGerenciar
              ? (p) => (
                  <span className="flex items-center justify-end gap-2">
                    <Botao
                      variante="fantasma"
                      icone="pencil"
                      aria-label={`Editar ${p.codigo}`}
                      onClick={() => crud.abrirEdicao(p)}
                    >
                      Editar
                    </Botao>
                    {p.ativo && (
                      <Botao
                        variante="fantasma"
                        icone="trash-2"
                        aria-label={`Inativar ${p.codigo}`}
                        onClick={() => crud.pedirInativacao(p)}
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
        titulo={crud.emEdicao ? 'Editar peça' : 'Nova peça'}
        descricao="Campos com * são obrigatórios."
      >
        <FormularioPeca
          // A chave remonta o formulario ao trocar de registro: sem isso os
          // defaultValues do react-hook-form ficam presos no primeiro item.
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
        titulo="Inativar peça"
        mensagem={
          crud.aInativar
            ? `Inativar a peça ${crud.aInativar.codigo}? Ela deixa de aparecer nas listas de seleção. O histórico é preservado.`
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
