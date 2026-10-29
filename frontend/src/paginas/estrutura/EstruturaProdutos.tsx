import { useNavigate } from 'react-router-dom';
import { BarraDeFiltros } from '@/componentes/ui/BarraDeFiltros';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useListagem } from '@/hooks/useListagem';
import { formatarData } from '@/lib/formato';
import type { ProdutoAcabado } from '@/tipos/cadastros';
import { t } from '@/i18n';

export function EstruturaProdutos() {
  const navegar = useNavigate();
  const lista = useListagem<ProdutoAcabado>('produtos-acabados', 'codigo');

  const colunas: Coluna<ProdutoAcabado>[] = [
    {
      chave: 'codigo',
      rotulo: t('Código'),
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
    { chave: 'descricao', rotulo: t('Descrição'), ordenavel: true, renderizar: (p) => p.descricao },
    {
      chave: 'estrutura',
      rotulo: t('Estrutura'),
      renderizar: (p) =>
        p.estrutura_ativa
          ? t('v.{n} desde {data}', { n: p.estrutura_ativa.versao, data: formatarData(p.estrutura_ativa.data_vigencia_inicio) })
          : t('Sem estrutura ativa'),
    },
  ];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Estrutura de produtos')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Componentes necessários para montar cada produto acabado.')}
        </p>
      </div>

      <BarraDeFiltros
        busca={lista.busca}
        aoBuscar={lista.definirBusca}
        rotuloBusca={t('Buscar por código ou descrição')}
        filtroAtivo={lista.filtroAtivo}
        aoFiltrarSituacao={lista.definirFiltroAtivo}
      />

      <div>
        <Tabela<ProdutoAcabado>
          rotulo={t('Estrutura de produtos')}
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(p) => p.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio={t('Nenhum produto acabado cadastrado ainda.')}
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
