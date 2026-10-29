import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SeloStatusNota } from '@/componentes/recebimento/Selos';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useListagemCompras } from '@/hooks/useListagemCompras';
import { t, td } from '@/i18n';
import { formatarData, formatarMoeda } from '@/lib/formato';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { STATUS_NOTA, type NotaEntrada } from '@/tipos/notasEntrada';
import { ImportarXML } from './ImportarXML';

const opcoesStatus = () => STATUS_NOTA.map((s) => ({ valor: s, rotulo: td(s) }));

/** /notas-entrada — toda entrada de insumo comprado nasce de uma nota (RN-001). */
export function NotasEntrada() {
  const navegar = useNavigate();
  const podeLancar = usePode(PERMISSOES.notasLancar);
  const lista = useListagemCompras<NotaEntrada>('notas-entrada', 'data_entrada', undefined, 'desc');
  const [importando, definirImportando] = useState(false);

  const colunas: Coluna<NotaEntrada>[] = [
    {
      chave: 'numero',
      rotulo: t('Nota (série/número)'),
      ordenavel: true,
      renderizar: (n) => (
        <Link to={`/notas-entrada/${n.id}`} className="font-mono text-brand hover:underline">
          {n.numero}/{n.serie}
        </Link>
      ),
    },
    { chave: 'fornecedor', rotulo: t('Fornecedor'), renderizar: (n) => n.fornecedor_nome || '—' },
    {
      chave: 'pedido',
      rotulo: t('Pedido de compra'),
      renderizar: (n) => (
        <Link to={`/pedidos-compra/${n.pedido_compra_id}`} className="font-mono text-brand hover:underline">
          {n.numero_pc}
        </Link>
      ),
    },
    { chave: 'data_emissao', rotulo: t('Emissão'), ordenavel: true, renderizar: (n) => formatarData(n.data_emissao ?? undefined) },
    { chave: 'data_entrada', rotulo: t('Entrada'), ordenavel: true, renderizar: (n) => formatarData(n.data_entrada ?? undefined) },
    {
      chave: 'valor_total',
      rotulo: t('Valor total'),
      ordenavel: true,
      alinhamento: 'direita',
      renderizar: (n) => formatarMoeda(n.valor_total),
    },
    {
      chave: 'status',
      rotulo: t('Situação'),
      ordenavel: true,
      renderizar: (n) => (
        <span className="flex flex-wrap gap-1">
          <SeloStatusNota status={n.status} />
          {n.origem === 'XML' && (
            <Badge tom="neutral" icone="file-code">
              XML
            </Badge>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Notas fiscais de entrada')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Recebimento fiscal: nada entra no estoque sem nota vinculada a um pedido de compra.')}
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-[320px] max-w-full">
            <Campo
              rotulo={t('Buscar por número, chave, pedido ou fornecedor')}
              value={lista.busca}
              onChange={(e) => lista.definirBusca(e.target.value)}
              placeholder={t('Digite para filtrar')}
            />
          </div>
          <div className="w-[200px]">
            <Selecao
              rotulo={t('Situação')}
              opcoes={opcoesStatus()}
              placeholder={t('Todas')}
              value={lista.status ?? ''}
              onChange={(e) => lista.definirStatus(e.target.value || null)}
            />
          </div>
        </div>
        {podeLancar && (
          <div className="flex items-center gap-2">
            <Botao variante="secundaria" icone="file-code" onClick={() => definirImportando(true)}>
              {t('Importar XML')}
            </Botao>
            <Botao icone="plus" onClick={() => navegar('/notas-entrada/nova')}>
              {t('Nova nota fiscal')}
            </Botao>
          </div>
        )}
      </div>

      <div>
        <Tabela<NotaEntrada>
          rotulo={t('Notas fiscais de entrada')}
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(n) => n.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio={
            podeLancar
              ? t('Nenhuma nota fiscal lançada. Lance a primeira ou importe o XML da NF-e.')
              : t('Nenhuma nota fiscal lançada.')
          }
        />
        <Paginacao
          pagina={lista.paginacao.pagina}
          totalPaginas={lista.paginacao.total_paginas}
          total={lista.paginacao.total}
          aoMudar={lista.definirPagina}
        />
      </div>

      <ImportarXML aberto={importando} aoFechar={() => definirImportando(false)} />
    </div>
  );
}
