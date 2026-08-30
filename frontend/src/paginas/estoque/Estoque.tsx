import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge, type TomBadge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Modal } from '@/componentes/ui/Modal';
import { Paginacao } from '@/componentes/ui/Paginacao';
import { Selecao } from '@/componentes/ui/Selecao';
import { Tabela, type Coluna } from '@/componentes/ui/Tabela';
import { useToasts } from '@/componentes/ui/Toast';
import type { NomeIcone } from '@/componentes/ui/icones';
import { useListagemEstoque } from '@/hooks/useListagemEstoque';
import { separarErro } from '@/lib/errosDeFormulario';
import { ajustarEstoque } from '@/servicos/estoque';
import type { SaldoEstoque, StatusEstoque } from '@/tipos/estoque';

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
  const lista = useListagemEstoque();
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const [itemEmAjuste, definirItemEmAjuste] = useState<SaldoEstoque | null>(null);
  const [quantidade, definirQuantidade] = useState('');
  const [motivo, definirMotivo] = useState('');
  const [observacoes, definirObservacoes] = useState('');

  const mutacaoAjuste = useMutation({
    mutationFn: () =>
      ajustarEstoque({
        parte_peca_id: itemEmAjuste!.parte_peca_id,
        quantidade: Number(quantidade),
        motivo,
        observacoes: observacoes || undefined,
      }),
    onSuccess: () => {
      void clienteQuery.invalidateQueries({ queryKey: ['estoque'] });
      mostrarToast('Estoque ajustado');
      fecharModal();
    },
  });

  function abrirModal(item: SaldoEstoque) {
    definirItemEmAjuste(item);
    definirQuantidade('');
    definirMotivo('');
    definirObservacoes('');
  }
  function fecharModal() {
    definirItemEmAjuste(null);
  }

  const colunas: Coluna<SaldoEstoque>[] = [
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
      rotulo: 'Ação',
      renderizar: (i) => (
        <Botao variante="fantasma" icone="pencil" onClick={() => abrirModal(i)}>
          Ajustar
        </Botao>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="text-title text-texto-primary">Estoque</h1>
        <p className="text-body text-texto-secondary">Saldo de partes e peças em armazém.</p>
      </div>

      <div className="w-[200px]">
        <Selecao
          rotulo="Situação"
          opcoes={OPCOES_STATUS}
          placeholder="Todos"
          value={lista.status ?? ''}
          onChange={(evento) => lista.definirStatus(evento.target.value || null)}
        />
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

      {itemEmAjuste && (
        <Modal aberto aoFechar={fecharModal} titulo={`Ajustar saldo — ${itemEmAjuste.codigo}`}>
          <form
            noValidate
            onSubmit={(evento) => {
              evento.preventDefault();
              mutacaoAjuste.mutate();
            }}
            className="flex flex-col gap-4"
          >
            {mutacaoAjuste.isError && (
              <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
                {separarErro(mutacaoAjuste.error).geral}
              </p>
            )}
            <p className="text-body text-texto-secondary">
              Saldo atual: {itemEmAjuste.quantidade_atual}. Use um número negativo para registrar saída.
            </p>
            <Campo
              rotulo="Quantidade"
              obrigatorio
              tipoDado="quantidade"
              value={quantidade}
              onChange={(evento) => definirQuantidade(evento.target.value)}
            />
            <Campo rotulo="Motivo" obrigatorio value={motivo} onChange={(evento) => definirMotivo(evento.target.value)} />
            <Campo
              rotulo="Observações"
              value={observacoes}
              onChange={(evento) => definirObservacoes(evento.target.value)}
            />
            <div className="flex items-center justify-end gap-2">
              <Botao variante="secundaria" onClick={fecharModal} disabled={mutacaoAjuste.isPending}>
                Cancelar
              </Botao>
              <Botao type="submit" icone="save" ocupado={mutacaoAjuste.isPending} rotuloOcupado="Salvando…">
                Salvar ajuste
              </Botao>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
