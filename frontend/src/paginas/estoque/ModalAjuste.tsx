import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { mensagemDeErro } from '@/componentes/arquivos/comum';
import { EntradaSeries } from '@/componentes/recebimento/EntradaSeries';
import { Badge } from '@/componentes/ui/Badge';
import { Botao } from '@/componentes/ui/Botao';
import { Campo } from '@/componentes/ui/Campo';
import { Modal } from '@/componentes/ui/Modal';
import { useToasts } from '@/componentes/ui/Toast';
import { usePartesPecasAtivas } from '@/hooks/usePartesPecasAtivas';
import { t } from '@/i18n';
import { ajustarEstoque, type CorpoAjusteEstoque } from '@/servicos/estoque';
import type { SaldoEstoque } from '@/tipos/estoque';
import type { SerieItem } from '@/tipos/notasEntrada';

export interface ModalAjusteProps {
  item: SaldoEstoque;
  aoFechar: () => void;
}

/**
 * Ajuste manual de saldo (origem controlada: permissao + motivo + auditoria).
 * Item com lote pede o lote (entrada cria ou soma; saida baixa dele) e item
 * com serie pede uma serie por unidade ajustada -- e o caminho do inventario
 * de abertura de itens rastreados (v1.2).
 */
export function ModalAjuste({ item, aoFechar }: ModalAjusteProps) {
  const clienteQuery = useQueryClient();
  const mostrarToast = useToasts((estado) => estado.mostrar);
  const pecas = usePartesPecasAtivas();
  const peca = pecas.itens.find((p) => p.id === item.parte_peca_id);
  const comLote = !!peca?.controla_lote;
  const comValidade = !!peca?.controla_validade;
  const comSerie = !!peca?.controla_numero_serie;

  const [quantidade, definirQuantidade] = useState('');
  const [motivo, definirMotivo] = useState('');
  const [observacoes, definirObservacoes] = useState('');
  const [numeroLote, definirNumeroLote] = useState('');
  const [validade, definirValidade] = useState('');
  const [fabricacao, definirFabricacao] = useState('');
  const [series, definirSeries] = useState<SerieItem[]>([]);
  const [erroLocal, definirErroLocal] = useState<string | null>(null);

  const qtd = Number(quantidade.replace(',', '.'));
  const absoluto = Number.isFinite(qtd) ? Math.abs(Math.trunc(qtd)) : 0;
  const saida = qtd < 0;

  const mutacao = useMutation({
    mutationFn: () => {
      const corpo: CorpoAjusteEstoque = {
        parte_peca_id: item.parte_peca_id,
        quantidade: qtd,
        motivo,
        observacoes: observacoes || undefined,
      };
      if (comLote) {
        corpo.lote = {
          numero_lote: numeroLote.trim(),
          validade: !saida && comValidade && validade ? validade : null,
          data_fabricacao: !saida && fabricacao ? fabricacao : null,
        };
      }
      if (comSerie) corpo.series = series.map((s) => s.numero);
      return ajustarEstoque(corpo);
    },
    onSuccess: () => {
      void clienteQuery.invalidateQueries({ queryKey: ['estoque'] });
      void clienteQuery.invalidateQueries({ queryKey: ['lotes'] });
      mostrarToast(t('Estoque ajustado'));
      aoFechar();
    },
  });

  function enviar() {
    definirErroLocal(null);
    if (comLote && numeroLote.trim() === '') {
      definirErroLocal(t('Informe o lote do ajuste: este item controla lote.'));
      return;
    }
    if (comLote && comValidade && !saida && validade === '') {
      definirErroLocal(t('Informe a validade do lote: este item controla validade (igual à do lote, se ele já existir).'));
      return;
    }
    if (comSerie && series.length !== absoluto) {
      definirErroLocal(t('Informe uma série por unidade ajustada: {n} de {total}.', { n: series.length, total: absoluto }));
      return;
    }
    mutacao.mutate();
  }

  const erro = erroLocal ?? (mutacao.isError ? mensagemDeErro(mutacao.error, t('Não foi possível ajustar o estoque.')) : null);

  return (
    <Modal aberto aoFechar={aoFechar} titulo={t('Ajustar saldo — {codigo}', { codigo: item.codigo })} largura={comSerie ? 'larga' : 'padrao'}>
      <form
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          enviar();
        }}
        className="flex flex-col gap-4"
      >
        {erro && (
          <p role="alert" className="rounded-campo border border-estado-pending bg-estado-pending-bg px-3 py-2 text-body text-estado-pending">
            {erro}
          </p>
        )}
        <p className="text-body text-texto-secondary">
          {t('Saldo atual: {saldo}. Use um número negativo para registrar saída.', { saldo: item.quantidade_atual })}
        </p>
        {(comLote || comSerie) && (
          <div className="flex flex-wrap gap-2">
            {comLote && (
              <Badge tom="blocked" icone="layers">
                {comValidade ? t('Controla lote e validade') : t('Controla lote')}
              </Badge>
            )}
            {comSerie && (
              <Badge tom="blocked" icone="scan-line">
                {t('Controla número de série')}
              </Badge>
            )}
          </div>
        )}
        <Campo
          rotulo={t('Quantidade')}
          obrigatorio
          tipoDado="quantidade"
          value={quantidade}
          onChange={(evento) => definirQuantidade(evento.target.value)}
        />
        {comLote && (
          <div className="grid gap-3 md:grid-cols-3">
            <Campo
              rotulo={t('Lote')}
              obrigatorio
              tipoDado="codigo"
              ajuda={saida ? t('A saída baixa deste lote.') : t('Entrada cria o lote ou soma a ele.')}
              value={numeroLote}
              onChange={(e) => definirNumeroLote(e.target.value)}
            />
            {!saida && comValidade && (
              <Campo rotulo={t('Validade do lote')} type="date" obrigatorio value={validade} onChange={(e) => definirValidade(e.target.value)} />
            )}
            {!saida && <Campo rotulo={t('Fabricação')} type="date" value={fabricacao} onChange={(e) => definirFabricacao(e.target.value)} />}
          </div>
        )}
        {comSerie && (
          <EntradaSeries
            rotulo={item.codigo}
            series={series}
            esperado={absoluto}
            aoMudar={definirSeries}
          />
        )}
        {comSerie && saida && (
          <p className="text-label text-texto-secondary">{t('Na saída, as séries informadas são sucateadas (precisam estar em estoque).')}</p>
        )}
        <Campo rotulo={t('Motivo')} obrigatorio value={motivo} onChange={(evento) => definirMotivo(evento.target.value)} />
        <Campo rotulo={t('Observações')} value={observacoes} onChange={(evento) => definirObservacoes(evento.target.value)} />
        <div className="flex items-center justify-end gap-2">
          <Botao variante="secundaria" onClick={aoFechar} disabled={mutacao.isPending}>
            {t('Cancelar')}
          </Botao>
          <Botao type="submit" icone="save" ocupado={mutacao.isPending} rotuloOcupado={t('Salvando…')}>
            {t('Salvar ajuste')}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
