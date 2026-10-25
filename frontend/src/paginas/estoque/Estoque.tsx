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
import { baixarArquivo } from '@/lib/arquivos';
import { separarErro } from '@/lib/errosDeFormulario';
import type { SaldoEstoque, StatusEstoque } from '@/tipos/estoque';
import { PERMISSOES, usePode } from '@/lib/permissoes';
import { KardexDaPeca, OrigemDoSaldo } from './ConsultasDoSaldo';
import { ModalAjuste } from './ModalAjuste';

const OPCOES_STATUS = [
  { valor: 'OK', rotulo: 'OK' },
  { valor: 'CRITICO', rotulo: 'Crítico' },
  { valor: 'BLOQUEADO', rotulo: 'Bloqueado' },
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
    onError: (erro) => mostrarToast(separarErro(erro).geral ?? 'Não foi possível exportar o relatório de estoque.'),
  });

  const todasColunas: Coluna<SaldoEstoque>[] = [
    { chave: 'foto', rotulo: 'Foto', renderizar: (i) => <Miniatura url={i.foto_url} alt={`Foto da peça ${i.codigo}`} /> },
    { chave: 'codigo', rotulo: 'Código', ordenavel: true, renderizar: (i) => <span className="font-mono">{i.codigo}</span> },
    { chave: 'descricao', rotulo: 'Descrição', renderizar: (i) => i.descricao },
    { chave: 'quantidade_atual', rotulo: 'Saldo atual', ordenavel: true, alinhamento: 'direita', renderizar: (i) => i.quantidade_atual },
    // "Reservado" (quantidade_reservada) foi retirado da tabela: reserva por
    // OP so chega no Sprint 6 (backend/internal/domain/estoque/estoque.go),
    // entao a coluna era sempre 0 em todo saldo cadastrado nesta sprint --
    // ocupava espaco sem ajudar a decisao de quem opera. "Disponível" fica,
    // porque e o numero que ja importa hoje (o que pode ser prometido/usado)
    // e continua correto quando a reserva passar a existir.
    { chave: 'disponivel', rotulo: 'Disponível', alinhamento: 'direita', renderizar: (i) => i.disponivel },
    {
      chave: 'status',
      rotulo: 'Situação',
      ordenavel: true,
      renderizar: (i) => (
        <Badge tom={TOM_STATUS[i.status].tom} icone={TOM_STATUS[i.status].icone}>
          {i.status === 'CRITICO' ? 'Crítico' : i.status === 'BLOQUEADO' ? 'Bloqueado' : 'OK'}
        </Badge>
      ),
    },
    {
      chave: 'acao',
      rotulo: 'Ações',
      renderizar: (i) => (
        <span className="flex flex-wrap items-center gap-1">
          <Botao
            variante="fantasma"
            icone="history"
            aria-label={`Kardex de ${i.codigo}`}
            onClick={() => definirConsulta({ tipo: 'kardex', item: i })}
          >
            Kardex
          </Botao>
          <Botao
            variante="fantasma"
            icone="layers"
            aria-label={`Origem do saldo de ${i.codigo}`}
            onClick={() => definirConsulta({ tipo: 'origem', item: i })}
          >
            Origem do saldo
          </Botao>
          {/* Sem estoque.ajustar, o botao de ajuste nem aparece. */}
          {podeAjustar && (
            <Botao variante="fantasma" icone="pencil" aria-label={`Ajustar ${i.codigo}`} onClick={() => definirItemEmAjuste(i)}>
              Ajustar
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
        <h1 className="text-title text-texto-primary">Estoque</h1>
        <p className="text-body text-texto-secondary">
          Saldo de partes e peças em armazém.{' '}
          <Link to="/movimentacoes" className="text-brand hover:underline">
            Ver histórico de movimentações
          </Link>
          {' · '}
          <Link to="/lotes" className="text-brand hover:underline">
            Ver lotes e validades
          </Link>
        </p>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="w-[200px]">
          <Selecao
            rotulo="Situação"
            opcoes={OPCOES_STATUS}
            placeholder="Todos"
            value={lista.status ?? ''}
            onChange={(evento) => lista.definirStatus(evento.target.value || null)}
          />
        </div>
        {podeExportar && (
          <Botao
            variante="secundaria"
            icone="save"
            ocupado={mutacaoExportar.isPending}
            rotuloOcupado="Exportando…"
            onClick={() => mutacaoExportar.mutate()}
          >
            Exportar CSV
          </Botao>
        )}
      </div>

      <div>
        <Tabela<SaldoEstoque>
          rotulo="Estoque"
          colunas={colunas}
          itens={lista.itens}
          chaveDe={(i) => i.id}
          ordenarPor={lista.ordenarPor}
          ordem={lista.ordem}
          aoOrdenar={lista.alternarOrdenacao}
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarDeNovo={lista.recarregar}
          vazio="Nenhum item de estoque cadastrado ainda."
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
