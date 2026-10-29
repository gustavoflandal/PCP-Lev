import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Miniatura } from '@/componentes/arquivos/Miniatura';
import { Badge, type TomBadge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import type { NomeIcone } from '@/componentes/ui/icones';
import { useListagemEstoque } from '@/hooks/useListagemEstoque';
import { t } from '@/i18n';
import { baixarArquivo } from '@/lib/arquivos';
import { separarErro } from '@/lib/errosDeFormulario';
import type { SaldoEstoque, StatusEstoque } from '@/tipos/estoque';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { KardexDaPeca, OrigemDoSaldo } from './ConsultasDoSaldo';
import { ModalAjuste } from './ModalAjuste';

const opcoesStatus = () => [
  { valor: 'OK', rotulo: t('OK') },
  { valor: 'CRITICO', rotulo: t('Crítico') },
  { valor: 'BLOQUEADO', rotulo: t('Bloqueado') },
];

const TOM_STATUS: Record<StatusEstoque, { tom: TomBadge; icone: NomeIcone }> = {
  OK: { tom: 'done', icone: 'check-circle-2' },
  CRITICO: { tom: 'warning', icone: 'alert-triangle' },
  BLOQUEADO: { tom: 'blocked', icone: 'shield-alert' },
};

export function Estoque() {
  const podeAjustar = usePode(PERMISSOES.estoqueAjustar);
  const podeExportar = usePode(PERMISSOES.estoqueExportar);
  const lista = useListagemEstoque();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const [itemEmAjuste, definirItemEmAjuste] = useState<SaldoEstoque | null>(null);
  const [consulta, definirConsulta] = useState<{ tipo: 'kardex' | 'origem'; item: SaldoEstoque } | null>(null);

  const mutacaoExportar = useMutation({
    mutationFn: () => baixarArquivo('/estoque/relatorio.csv', 'estoque.csv'),
    onError: (erro) => mostrarToast(separarErro(erro).geral ?? t('Não foi possível exportar o relatório de estoque.')),
  });

  const todasColunas: Coluna<SaldoEstoque>[] = [
    { chave: 'foto', rotulo: t('Foto'), renderizar: (i) => <Miniatura url={i.foto_url} alt={t('Foto da peça {codigo}', { codigo: i.codigo })} /> },
    { chave: 'codigo', rotulo: t('Código'), ordenavel: true, renderizar: (i) => <span className="font-mono">{i.codigo}</span> },
    { chave: 'descricao', rotulo: t('Descrição'), renderizar: (i) => i.descricao },
    { chave: 'quantidade_atual', rotulo: t('Saldo atual'), ordenavel: true, alinhamento: 'direita', renderizar: (i) => i.quantidade_atual },
    // "Reservado" (quantidade_reservada) foi retirado da tabela: reserva por
    // OP so chega no Sprint 6 (backend/internal/domain/estoque/estoque.go),
    // entao a coluna era sempre 0 em todo saldo cadastrado nesta sprint --
    // ocupava espaco sem ajudar a decisao de quem opera. "Disponível" fica,
    // porque e o numero que ja importa hoje (o que pode ser prometido/usado)
    // e continua correto quando a reserva passar a existir.
    { chave: 'disponivel', rotulo: t('Disponível'), alinhamento: 'direita', renderizar: (i) => i.disponivel },
    {
      chave: 'status',
      rotulo: t('Situação'),
      ordenavel: true,
      renderizar: (i) => (
        <Badge tom={TOM_STATUS[i.status].tom} icone={TOM_STATUS[i.status].icone}>
          {i.status === 'CRITICO' ? t('Crítico') : i.status === 'BLOQUEADO' ? t('Bloqueado') : t('OK')}
        </Badge>
      ),
    },
    {
      chave: 'acao',
      rotulo: t('Ações'),
      renderizar: (i) => (
        <span className="flex flex-wrap items-center gap-1">
          <Botao
            variante="fantasma"
            icone="history"
            aria-label={t('Kardex de {codigo}', { codigo: i.codigo })}
            onClick={() => definirConsulta({ tipo: 'kardex', item: i })}
          >
            {t('Kardex')}
          </Botao>
          <Botao
            variante="fantasma"
            icone="layers"
            aria-label={t('Origem do saldo de {codigo}', { codigo: i.codigo })}
            onClick={() => definirConsulta({ tipo: 'origem', item: i })}
          >
            {t('Origem do saldo')}
          </Botao>
          {/* Sem estoque.ajustar, o botao de ajuste nem aparece. */}
          {podeAjustar && (
            <Botao variante="fantasma" icone="pencil" aria-label={t('Ajustar {codigo}', { codigo: i.codigo })} onClick={() => definirItemEmAjuste(i)}>
              {t('Ajustar')}
            </Botao>
          )}
        </span>
      ),
    },
  ];
  const colunas = todasColunas;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">{t('Estoque')}</h1>
        <p className="text-body text-texto-secondary">
          {t('Saldo de partes e peças em armazém.')}{' '}
          <Link to="/movimentacoes" className="text-brand hover:underline">
            {t('Ver histórico de movimentações')}
          </Link>
          {' · '}
          <Link to="/lotes" className="text-brand hover:underline">
            {t('Ver lotes e validades')}
          </Link>
        </p>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="w-[200px]">
          <Selecao
            rotulo={t('Situação')}
            opcoes={opcoesStatus()}
            placeholder={t('Todos')}
            value={lista.status ?? ''}
            onChange={(evento) => lista.definirStatus(evento.target.value || null)}
          />
        </div>
        {podeExportar && (
          <Botao
            variante="secundaria"
            icone="save"
            ocupado={mutacaoExportar.isPending}
            rotuloOcupado={t('Exportando…')}
            onClick={() => mutacaoExportar.mutate()}
          >
            {t('Exportar CSV')}
          </Botao>
        )}
      </div>

      <div>
        <Tabela<SaldoEstoque>
          rotulo={t('Estoque')}
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(i) => i.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio={t('Nenhum item de estoque cadastrado ainda.')}
        />
        <Paginacao
          pagina={lista.paginacao.pagina}
          totalPaginas={lista.paginacao.total_paginas}
          total={lista.paginacao.total}
          aoMudar={lista.definirPagina}
        />
      </div>

      {itemEmAjuste && <ModalAjuste item={itemEmAjuste} aoFechar={() => definirItemEmAjuste(null)} />}
      {consulta?.tipo === 'kardex' && <KardexDaPeca item={consulta.item} aoFechar={() => definirConsulta(null)} />}
      {consulta?.tipo === 'origem' && <OrigemDoSaldo item={consulta.item} aoFechar={() => definirConsulta(null)} />}
    </div>
  );
}
