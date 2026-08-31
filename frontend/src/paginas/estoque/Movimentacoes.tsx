import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
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
      : 'Não foi possível carregar o histórico. Tente de novo.'
    : null;

  const colunas: Coluna<Movimentacao>[] = [
    { chave: 'data_hora', rotulo: 'Data/hora', renderizar: (m) => formatarData(m.data_hora) },
    { chave: 'codigo_pp', rotulo: 'Peça', renderizar: (m) => <span className="font-mono">{m.codigo_pp}</span> },
    { chave: 'tipo', rotulo: 'Tipo', renderizar: (m) => m.tipo },
    { chave: 'quantidade', rotulo: 'Quantidade', alinhamento: 'direita', renderizar: (m) => m.quantidade },
    { chave: 'motivo', rotulo: 'Motivo', renderizar: (m) => m.motivo },
    { chave: 'referencia_numero', rotulo: 'Referência', renderizar: (m) => m.referencia_numero ?? '—' },
    { chave: 'usuario', rotulo: 'Usuário', renderizar: (m) => m.usuario ?? '—' },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Movimentações</h1>
        <p className="text-body text-texto-secondary">
          Histórico de entradas e ajustes de estoque.{' '}
          <Link to="/estoque" className="text-brand hover:underline">
            Voltar para o estoque
          </Link>
        </p>
      </div>

      <div>
        <Tabela<Movimentacao>
          rotulo="Movimentações"
          colunas={colunas}
          itens={consulta.data?.itens ?? []}
          chaveDe={(m) => m.id}
          ordenarPor="data_hora"
          ordem="desc"
          aoOrdenar={() => {}}
          carregando={consulta.isPending}
          erro={erro}
          aoTentarDeNovo={() => void consulta.refetch()}
          vazio="Nenhuma movimentação registrada ainda."
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
