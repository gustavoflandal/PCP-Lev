import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { t, td } from '@/i18n';
import { formatarData } from '@/lib/formato';
import { listarMovimentacoes } from '@/servicos/estoque';
import { ErroApi } from '@/servicos/api';
import type { Movimentacao } from '@/tipos/estoque';

const LIMITE = 20;

/**
 * Historico de movimentacoes de estoque, so leitura. Sem busca/filtro nesta
 * sprint -- o backend (GET /movimentacoes) ainda nao aceita nenhum parametro
 * alem de paginacao (ver nota em estoque_repo.go), entao a tela nao promete
 * um filtro que a API recusaria.
 */
export function Movimentacoes() {
  const [pagina, definirPagina] = useState(1);

  const consulta = useQuery({
    queryKey: ['movimentacoes', pagina],
    queryFn: () => listarMovimentacoes(pagina, LIMITE),
    placeholderData: keepPreviousData,
  });

  const erro = consulta.error
    ? consulta.error instanceof ErroApi
      ? consulta.error.message
      : t('Não foi possível carregar o histórico. Tente de novo.')
    : null;

  const colunas: Coluna<Movimentacao>[] = [
    { chave: 'data_hora', rotulo: t('Data/hora'), renderizar: (m) => formatarData(m.data_hora) },
    { chave: 'codigo_pp', rotulo: t('Peça'), renderizar: (m) => <span className="font-mono">{m.codigo_pp}</span> },
    { chave: 'tipo', rotulo: t('Tipo'), renderizar: (m) => td(m.tipo) },
    { chave: 'quantidade', rotulo: t('Quantidade'), alinhamento: 'direita', renderizar: (m) => m.quantidade },
    { chave: 'motivo', rotulo: t('Motivo'), renderizar: (m) => td(m.motivo) },
    { chave: 'referencia_numero', rotulo: t('Referência'), renderizar: (m) => m.referencia_numero ?? '—' },
    { chave: 'usuario', rotulo: t('Usuário'), renderizar: (m) => m.usuario ?? '—' },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Movimentações')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Histórico de entradas e ajustes de estoque.')}{' '}
          <Link to="/estoque" className="text-brand hover:underline">
            {t('Voltar para o estoque')}
          </Link>
        </p>
      </div>

      <div>
        <Tabela<Movimentacao>
          rotulo={t('Movimentações')}
          colunas={colunas}
          itens={consulta.data?.itens ?? []}
          chaveDe={(m) => m.id}
          ordenarPor="data_hora"
          ordem="desc"
          aoOrdenar={() => {}}
          carregando={consulta.isPending}
          erro={erro}
          aoTentarDeNovo={() => void consulta.refetch()}
          vazio={t('Nenhuma movimentação registrada ainda.')}
        />
        <Paginacao
          pagina={consulta.data?.paginacao.pagina ?? pagina}
          totalPaginas={consulta.data?.paginacao.total_paginas ?? 0}
          total={consulta.data?.paginacao.total ?? 0}
          aoMudar={definirPagina}
        />
      </div>
    </div>
  );
}
