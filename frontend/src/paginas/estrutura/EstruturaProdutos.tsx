import { useNavigate } from 'react-router-dom';
import { BarraDeFiltros } from '@/componentes/ui/BarraDeFiltros';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useListagem } from '@/hooks/useListagem';
import { formatarData } from '@/lib/formato';
import type { ProdutoAcabado } from '@/tipos/cadastros';

export function EstruturaProdutos() {
  const navegar = useNavigate();
  const lista = useListagem<ProdutoAcabado>('produtos-acabados', 'codigo');

  const colunas: Coluna<ProdutoAcabado>[] = [
    {
      chave: 'codigo',
      rotulo: 'Código',
      ordenavel: true,
      renderizar: (p) => (
        <button
          type="button"
          onClick={() => navegar(`/estrutura-produtos/${p.id}`)}
          className="font-mono text-brand hover:underline"
        >
          {p.codigo}
        </button>
      ),
    },
    { chave: 'descricao', rotulo: 'Descrição', ordenavel: true, renderizar: (p) => p.descricao },
    {
      chave: 'estrutura',
      rotulo: 'Estrutura',
      renderizar: (p) =>
        p.estrutura_ativa
          ? `v.${p.estrutura_ativa.versao} desde ${formatarData(p.estrutura_ativa.data_vigencia_inicio)}`
          : 'Sem estrutura ativa',
    },
  ];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Estrutura de produtos</h1>
        <p className="text-body text-texto-secondary">
          Componentes necessários para montar cada produto acabado.
        </p>
      </div>

      <BarraDeFiltros
        busca={lista.busca}
        aoBuscar={lista.definirBusca}
        rotuloBusca="Buscar por código ou descrição"
        filtroAtivo={lista.filtroAtivo}
        aoFiltrarSituacao={lista.definirFiltroAtivo}
      />

      <div>
        <Tabela<ProdutoAcabado>
          rotulo="Estrutura de produtos"
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(p) => p.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio="Nenhum produto acabado cadastrado ainda."
        />
        <Paginacao
          pagina={lista.paginacao.pagina}
          totalPaginas={lista.paginacao.total_paginas}
          total={lista.paginacao.total}
          aoMudar={lista.definirPagina}
        />
      </div>
    </div>
  );
}
