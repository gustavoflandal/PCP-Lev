import { BarraDeFiltros } from '@/componentes/ui/BarraDeFiltros';
import { BadgeSituacao } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Confirmacao } from '@/componentes/ui/Confirmacao';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useCadastroCrud } from '@/hooks/useCadastroCrud';
import { useListagem } from '@/hooks/useListagem';
import { formatarDias, formatarMoeda } from '@/lib/formato';
import { podeGerenciarCadastros } from '@/lib/permissoes';
import { useAutenticacao } from '@/store/autenticacao';
import type { ProdutoAcabado } from '@/tipos/cadastros';
import { FormularioProduto } from './FormularioProduto';

export function ProdutosAcabados() {
  const perfil = useAutenticacao((estado) => estado.usuario?.perfil);
  const podeGerenciar = podeGerenciarCadastros(perfil);

  const lista = useListagem<ProdutoAcabado>('produtos-acabados', 'codigo');
  const crud = useCadastroCrud<ProdutoAcabado>('produtos-acabados', {
    criado: 'Produto cadastrado',
    atualizado: 'Produto atualizado',
    inativado: 'Produto inativado',
  });

  const colunas: Coluna<ProdutoAcabado>[] = [
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
      chave: 'preco_venda',
      rotulo: 'Preço de venda',
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (p) => formatarMoeda(p.preco_venda),
    },
    {
      chave: 'lead_time_producao',
      rotulo: 'Lead time',
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (p) => formatarDias(p.lead_time_producao),
    },
    { chave: 'ativo', rotulo: 'Situação', renderizar: (p) => <BadgeSituacao ativo={p.ativo} /> },
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Produtos acabados</h1>
        <p className="text-body text-texto-secondary">O que é vendido ao cliente.</p>
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
            Novo produto
          </Botao>
        )}
      </BarraDeFiltros>

      <div>
        <Tabela<ProdutoAcabado>
          rotulo="Produtos acabados"
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(p) => p.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio="Nenhum produto acabado cadastrado. Cadastre o primeiro para começar."
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
        titulo={crud.emEdicao ? 'Editar produto' : 'Novo produto'}
        descricao="Campos com * são obrigatórios."
      >
        <FormularioProduto
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
        titulo="Inativar produto"
        mensagem={
          crud.aInativar
            ? `Inativar o produto ${crud.aInativar.codigo}? Ele deixa de aparecer nas listas de seleção. O histórico é preservado.`
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
